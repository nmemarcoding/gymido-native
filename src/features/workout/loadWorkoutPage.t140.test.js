import { loadWorkoutPage } from './loadWorkoutPage';

jest.mock('./runtime/workoutSessionStore', () => ({ reconcileSessionState: jest.fn() }));

// T-140 (RN-SPEC dated change + web review lesson 1): the page-only reads.

const PLAN = { enrollment: { id: 31, plan: { id: 3 } }, schedule: [] };
function api(overrides = {}) {
  return {
    getCurrentWorkout: jest.fn(() => Promise.resolve(null)),
    getCurrentPlan: jest.fn(() => Promise.resolve(PLAN)),
    getTodayStatus: jest.fn(() => Promise.resolve({ is_workout_day: false })),
    listExerciseStats: jest.fn(() => Promise.resolve([])),
    listCompletedWorkouts: jest.fn(() => Promise.resolve([])),
    listPlanDays: jest.fn(() => Promise.resolve([{ id: 7 }])),
    getCurrentWeek: jest.fn(() => Promise.resolve(null)),
    isGeneratorAvailable: jest.fn(() => Promise.resolve(true)),
    getLastCompletedWorkout: jest.fn(() => Promise.resolve({ id: 70 })),
    listMyPlans: jest.fn(() => Promise.resolve([{ id: 2, status: 'completed' }])),
    ...overrides,
  };
}

describe('loadWorkoutPage: T-140 reads', () => {
  it('an open session: none of the page-only reads (the live workout is never held up)', async () => {
    const calls = api({ getCurrentWorkout: jest.fn(() => Promise.resolve({ id: 5 })), getCurrentPlan: jest.fn(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 404 } }))) });
    const result = await loadWorkoutPage({ api: calls });
    expect(result.ok).toBe(true);
    expect(result.data.session).toEqual({ id: 5 });
    ['listPlanDays', 'isGeneratorAvailable', 'getLastCompletedWorkout', 'listMyPlans'].forEach((name) => expect(calls[name]).not.toHaveBeenCalled());
  });

  it('this week has no completed workout → GET /workouts?per_page=1 feeds Last workout; a failure = null', async () => {
    let result = await loadWorkoutPage({ api: api() });
    expect(result.data).toMatchObject({ lastCompleted: { id: 70 }, completedThisWeekFailed: false, myPlans: [] });
    result = await loadWorkoutPage({ api: api({ getLastCompletedWorkout: jest.fn(() => Promise.reject(new Error('offline'))) }) });
    expect(result.ok).toBe(true);
    expect(result.data.lastCompleted).toBeNull();
  });

  it('this week has completed workouts → no per_page=1 call', async () => {
    const calls = api({ listCompletedWorkouts: jest.fn(() => Promise.resolve([{ id: 1, workout_plan_day_id: 7 }])) });
    const result = await loadWorkoutPage({ api: calls });
    expect(calls.getLastCompletedWorkout).not.toHaveBeenCalled();
    expect(result.data.lastCompleted).toBeNull();
  });

  it('the week list failed → completedThisWeekFailed (the stats card hides)', async () => {
    const result = await loadWorkoutPage({ api: api({ listCompletedWorkouts: jest.fn(() => Promise.reject(new Error('x'))) }) });
    expect(result.data).toMatchObject({ completedThisWeek: [], completedThisWeekFailed: true });
  });

  it('GET /my-plans only without an active plan; a failure = []', async () => {
    const none = () => Promise.reject(Object.assign(new Error('none'), { response: { status: 404 } }));
    let calls = api({ getCurrentPlan: jest.fn(none) });
    let result = await loadWorkoutPage({ api: calls });
    expect(result.data.myPlans).toEqual([{ id: 2, status: 'completed' }]);
    calls = api({ getCurrentPlan: jest.fn(none), listMyPlans: jest.fn(() => Promise.reject(new Error('x'))) });
    result = await loadWorkoutPage({ api: calls });
    expect(result.ok).toBe(true);
    expect(result.data.myPlans).toEqual([]);
    calls = api();
    await loadWorkoutPage({ api: calls });
    expect(calls.listMyPlans).not.toHaveBeenCalled();
  });
});
