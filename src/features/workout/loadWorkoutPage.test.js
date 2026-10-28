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
