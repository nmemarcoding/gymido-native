import { getStatus } from '../../shared/api/apiError';
import { localDateKey } from '../plans/libraryFormat';
import { isReminder, planReminders, todaysWorkoutDone } from './reminderPlan';

export const REMINDER_CHANNEL_ID = 'workout-reminders';

// T-103 (owner: "cancel ALL pending reminders and reschedule"): every change
// replaces the whole pending set. `platform` = the notification primitives
// (restAlertPlatform's getScheduled / getPresented / cancelScheduled /
// dismiss / schedule); `api` = { getCurrentPlan, listCompletedWorkouts };
// `localCompleted()` = workouts this app completed (the complete response's
// session; review L4), counted even when the workouts read fails or lags.
// `allowed()` = signed-in member, Settings switch on, permission granted;
// null while that isn't known yet (auth still restoring), and then nothing is
// touched (review M1: an offline cold start must keep the reminders).
// Every operation runs through one serial queue; a failure never blocks the
// next one, and a sync asked for while another waits joins that one.
export function createReminderSync({ platform, api, allowed, localCompleted = () => [], now = () => new Date() }) {
  let queue = Promise.resolve();
  let waiting = null;
  const enqueue = (op) => {
    const run = queue.then(op);
    queue = run.catch(() => {});
    return run;
  };

  async function cancelPending(match) {
    const pending = (await platform.getScheduled()).filter((item) => isReminder(item?.content?.data) && match(item.content.data));
    await Promise.all(pending.map((item) => platform.cancelScheduled(item.identifier)));
  }

  async function dismissShown(match) {
    const shown = (await platform.getPresented()).filter((item) => isReminder(item?.request?.content?.data) && match(item.request.content.data));
    await Promise.all(shown.map((item) => platform.dismiss(item.request.identifier)));
  }

  // The tray keeps one reminder at most: today's newest while today is still
  // open; any earlier day's, or any once today is done, is cleared.
  async function tidyShown(todayKey, doneToday) {
    const shown = (await platform.getPresented()).filter((item) => isReminder(item?.request?.content?.data));
    const today = shown.filter((item) => item.request.content.data.date === todayKey && !doneToday);
    const newest = today.reduce((latest, item) => (latest && (latest.date ?? 0) >= (item.date ?? 0) ? latest : item), null);
    await Promise.all(shown.filter((item) => item !== newest).map((item) => platform.dismiss(item.request.identifier)));
  }

  async function readPlan(todayKey) {
    let current;
    try {
      current = await api.getCurrentPlan();
    } catch (error) {
      // 404 = no active plan (a normal state). Anything else (offline, 5xx):
      // keep what is already scheduled.
      if (getStatus(error) === 404) {
        return { current: null, completedToday: [] };
      }
      throw error;
    }
    let read = [];
    try {
      read = await api.listCompletedWorkouts({ startDate: todayKey, endDate: todayKey });
    } catch {
      read = [];
    }
    const completedToday = Array.isArray(read) ? [...read] : [];
    for (const workout of localCompleted()) {
      if (!completedToday.some((item) => item?.id != null && item.id === workout?.id)) {
        completedToday.push(workout);
      }
    }
    return { current, completedToday };
  }

  async function runSync() {
    const permitted = await allowed();
    if (permitted === null) {
      return null;
    }
    if (!permitted) {
      await cancelPending(() => true);
      await dismissShown(() => true);
      return [];
    }
    const at = now();
    const todayKey = localDateKey(at);
    const { current, completedToday } = await readPlan(todayKey);
    const requests = planReminders({ current, completedToday, now: at });
    await cancelPending(() => true);
    if (requests.length > 0) {
      await platform.ensureChannel?.();
    }
    for (const request of requests) {
      await platform.schedule({
        identifier: request.identifier,
        content: { ...request.content, sound: 'default' },
        trigger: { type: 'date', date: request.fireAt.getTime(), channelId: REMINDER_CHANNEL_ID },
      });
    }
    await tidyShown(todayKey, todaysWorkoutDone({ current, completedToday, now: at }));
    return requests;
  }

  return {
    // Resolves to the scheduled requests ([] when not allowed, null when
    // skipped). A finished workout syncs too: the sync clears today when it
    // was today's workout (UX ruling §1), never for a catch-up.
    sync() {
      if (!waiting) {
        waiting = enqueue(() => {
          waiting = null;
          return runSync();
        });
      }
      return waiting;
    },
    // Sign-out, the switch off.
    clearAll() {
      return enqueue(async () => {
        await cancelPending(() => true);
        await dismissShown(() => true);
      });
    },
  };
}
