import { act, screen, userEvent, within } from '@testing-library/react-native';

import { routes } from '../../../navigation/routes';
import { httpError, mockApi, networkError } from '../../../test/mockApi';
import { currentPlan, day, daysList, NOT_FOUND_CURRENT, planItem, scheduleSaved } from '../../../test/planFixtures';
import { focusedPath, renderMemberApp } from '../../../test/renderMemberApp';
import { SAVED_TOAST_MS } from '../WorkoutScreen';

const PLAN = planItem({ id: 3, name: 'Strength Base', days_per_week: 3 });
const DAYS = [day(11, 1, 'Chest & Biceps', 3), day(12, 2, 'Legs', 3), day(13, 3, 'Back & Triceps', 3)];
const workoutState = (params) => ({ index: 0, routes: [{ name: routes.WorkoutTab, params }] });

function todayStatus({ isWorkoutDay = true, alreadyCompleted = false, planDay = DAYS[0] } = {}) {
  return { is_workout_day: isWorkoutDay, already_completed: alreadyCompleted, plan_day: planDay, action: 'start_workout' };
}

// The hub's six calls (§6.1). `completed` is the list of completed sessions.
function hubApi({ session = null, plan = currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [1, 3, 5], planDays: DAYS }), today = todayStatus(), completed = [], overrides = {} } = {}) {
  return mockApi({
    'GET /workouts/current': { session },
    'GET /my-plans/current': plan ?? httpError(404, NOT_FOUND_CURRENT),
    'GET /my-plans/current/today': today ?? httpError(404, { success: false, message: 'Plan schedule not found' }),
    'GET /exercise-stats?per_page=100': { items: [] },
    [`GET /workouts?status=completed&start_date=${WEEK.startDate}&end_date=${WEEK.endDate}&per_page=100`]: {
      items: completed,
    },
    'GET /plans/3/days': daysList(DAYS),
    ...overrides,
  });
}

// The device-local week the page asks for (RN-SPEC-time §4.3).
const WEEK = (() => {
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);
  const format = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { startDate: format(start), endDate: format(end) };
})();

const hero = () => screen.getByTestId('today-hero-card');

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('load and states (§1.2, §6.1)', () => {
  test('the skeleton shows while the load is in flight', async () => {
    hubApi({ overrides: { 'GET /workouts/current': () => new Promise(() => {}) } });
    await renderMemberApp({ initialState: workoutState() });
    expect(screen.getByTestId('workout-skeleton')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading workout')).toBeOnTheScreen();
  });

  test('the six calls, in the documented fan-out', async () => {
    const api = hubApi();
    await renderMemberApp({ initialState: workoutState() });
    await screen.findByTestId('today-hero-card');
    expect(api.calls.map((call) => call.url)).toEqual([
      '/workouts/current',
      '/my-plans/current',
      '/my-plans/current/today',
      '/exercise-stats?per_page=100',
      `/workouts?status=completed&start_date=${WEEK.startDate}&end_date=${WEEK.endDate}&per_page=100`,
      '/plans/3/days',
    ]);
  });

  test.each([
    ['/workouts/current', networkError(), 'Network Error'],
    ['/my-plans/current', httpError(500, { success: false }), 'Request failed with status code 500'],
    ['/my-plans/current/today', httpError(500, { success: false }), 'Request failed with status code 500'],
    ['/plans/3/days', httpError(403, { success: false }), 'Request failed with status code 403'],
  ])('a failure on %s shows H1 with the transport message', async (url, error, message) => {
    hubApi({ overrides: { [`GET ${url}`]: error } });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('workout-error-state')).toBeOnTheScreen();
    expect(screen.getByText('Workout unavailable')).toBeOnTheScreen();
    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  test('"Try again" re-runs the whole load', async () => {
    const user = userEvent.setup();
    const api = hubApi({ overrides: { 'GET /workouts/current': [networkError(), { session: null }] } });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('workout-error-retry'));
    expect(await screen.findByTestId('today-hero-card')).toBeOnTheScreen();
    expect(api.count('GET', '/workouts/current')).toBe(2);
  });

  test('the optional stats and history calls can fail without breaking the page', async () => {
    hubApi({
      overrides: {
        'GET /exercise-stats?per_page=100': networkError(),
        [`GET /workouts?status=completed&start_date=${WEEK.startDate}&end_date=${WEEK.endDate}&per_page=100`]:
          httpError(500, { success: false }),
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('today-hero-card')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 of 3 training days completed this week')).toBeOnTheScreen();
  });

  test('a 404 on the current plan shows H2, and "Browse plans" opens the Library tab', async () => {
    const user = userEvent.setup();
    hubApi({ plan: null, today: null });
    const { navigation } = await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('workout-empty-state')).toBeOnTheScreen();
    expect(screen.getByText('No active workout plan')).toBeOnTheScreen();
    expect(
      screen.getByText('Pick a plan first, then come back here to start a workout with real backend data.')
    ).toBeOnTheScreen();

    await user.press(screen.getByTestId('workout-browse-plans'));
    expect(focusedPath(navigation.current.getRootState())).toEqual([routes.LibraryTab, routes.PlansList]);
  });

  test('a session takes over the page before the plan check (§1.2, §18)', async () => {
    hubApi({ session: { id: 99, status: 'in_progress', started_at: '2026-09-24T10:00:00Z' }, plan: null });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('complete-workout')).toBeOnTheScreen();
    expect(screen.getByText('0/0 sets done')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-empty-state')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('today-hero-card')).not.toBeOnTheScreen();
  });
});

describe('hero (§2.2, §3.1, §3.2)', () => {
  test('training day: badge, detail and Start', async () => {
    hubApi();
    await renderMemberApp({ initialState: workoutState() });
    const card = await screen.findByTestId('today-hero-card');
    expect(within(card).getByText('Your plan')).toBeOnTheScreen();
    expect(within(card).getByText('Strength Base')).toBeOnTheScreen();
    expect(within(card).getByText('3 training days')).toBeOnTheScreen();
    expect(within(card).getByText('Training day')).toBeOnTheScreen();
    expect(within(card).getByText('Chest & Biceps is ready to go.')).toBeOnTheScreen();
    expect(screen.getByTestId('hero-start')).toBeOnTheScreen();
  });

  test('completed: no Start (⚠W6)', async () => {
    hubApi({ today: todayStatus({ alreadyCompleted: true }) });
    await renderMemberApp({ initialState: workoutState() });
    const card = await screen.findByTestId('today-hero-card');
    expect(within(card).getByText('Completed')).toBeOnTheScreen();
    expect(within(card).getByText('Chest & Biceps is done — great work.')).toBeOnTheScreen();
    expect(screen.queryByTestId('hero-start')).not.toBeOnTheScreen();
  });

  test('rest day: ⚠W1 names the NEXT scheduled day while the badge says rest', async () => {
    hubApi({ today: todayStatus({ isWorkoutDay: false, planDay: DAYS[1] }) });
    await renderMemberApp({ initialState: workoutState() });
    const card = await screen.findByTestId('today-hero-card');
    expect(within(card).getByText('Rest day')).toBeOnTheScreen();
    expect(within(card).getByText('Nothing scheduled today — start any day below.')).toBeOnTheScreen();
    expect(screen.queryByTestId('hero-start')).not.toBeOnTheScreen();
  });

  test('no schedule: today 404s → rest day, setup card above the hero, Unscheduled pills', async () => {
    hubApi({ plan: currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [] }), today: null });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('schedule-setup-card')).toBeOnTheScreen();
    expect(within(hero()).getByText('Rest day')).toBeOnTheScreen();
    expect(screen.getAllByText('Unscheduled')).toHaveLength(3);
    expect(screen.getAllByTestId(/^plan-day-start-/)).toHaveLength(3);
  });

  test('singular day count and an empty ring for a plan with no days', async () => {
    hubApi({ overrides: { 'GET /plans/3/days': daysList([]) } });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByText('0 training days')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 of 0 training days completed this week')).toBeOnTheScreen();
    expect(screen.queryByTestId('schedule-setup-card')).not.toBeOnTheScreen();
  });
});

describe('plan day cards and the ring (§2.3, §5.3)', () => {
  test('one card per day with its weekday pills, in order', async () => {
    hubApi();
    await renderMemberApp({ initialState: workoutState() });
    await screen.findByTestId('today-hero-card');
    expect(screen.getAllByTestId(/^plan-day-card-/).map((card) => card.props.testID)).toEqual([
      'plan-day-card-11',
      'plan-day-card-12',
      'plan-day-card-13',
    ]);
    expect(within(screen.getByTestId('plan-day-card-11')).getByText('Monday')).toBeOnTheScreen();
    expect(within(screen.getByTestId('plan-day-card-12')).getByText('Wednesday')).toBeOnTheScreen();
    expect(screen.getByText('All training days')).toBeOnTheScreen();
  });

  test('⚠W11: the ring counts plan days, so duplicates count once and unknown ids count zero', async () => {
    hubApi({
      completed: [
        { id: 1, workout_plan_day_id: 11 },
        { id: 2, workout_plan_day_id: 11 },
        { id: 3, workout_plan_day_id: 999 },
        { id: 4, workout_plan_day_id: 12 },
      ],
    });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByLabelText('2 of 3 training days completed this week')).toBeOnTheScreen();
    expect(within(screen.getByTestId('plan-day-card-11')).getByText('Done this week')).toBeOnTheScreen();
    expect(within(screen.getByTestId('plan-day-card-13')).queryByText('Done this week')).not.toBeOnTheScreen();
  });

  test('⚠W2: a day already done this week still has a working Start', async () => {
    const user = userEvent.setup();
    const api = hubApi({
      completed: [{ id: 1, workout_plan_day_id: 11 }],
      overrides: { 'POST /workouts': { session: { id: 77, status: 'in_progress' } } },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('plan-day-start-11'));
    expect(api.mutations()).toEqual([
      { method: 'POST', url: '/workouts', body: { user_plan_enrollment_id: 31, workout_plan_day_id: 11 } },
    ]);
  });
});

describe('starting a session (§4)', () => {
  test('hero Start posts, shows "Workout started." and reloads into the runtime', async () => {
    const user = userEvent.setup();
    const api = hubApi({
      overrides: {
        'POST /workouts': { session: { id: 77, status: 'in_progress' } },
        'GET /workouts/current': [{ session: null }, { session: { id: 77, status: 'in_progress' } }],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('hero-start'));

    expect(api.mutations()).toEqual([
      { method: 'POST', url: '/workouts', body: { user_plan_enrollment_id: 31, workout_plan_day_id: 11 } },
    ]);
    expect(await screen.findByTestId('complete-workout')).toBeOnTheScreen();
    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(screen.getByText('Workout started.')).toBeOnTheScreen();
    // The whole load re-ran.
    expect(api.count('GET', '/my-plans/current')).toBe(2);
  });

  test('[O7] a 409 shows the server message, not the axios string', async () => {
    const user = userEvent.setup();
    hubApi({
      overrides: {
        'POST /workouts': httpError(409, { success: false, message: 'Workout session already in progress' }),
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('hero-start'));
    expect(screen.getByText('Workout error')).toBeOnTheScreen();
    expect(screen.getByText('Workout session already in progress')).toBeOnTheScreen();
    expect(screen.queryByText('Request failed with status code 409')).not.toBeOnTheScreen();
    expect(screen.queryByText('Failed to start workout.')).not.toBeOnTheScreen();
  });

  test.each([
    [404, { success: false, message: 'Plan enrollment not found' }, 'Plan enrollment not found'],
    [422, { success: false, message: 'Validation failed' }, 'Validation failed'],
  ])('[O7] a %i shows the server message', async (status, body, message) => {
    const user = userEvent.setup();
    hubApi({ overrides: { 'POST /workouts': httpError(status, body) } });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('hero-start'));
    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  test('⚠W10: the error toast stays; ⚠W5: only the pressed Start disables', async () => {
    const user = userEvent.setup();
    jest.useFakeTimers();
    hubApi({ overrides: { 'POST /workouts': [networkError(), () => new Promise(() => {})] } });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('plan-day-start-12'));
    expect(screen.getByText('Network Error')).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(SAVED_TOAST_MS + 1000);
    });
    expect(screen.getByText('Network Error')).toBeOnTheScreen();
    jest.useRealTimers();

    await user.press(screen.getByTestId('plan-day-start-12'));
    // The next attempt clears it.
    expect(screen.queryByText('Network Error')).not.toBeOnTheScreen();
    // Only day 12's Start disables; day 11's and the hero's (day 11) stay live,
    // so a second POST can be fired for another day.
    expect(screen.getByTestId('plan-day-start-12')).toBeDisabled();
    expect(screen.getByTestId('plan-day-start-11')).toBeEnabled();
    expect(screen.getByTestId('hero-start')).toBeEnabled();
  });
});

describe('hand-off message (§1.3)', () => {
  test('the route message shows once and clears after 3500ms', async () => {
    jest.useFakeTimers();
    hubApi();
    const { navigation } = await renderMemberApp({
      initialState: workoutState({ message: 'Strength Base activated.' }),
    });
    expect(screen.getByText('Strength Base activated.')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(SAVED_TOAST_MS);
    });
    expect(screen.queryByText('Strength Base activated.')).not.toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().params?.message).toBeUndefined();
  });
});

describe('schedule setup (H4 → RN-SPEC-plans §5)', () => {
  test('saving reloads the hub and shows "Training days saved."', async () => {
    const user = userEvent.setup();
    const api = hubApi({
      plan: currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [] }),
      today: null,
      overrides: { 'POST /my-plans/31/schedule': scheduleSaved(31) },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByText('Save training days'));
    expect(api.mutations()[0]).toMatchObject({ method: 'POST', url: '/my-plans/31/schedule' });
    expect(await screen.findByText('Training days saved.')).toBeOnTheScreen();
    expect(api.count('GET', '/my-plans/current')).toBe(2);
  });
});
