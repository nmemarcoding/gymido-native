import { localDateKey } from '../plans/libraryFormat';
import { startDateKey, workoutsByDate } from '../plans/weekByDate';

// T-103 workout reminders (owner decisions + UX ruling, 29 Oct 2026; native
// only): local notifications on training days at 08:00, 13:00 and 18:00 device
// time, at most 4 weeks ahead of the last app open. Pure: the sync step
// (reminderSync.js) reads the plan and replaces every pending reminder with
// this list.

export const REMINDER_KIND = 'workoutReminder';
export const REMINDER_ID_PREFIX = 'gymido.reminder.';
export const REMINDER_DAYS = 28;
// iOS keeps at most 64 pending notifications per app; 60 leaves room for the
// rest-end alert. Nearest first, so a 6–7 day schedule covers ~3 weeks and
// slides forward on every open.
export const REMINDER_MAX = 60;
export const TITLE_MAX = 32;

export const REMINDER_SLOTS = Object.freeze([
  Object.freeze({ key: 'morning', hour: 8 }),
  Object.freeze({ key: 'afternoon', hour: 13 }),
  Object.freeze({ key: 'evening', hour: 18 }),
]);

// UX ruling §2: {workout} cut to 32 characters + "…"; no name → the plain titles.
const COPY = {
  morning: {
    title: (workout) => `Today: ${workout}`,
    fallback: "It's training day",
    body: 'Your workout is ready when you are.',
  },
  afternoon: {
    title: (workout) => `${workout} is still on for today`,
    fallback: "Today's workout is still waiting",
    body: 'An afternoon session fits nicely. Tap to get started.',
  },
  evening: {
    title: (workout) => `Still time for ${workout}`,
    fallback: "Still time for today's workout",
    body: "There's still time this evening. Every session counts!",
  },
};

export function cutWorkoutTitle(title) {
  const text = typeof title === 'string' ? title.trim() : '';
  if (!text) {
    return '';
  }
  const chars = Array.from(text);
  return chars.length > TITLE_MAX ? `${chars.slice(0, TITLE_MAX).join('').trimEnd()}…` : text;
}

export function reminderCopy(slot, workoutTitle) {
  const copy = COPY[slot];
  const workout = cutWorkoutTitle(workoutTitle);
  return { title: workout ? copy.title(workout) : copy.fallback, body: copy.body };
}

export function reminderId(dateKey, slot) {
  return `${REMINDER_ID_PREFIX}${dateKey}.${slot}`;
}

export const isReminder = (data) => data?.kind === REMINDER_KIND;

// The API's weekday id (Mon 1 … Sun 7) → that day's workout title. The
// schedule is sorted by weekday then day number, so the first entry of a
// weekday is the one Today shows.
function titlesByWeekday(schedule) {
  const titles = new Map();
  for (const item of Array.isArray(schedule) ? schedule : []) {
    const weekday = Number(item?.weekday?.id ?? item?.weekday?.sort_order);
    if (weekday >= 1 && weekday <= 7 && !titles.has(weekday)) {
      titles.set(weekday, item?.plan_day?.title ?? '');
    }
  }
  return titles;
}

const weekdayOf = (day) => (day.getDay() === 0 ? 7 : day.getDay());

// "Once THE workout is done" (owner, via PM 29 Oct 2026, review L2): a
// workout started today (local date of started_at, like the week strip) of
// the plan day scheduled for today. A catch-up of another day doesn't count.
export function todaysWorkoutDone({ current, completedToday = [], now = new Date() }) {
  const weekday = weekdayOf(now);
  const todaysDays = new Set(
    (Array.isArray(current?.schedule) ? current.schedule : [])
      .filter((item) => Number(item?.weekday?.id ?? item?.weekday?.sort_order) === weekday && item?.plan_day?.id != null)
      .map((item) => Number(item.plan_day.id))
  );
  const todayKey = localDateKey(now);
  return (Array.isArray(completedToday) ? completedToday : []).some(
    (workout) => todaysDays.has(Number(workout?.workout_plan_day_id)) && (workoutsByDate([workout])[todayKey] ?? 0) > 0
  );
}

// `current` = GET /my-plans/current ({ enrollment, schedule }; null = no
// plan); `completedToday` = today's completed workouts. Returns the requests in
// time order, at most REMINDER_MAX.
export function planReminders({ current, completedToday = [], now = new Date(), days = REMINDER_DAYS, max = REMINDER_MAX }) {
  const enrollment = current?.enrollment;
  if (!enrollment || (enrollment.status && enrollment.status !== 'active')) {
    return [];
  }
  const titles = titlesByWeekday(current.schedule);
  if (titles.size === 0) {
    return [];
  }
  const startedOn = startDateKey(enrollment.started_on);
  const doneToday = todaysWorkoutDone({ current, completedToday, now });
  const requests = [];
  for (let offset = 0; offset < days && requests.length < max; offset += 1) {
    // Local midnight + n days: DST-safe (never adds 24 h in milliseconds).
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateKey = localDateKey(day);
    const weekday = weekdayOf(day);
    if (!titles.has(weekday) || (startedOn && dateKey < startedOn) || (offset === 0 && doneToday)) {
      continue;
    }
    for (const slot of REMINDER_SLOTS) {
      const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.hour);
      if (fireAt.getTime() <= now.getTime() || requests.length >= max) {
        continue;
      }
      requests.push({
        identifier: reminderId(dateKey, slot.key),
        content: { ...reminderCopy(slot.key, titles.get(weekday)), data: { kind: REMINDER_KIND, date: dateKey, slot: slot.key } },
        fireAt,
      });
    }
  }
  return requests;
}

// UX ruling §3: the Settings value on (device 12/24-hour format).
export function reminderTimesLabel(hour12 = usesTwelveHourClock()) {
  const times = hour12 ? ['8 AM', '1 PM', '6 PM'] : ['8:00', '13:00', '18:00'];
  return `${times[0]}, ${times[1]} and ${times[2]} on training days`;
}

// The locale's clock (Hermes Intl). The phone's own 12/24-hour switch isn't
// readable without a new dependency, so this follows the region format.
export function usesTwelveHourClock() {
  try {
    return Boolean(new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12);
  } catch {
    return false;
  }
}
