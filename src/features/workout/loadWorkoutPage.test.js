import { loadWorkoutPage } from './loadWorkoutPage';

const fail = (status) => Promise.reject(Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } }));

function api(overrides = {}) {
  return {
    getCurrentWorkout: jest.fn(() => Promise.resolve(null)),
    getCurrentPlan: jest.fn(() => Promise.resolve({ enrollment: { id: 31, plan: { id: 3 } }, schedule: [] })),
    getTodayStatus: jest.fn(() => Promise.resolve({ is_workout_day: false })),
    listExerciseStats: jest.fn(() => Promise.resolve([])),
    listCompletedWorkouts: jest.fn(() => Promise.resolve([{ workout_plan_day_id: 7 }])),
    listPlanDays: jest.fn(() => Promise.resolve([{ id: 7 }])),
    getCurrentWeek: jest.fn(() => Promise.resolve([])),
    isGeneratorAvailable: jest.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

describe('loadWorkoutPage (§6.1)', () => {
  it('runs the five calls with this week, then the plan days', async () => {
    const calls = api();
    const result = await loadWorkoutPage({ api: calls, now: new Date(2026, 9, 22) });
    expect(result.ok).toBe(true);
    expect(calls.listCompletedWorkouts).toHaveBeenCalledWith({ startDate: '2026-10-19', endDate: '2026-10-25' });
    expect(calls.listPlanDays).toHaveBeenCalledWith(3);
    expect(result.data).toMatchObject({ planDays: [{ id: 7 }], completedThisWeekDayIds: [7], session: null });
  });

  it('treats a 404 plan as no plan and skips the days', async () => {
    const calls = api({ getCurrentPlan: jest.fn(() => fail(404)), getTodayStatus: jest.fn(() => fail(404)) });
    const result = await loadWorkoutPage({ api: calls });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ currentPlan: null, todayStatus: null, planDays: [] });
    expect(calls.listPlanDays).not.toHaveBeenCalled();
  });

  it('still loads when the optional stats and history calls fail', async () => {
    const calls = api({ listExerciseStats: jest.fn(() => fail(500)), listCompletedWorkouts: jest.fn(() => fail(500)) });
    const result = await loadWorkoutPage({ api: calls });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ exerciseStatsMap: {}, completedThisWeekDayIds: [] });
  });

  it('reports a failure of a required call instead of throwing', async () => {
    for (const key of ['getCurrentWorkout', 'getCurrentPlan', 'getTodayStatus', 'listPlanDays']) {
      const result = await loadWorkoutPage({ api: api({ [key]: jest.fn(() => fail(500)) }) });
      expect(result.ok).toBe(false);
      expect(result.error.message).toBe('Request failed with status code 500');
    }
  });
});

// Reviewer LOW on T-59 e56b591: a session that ended while its screen wasn't
// mounted (finished on web or another device, auto-ended) kept its store
// entry and its scheduled rest alert, so a stale "rest over" could fire.
// A load that finds no active session, or another one, ends the stored one
// (disposing the controller cancels its alert); a failed load changes nothing.
describe('loadWorkoutPage: T-76 week + generator', () => {
  it('loads /my-plans/current/week with the others and keeps the completed items (duration)', async () => {
    const week = [{ date: '2026-10-19', status: 'done' }];
    const completed = [{ workout_plan_day_id: 7, duration_seconds: 3120, completed_at: '2026-10-22T10:00:00Z' }];
    const calls = api({ getCurrentWeek: jest.fn(() => Promise.resolve(week)), listCompletedWorkouts: jest.fn(() => Promise.resolve(completed)) });
    const result = await loadWorkoutPage({ api: calls });
    expect(calls.getCurrentWeek).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({ week, completedThisWeek: completed, completedThisWeekDayIds: [7], generatorAvailable: false });
    expect(calls.isGeneratorAvailable).not.toHaveBeenCalled();
  });

  it('a failed week is null (the week card hides), never a failed page', async () => {
    const result = await loadWorkoutPage({ api: api({ getCurrentWeek: jest.fn(() => fail(500)) }) });
    expect(result.ok).toBe(true);
    expect(result.data.week).toBeNull();
  });

  it('no plan: asks the generator (U2); a failed check is false', async () => {
    const noPlan = api({ getCurrentPlan: jest.fn(() => fail(404)) });
    expect((await loadWorkoutPage({ api: noPlan })).data.generatorAvailable).toBe(true);
    const failing = api({ getCurrentPlan: jest.fn(() => fail(404)), isGeneratorAvailable: jest.fn(() => Promise.reject(new Error('x'))) });
    expect((await loadWorkoutPage({ api: failing })).data.generatorAvailable).toBe(false);
  });
});

// T-81: the completed list covers the /week dates and keeps started_at.
describe('loadWorkoutPage: T-81 completed workouts for the /week dates', () => {
  const weekFrom = (dates) => dates.map((date, index) => ({ weekday: { id: index + 1 }, date, status: 'rest', is_workout_day: false }));
  const THIS_WEEK = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  const NEXT_WEEK = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

  it('the same Mon–Sun as /week: one call, the rows as is (started_at kept)', async () => {
    const rows = [{ workout_plan_day_id: 7, started_at: '2026-10-22T08:00:00Z', completed_at: '2026-10-22T09:00:00Z' }];
    const calls = api({ getCurrentWeek: jest.fn(() => Promise.resolve(weekFrom(THIS_WEEK))), listCompletedWorkouts: jest.fn(() => Promise.resolve(rows)) });
    const result = await loadWorkoutPage({ api: calls, now: new Date(2026, 9, 22) });
    expect(calls.listCompletedWorkouts).toHaveBeenCalledTimes(1);
    expect(result.data.completedThisWeek).toBe(rows);
    expect(result.data.completedThisWeek[0].started_at).toBe('2026-10-22T08:00:00Z');
  });

  it('/week is another week (Sunday → Monday midnight between device and server): fetched again for week[0]..week[6]', async () => {
    const old = [{ workout_plan_day_id: 7, started_at: '2026-10-25T20:00:00Z' }];
    const fresh = [{ workout_plan_day_id: 8, started_at: '2026-10-26T00:10:00Z' }];
    const listCompletedWorkouts = jest.fn(({ startDate }) => Promise.resolve(startDate === '2026-10-26' ? fresh : old));
    const calls = api({ getCurrentWeek: jest.fn(() => Promise.resolve(weekFrom(NEXT_WEEK))), listCompletedWorkouts });
    const result = await loadWorkoutPage({ api: calls, now: new Date(2026, 9, 25, 23, 59, 59) });
    expect(listCompletedWorkouts.mock.calls).toEqual([[{ startDate: '2026-10-19', endDate: '2026-10-25' }], [{ startDate: '2026-10-26', endDate: '2026-11-01' }]]);
    expect(result.data).toMatchObject({ completedThisWeek: fresh, completedThisWeekDayIds: [8] });
  });

  // DECLARED (T-74, T-81 reviewer carry): the title said "a failed refetch is an empty list"; a failed refetch now
  // keeps the device-range list (as web).
  it('a failed /week keeps the local-week list; a failed refetch keeps the local-week list too, never a failed page', async () => {
    const calls = api({ getCurrentWeek: jest.fn(() => fail(500)) });
    expect((await loadWorkoutPage({ api: calls, now: new Date(2026, 9, 22) })).data.completedThisWeekDayIds).toEqual([7]);
    expect(calls.listCompletedWorkouts).toHaveBeenCalledTimes(1);
    const failing = jest.fn(({ startDate }) => (startDate === '2026-10-26' ? fail(500) : Promise.resolve([{ workout_plan_day_id: 7 }])));
    const result = await loadWorkoutPage({ api: api({ getCurrentWeek: jest.fn(() => Promise.resolve(weekFrom(NEXT_WEEK))), listCompletedWorkouts: failing }), now: new Date(2026, 9, 22) });
    expect(result.ok).toBe(true);
    // DECLARED (T-74): was toMatchObject({ completedThisWeek: [], completedThisWeekDayIds: [] }); web keeps the
    // device-range items when the /week-dates re-read fails, so the ✓ Done ids and the done-by-date still load.
    expect(failing.mock.calls).toEqual([[{ startDate: '2026-10-19', endDate: '2026-10-25' }], [{ startDate: '2026-10-26', endDate: '2026-11-01' }]]);
    expect(result.data).toMatchObject({ completedThisWeek: [{ workout_plan_day_id: 7 }], completedThisWeekDayIds: [7] });
  });

  it('a failed refetch with a failed local list too: an empty list, never a failed page', async () => {
    const calls = api({ getCurrentWeek: jest.fn(() => Promise.resolve(weekFrom(NEXT_WEEK))), listCompletedWorkouts: jest.fn(() => fail(500)) });
    const result = await loadWorkoutPage({ api: calls, now: new Date(2026, 9, 22) });
    expect(result.ok).toBe(true);
    expect(calls.listCompletedWorkouts).toHaveBeenCalledTimes(2);
    expect(result.data).toMatchObject({ completedThisWeek: [], completedThisWeekDayIds: [] });
  });
});

describe('loadWorkoutPage reconciles the stored session (T-59)', () => {
  jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
  const { endSessionState, peekSession, sessionEntry } = require('./runtime/workoutSessionStore');
  let controller;
  beforeEach(() => {
    controller = { dispose: jest.fn() };
    sessionEntry(5).controller = controller;
  });
  afterEach(() => endSessionState());

  it.each([
    ['no active session (ended elsewhere)', null],
    ['another session', { id: 6, exercises: [] }],
  ])('%s → the entry ends and its alert is cancelled', async (_name, current) => {
    await loadWorkoutPage({ api: api({ getCurrentWorkout: jest.fn(() => Promise.resolve(current)) }) });
    expect(peekSession(5)).toBeNull();
    expect(controller.dispose).toHaveBeenCalledTimes(1);
  });

  it('the same session keeps it', async () => {
    await loadWorkoutPage({ api: api({ getCurrentWorkout: jest.fn(() => Promise.resolve({ id: 5, exercises: [] })) }) });
    expect(peekSession(5)).not.toBeNull();
    expect(controller.dispose).not.toHaveBeenCalled();
  });

  it('a failed load keeps it (no proof the session ended)', async () => {
    await loadWorkoutPage({ api: api({ getCurrentWorkout: jest.fn(() => fail(500)) }) });
    expect(peekSession(5)).not.toBeNull();
  });
});
