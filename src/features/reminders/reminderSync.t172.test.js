// T-172 (P1, owner 31 Oct 2026: no 08:00 reminder on a Saturday training day).
// Fix b: a failed plan read schedules from the last good plan (cache); fix d:
// every sync reports how many it scheduled and, for 0, why.
import { REMINDER_KIND, reminderSkipReason } from './reminderPlan';
import { createReminderSync } from './reminderSync';

// Saturday 31 Oct 2026, 06:00 local: the owner's install / first open.
const SAT_0600 = new Date(2026, 9, 31, 6, 0);
const SAT_PLAN = {
  enrollment: { id: 7, status: 'active', started_on: '2026-10-27' },
  schedule: [
    { weekday: { id: 2, sort_order: 2 }, plan_day: { id: 1, title: 'Full Body A' } },
    { weekday: { id: 6, sort_order: 6 }, plan_day: { id: 2, title: 'Full Body B' } },
  ],
};
const offline = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
const notFound = Object.assign(new Error('Not found'), { response: { status: 404 } });
const serverError = Object.assign(new Error('Server'), { response: { status: 503 } });
const pendingReminder = { identifier: 'gymido.reminder.2026-10-31.morning', content: { data: { kind: REMINDER_KIND, date: '2026-10-31', slot: 'morning' } } };

function memoryCache(initial) {
  let value = initial;
  return {
    load: jest.fn(async () => value),
    save: jest.fn(async (current) => {
      value = current;
    }),
    peek: () => value,
  };
}

function setup({ plan = SAT_PLAN, planError = null, cache = null, pending = [], now = SAT_0600 } = {}) {
  const platform = {
    getScheduled: jest.fn(async () => pending),
    getPresented: jest.fn(async () => []),
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
    listCompletedWorkouts: jest.fn(async () => []),
  };
  const onReport = jest.fn();
  const sync = createReminderSync({ platform, api, allowed: async () => true, now: () => now, cache, onReport });
  return { platform, api, sync, onReport };
}

describe('T-172 the owner case: Saturday 06:00, a Saturday training day', () => {
  test("today's 08:00 is the first reminder scheduled (local time, not UTC; Sat = weekday 6)", async () => {
    const { platform, sync, onReport } = setup();
    const requests = await sync.sync();
    expect(requests[0]).toMatchObject({ identifier: 'gymido.reminder.2026-10-31.morning' });
    expect(platform.schedule.mock.calls[0][0].trigger.date).toBe(new Date(2026, 9, 31, 8, 0).getTime());
    expect(onReport).toHaveBeenLastCalledWith({ count: requests.length, source: 'api', reason: null, status: null });
  });
});

describe('T-172 fix b: the last good plan when the read fails', () => {
  test('a good read is saved; a later failed read schedules from it (source cache)', async () => {
    const cache = memoryCache(undefined);
    const first = setup({ cache });
    await first.sync.sync();
    expect(cache.peek()).toBe(SAT_PLAN);

    const second = setup({ cache, planError: offline, pending: [pendingReminder] });
    const requests = await second.sync.sync();
    expect(requests[0].identifier).toBe('gymido.reminder.2026-10-31.morning');
    expect(second.platform.cancelScheduled).toHaveBeenCalledWith(pendingReminder.identifier);
    expect(second.platform.schedule).toHaveBeenCalledTimes(requests.length);
    expect(second.onReport).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'cache', count: requests.length }));
  });

  test('no cached plan: the failure still rejects and keeps what is pending (unchanged), and says why', async () => {
    const { platform, sync, onReport } = setup({ cache: memoryCache(undefined), planError: serverError, pending: [pendingReminder] });
    await expect(sync.sync()).rejects.toBe(serverError);
    expect(platform.cancelScheduled).not.toHaveBeenCalled();
    expect(platform.schedule).not.toHaveBeenCalled();
    expect(onReport).toHaveBeenLastCalledWith({ count: null, source: 'api', reason: 'plan-read-failed', status: 503 });
  });

  test('a 404 (no plan) is remembered: a later failure schedules nothing and clears the stale ones', async () => {
    const cache = memoryCache(SAT_PLAN);
    await setup({ cache, planError: notFound }).sync.sync();
    expect(cache.peek()).toBeNull();
    const later = setup({ cache, planError: offline, pending: [pendingReminder] });
    await expect(later.sync.sync()).resolves.toEqual([]);
    expect(later.platform.cancelScheduled).toHaveBeenCalledWith(pendingReminder.identifier);
    expect(later.onReport).toHaveBeenLastCalledWith({ count: 0, source: 'cache', reason: 'no-plan', status: null });
  });

  test('a cache that throws never breaks a sync', async () => {
    const broken = { load: () => Promise.reject(new Error('disk')), save: () => { throw new Error('disk'); } };
    await expect(setup({ cache: broken }).sync.sync()).resolves.toHaveLength(24);
    await expect(setup({ cache: broken, planError: offline }).sync.sync()).rejects.toBe(offline);
  });
});

describe('T-172 review L1: the owner is read at the start of the request', () => {
  test('a sign-in switch while the plan read is in flight never files the plan under the new owner', async () => {
    let who = 'auth0|a';
    const saved = [];
    const cache = { owner: jest.fn(() => who), load: jest.fn(async () => undefined), save: jest.fn(async (current, owner) => saved.push([owner, current])) };
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const platform = { getScheduled: async () => [], getPresented: async () => [], cancelScheduled: async () => {}, dismiss: async () => {}, schedule: async () => 'id', ensureChannel: async () => {} };
    const api = { getCurrentPlan: async () => gate, listCompletedWorkouts: async () => [] };
    const running = createReminderSync({ platform, api, allowed: async () => true, now: () => SAT_0600, cache }).sync();
    await Promise.resolve();
    await Promise.resolve();
    who = 'auth0|b';
    release(SAT_PLAN);
    await running;
    expect(cache.owner).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([['auth0|a', SAT_PLAN]]);
  });

  test('a failed read loads the cache for the owner read at the start', async () => {
    const cache = { owner: () => 'auth0|a', load: jest.fn(async () => SAT_PLAN), save: jest.fn(async () => {}) };
    const { sync } = setup({ cache, planError: offline });
    await sync.sync();
    expect(cache.load).toHaveBeenCalledWith('auth0|a');
  });
});

describe('T-172 fix d: why a sync scheduled nothing', () => {
  const plan = (enrollment, schedule = SAT_PLAN.schedule) => ({ enrollment: { ...SAT_PLAN.enrollment, ...enrollment }, schedule });

  test.each([
    ['no-plan', null],
    ['not-active:paused', plan({ status: 'paused' })],
    ['no-schedule', plan({}, [])],
    ['no-weekdays', plan({}, [{ weekday: 6, plan_day: { id: 2, title: 'B' } }])],
    ['not-started', plan({ started_on: '2027-01-01' })],
  ])('%s', async (reason, current) => {
    const { onReport } = await (async () => {
      const s = setup({ plan: current });
      await s.sync.sync();
      return s;
    })();
    expect(onReport).toHaveBeenLastCalledWith({ count: 0, source: 'api', reason, status: null });
  });

  test('not allowed (switch off / no permission / signed out) reports not-allowed', async () => {
    const onReport = jest.fn();
    const platform = { getScheduled: async () => [], getPresented: async () => [], cancelScheduled: async () => {}, dismiss: async () => {} };
    await createReminderSync({ platform, api: {}, allowed: async () => false, onReport }).sync();
    expect(onReport).toHaveBeenCalledWith({ count: 0, source: null, reason: 'not-allowed', status: null });
  });

  test('reminderSkipReason is null when something is scheduled; no-slot-left late on the last window day', () => {
    expect(reminderSkipReason({ current: SAT_PLAN, now: SAT_0600 })).toBeNull();
    // A plan whose only day is today, after the 18:00 slot, with a 1-day window.
    const onlyToday = { enrollment: SAT_PLAN.enrollment, schedule: [SAT_PLAN.schedule[1]] };
    expect(reminderSkipReason({ current: onlyToday, now: new Date(2026, 9, 31, 19, 0), days: 1 })).toBe('no-slot-left');
  });

  test('a report that throws never breaks a sync', async () => {
    const platform = { getScheduled: async () => [], getPresented: async () => [], cancelScheduled: async () => {}, dismiss: async () => {}, schedule: async () => 'id', ensureChannel: async () => {} };
    const api = { getCurrentPlan: async () => SAT_PLAN, listCompletedWorkouts: async () => [] };
    const onReport = () => {
      throw new Error('boom');
    };
    await expect(createReminderSync({ platform, api, allowed: async () => true, now: () => SAT_0600, onReport }).sync()).resolves.toHaveLength(24);
  });
});
