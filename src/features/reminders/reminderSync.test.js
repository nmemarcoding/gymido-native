import { REMINDER_KIND } from './reminderPlan';
import { REMINDER_CHANNEL_ID, createReminderSync } from './reminderSync';

// Thu 29 Oct 2026, 07:00 local; the plan trains on Thursdays.
const NOW = new Date(2026, 9, 29, 7, 0);
const PLAN = {
  enrollment: { id: 31, status: 'active', started_on: '2026-09-21T00:00:00Z' },
  schedule: [{ weekday: { id: 4, sort_order: 4 }, plan_day: { id: 12, title: 'Pull' } }],
};
const reminder = (date, slot) => ({ identifier: `gymido.reminder.${date}.${slot}`, content: { data: { kind: REMINDER_KIND, date, slot } } });
const REST = { identifier: 'gymido-rest-end', content: { data: { kind: 'restEnd', source: 'scheduled' } } };
const shown = (item, date = 0) => ({ date, request: item });

function setup({ allowed = true, plan = PLAN, completed = [], pending = [], presented = [], planError = null, local = [] } = {}) {
  const platform = {
    getScheduled: jest.fn(async () => pending),
    getPresented: jest.fn(async () => presented),
    cancelScheduled: jest.fn(async () => {}),
    dismiss: jest.fn(async () => {}),
    schedule: jest.fn(async () => 'id'),
    ensureChannel: jest.fn(async () => {}),
  };
  const api = {
    getCurrentPlan: jest.fn(async () => {
      if (planError) {
        throw planError;
      }
      return plan;
    }),
    listCompletedWorkouts: jest.fn(async () => completed),
  };
  const sync = createReminderSync({ platform, api, allowed: jest.fn(async () => allowed), localCompleted: () => local, now: () => NOW });
  return { platform, api, sync };
}

describe('T-103 reminder sync', () => {
  test('replace-all: cancels every pending reminder, then schedules the new set (date triggers on the reminder channel)', async () => {
    const { platform, api, sync } = setup({ pending: [reminder('2026-10-30', 'morning'), REST] });
    const requests = await sync.sync();
    expect(api.listCompletedWorkouts).toHaveBeenCalledWith({ startDate: '2026-10-29', endDate: '2026-10-29' });
    // The rest-end alert is never touched.
    expect(platform.cancelScheduled.mock.calls).toEqual([['gymido.reminder.2026-10-30.morning']]);
    expect(platform.cancelScheduled.mock.invocationCallOrder[0]).toBeLessThan(platform.schedule.mock.invocationCallOrder[0]);
    expect(requests).toHaveLength(12);
    expect(platform.schedule).toHaveBeenCalledTimes(12);
    expect(platform.schedule.mock.calls[0][0]).toEqual({
      identifier: 'gymido.reminder.2026-10-29.morning',
      content: {
        title: 'Today: Pull',
        body: 'Your workout is ready when you are.',
        sound: 'default',
        data: { kind: REMINDER_KIND, date: '2026-10-29', slot: 'morning' },
      },
      trigger: { type: 'date', date: new Date(2026, 9, 29, 8).getTime(), channelId: REMINDER_CHANNEL_ID },
    });
  });

  test('not allowed (signed out, trainer, switch off, no permission): clears everything, reads nothing', async () => {
    const { platform, api, sync } = setup({
      allowed: false,
      pending: [reminder('2026-10-29', 'evening'), REST],
      presented: [shown(reminder('2026-10-29', 'morning')), shown(REST)],
    });
    expect(await sync.sync()).toEqual([]);
    expect(api.getCurrentPlan).not.toHaveBeenCalled();
    expect(platform.schedule).not.toHaveBeenCalled();
    expect(platform.cancelScheduled.mock.calls).toEqual([['gymido.reminder.2026-10-29.evening']]);
    expect(platform.dismiss.mock.calls).toEqual([['gymido.reminder.2026-10-29.morning']]);
  });

  test('no active plan (404): cancels all, schedules none', async () => {
    const { platform, sync } = setup({ planError: { response: { status: 404 } }, pending: [reminder('2026-11-05', 'morning')] });
    expect(await sync.sync()).toEqual([]);
    expect(platform.cancelScheduled).toHaveBeenCalledWith('gymido.reminder.2026-11-05.morning');
    expect(platform.schedule).not.toHaveBeenCalled();
  });

  test('offline / 5xx: keeps what is already scheduled', async () => {
    const { platform, sync } = setup({ planError: new Error('Network Error'), pending: [reminder('2026-11-05', 'morning')] });
    await expect(sync.sync()).rejects.toThrow('Network Error');
    expect(platform.cancelScheduled).not.toHaveBeenCalled();
    expect(platform.schedule).not.toHaveBeenCalled();
    // The queue keeps working after a failure.
    platform.getScheduled.mockResolvedValue([]);
    await expect(sync.clearAll()).resolves.toBeUndefined();
  });

  test('a failed workouts read counts as not done (today stays scheduled)', async () => {
    const { api, sync } = setup();
    api.listCompletedWorkouts.mockRejectedValue(new Error('500'));
    const requests = await sync.sync();
    expect(requests[0].identifier).toBe('gymido.reminder.2026-10-29.morning');
  });

  test('done today (e.g. on the web): nothing today, and today\'s shown reminder is cleared', async () => {
    const { platform, sync } = setup({
      completed: [{ workout_plan_day_id: 12, started_at: new Date(2026, 9, 29, 6).toISOString() }],
      presented: [shown(reminder('2026-10-29', 'morning'), 1)],
    });
    const requests = await sync.sync();
    expect(requests.some((request) => request.content.data.date === '2026-10-29')).toBe(false);
    expect(platform.dismiss).toHaveBeenCalledWith('gymido.reminder.2026-10-29.morning');
  });

  test('the tray keeps only today\'s newest reminder; earlier days are cleared', async () => {
    const { platform, sync } = setup({
      presented: [
        shown(reminder('2026-10-22', 'evening'), 10),
        shown(reminder('2026-10-29', 'morning'), 20),
        shown(reminder('2026-10-29', 'afternoon'), 30),
        shown(REST, 40),
      ],
    });
    await sync.sync();
    expect(platform.dismiss.mock.calls.map(([id]) => id).sort()).toEqual(['gymido.reminder.2026-10-22.evening', 'gymido.reminder.2026-10-29.morning']);
  });

  test('a catch-up done today: today stays scheduled and today\'s shown reminder stays (review L2)', async () => {
    const { platform, sync } = setup({
      completed: [{ workout_plan_day_id: 99, started_at: new Date(2026, 9, 29, 6).toISOString() }],
      presented: [shown(reminder('2026-10-29', 'morning'), 1)],
    });
    const requests = await sync.sync();
    expect(requests[0].identifier).toBe('gymido.reminder.2026-10-29.morning');
    expect(platform.dismiss).not.toHaveBeenCalled();
  });

  test('allowed() null (auth still restoring): touches nothing, reads nothing (review M1)', async () => {
    const { platform, api, sync } = setup({
      allowed: null,
      pending: [reminder('2026-11-05', 'morning')],
      presented: [shown(reminder('2026-10-29', 'morning'))],
    });
    expect(await sync.sync()).toBeNull();
    expect(api.getCurrentPlan).not.toHaveBeenCalled();
    expect(platform.cancelScheduled).not.toHaveBeenCalled();
    expect(platform.dismiss).not.toHaveBeenCalled();
    expect(platform.schedule).not.toHaveBeenCalled();
  });

  test('the Android channel is ensured before the first schedule, and only when something is scheduled (review L3)', async () => {
    const { platform, sync } = setup();
    await sync.sync();
    expect(platform.ensureChannel).toHaveBeenCalledTimes(1);
    expect(platform.ensureChannel.mock.invocationCallOrder[0]).toBeLessThan(platform.schedule.mock.invocationCallOrder[0]);
    const empty = setup({ planError: { response: { status: 404 } } });
    await empty.sync.sync();
    expect(empty.platform.ensureChannel).not.toHaveBeenCalled();
  });

  test('today\'s workout finished in this app counts even when the workouts read fails (review L4)', async () => {
    const finished = { id: 77, workout_plan_day_id: 12, started_at: new Date(2026, 9, 29, 6).toISOString() };
    const { api, sync } = setup({ local: [finished], presented: [shown(reminder('2026-10-29', 'morning'), 1)] });
    api.listCompletedWorkouts.mockRejectedValue(new Error('500'));
    const requests = await sync.sync();
    expect(requests.some((request) => request.content.data.date === '2026-10-29')).toBe(false);
  });

  test('a local completion the read already has is not counted twice; a catch-up stays a catch-up (review L4)', async () => {
    const finished = { id: 77, workout_plan_day_id: 99, started_at: new Date(2026, 9, 29, 6).toISOString() };
    const { sync } = setup({ local: [finished], completed: [finished] });
    const requests = await sync.sync();
    expect(requests[0].identifier).toBe('gymido.reminder.2026-10-29.morning');
  });

  test('clearAll: every reminder, pending and shown; the rest alert stays', async () => {
    const { platform, sync } = setup({
      pending: [reminder('2026-11-05', 'morning'), REST],
      presented: [shown(reminder('2026-10-29', 'morning')), shown(REST)],
    });
    await sync.clearAll();
    expect(platform.cancelScheduled.mock.calls).toEqual([['gymido.reminder.2026-11-05.morning']]);
    expect(platform.dismiss.mock.calls).toEqual([['gymido.reminder.2026-10-29.morning']]);
  });

  test('syncs asked for while one waits join it; operations run one at a time', async () => {
    const { api, sync } = setup();
    let release;
    api.getCurrentPlan.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(PLAN))));
    const first = sync.sync();
    await new Promise((resolve) => setImmediate(resolve));
    expect(api.getCurrentPlan).toHaveBeenCalledTimes(1);
    const second = sync.sync();
    const third = sync.sync();
    expect(second).toBe(third);
    release();
    await first;
    await second;
    // The first plus one joined follow-up.
    expect(api.getCurrentPlan).toHaveBeenCalledTimes(2);
  });
});
