import * as Notifications from 'expo-notifications';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import { routes } from '../../../navigation/routes';
import { httpError, mockApi, networkError } from '../../../test/mockApi';
import { installNotificationTray } from '../../../test/notificationTray';
import { currentPlan, day, daysList, planItem } from '../../../test/planFixtures';
import { renderMemberApp } from '../../../test/renderMemberApp';
import { useWorkoutSessionStore } from '../workoutSessionStore';

const PLAN = planItem({ id: 3, name: 'Strength Base', days_per_week: 3 });
const DAYS = [day(11, 1, 'Chest & Biceps', 3)];
const workoutState = () => ({ index: 0, routes: [{ name: routes.WorkoutTab }] });

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

function set(id, number, { completed = false, rest = 60, min = 8, max = 12, weight = null } = {}) {
  return {
    id,
    workout_session_exercise_id: 100,
    set_number: number,
    target_reps_min: min,
    target_reps_max: max,
    target_weight_value: weight,
    rest_seconds_planned: rest,
    is_completed: completed,
    actual_reps: completed ? max : null,
    actual_weight_value: completed ? 100 : null,
  };
}

function session({ sets = [set(201, 1), set(202, 2)], startedAt = new Date().toISOString(), exercises } = {}) {
  return {
    id: 77,
    status: 'in_progress',
    started_at: startedAt,
    exercises: exercises ?? [
      {
        id: 301,
        order_index: 1,
        exercise_name_snapshot: 'Bench Press',
        exercise: { id: 5, name: 'Bench Press', primary_muscle_group: { name: 'Chest' } },
        sets,
      },
    ],
  };
}

function runtimeApi({ current = session(), stats = [], overrides = {} } = {}) {
  return mockApi({
    'GET /workouts/current': { session: current },
    'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [1], planDays: DAYS }),
    'GET /my-plans/current/today': { is_workout_day: true, already_completed: false, plan_day: DAYS[0] },
    'GET /exercise-stats?per_page=100': { items: stats },
    [`GET /workouts?status=completed&start_date=${WEEK.startDate}&end_date=${WEEK.endDate}&per_page=100`]: { items: [] },
    'GET /plans/3/days': daysList(DAYS),
    ...overrides,
  });
}

const PATCH_201 = 'PATCH /workouts/77/exercises/301/sets/201';

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  useWorkoutSessionStore.setState({ isSessionActive: false });
});

describe('runtime shell (§19)', () => {
  test('renders the session in place of the hub and hides the tab bar', async () => {
    runtimeApi();
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('exercise-stage')).toBeOnTheScreen();
    expect(screen.getByText('Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Strength Base')).toBeOnTheScreen();
    expect(screen.getByText('0/2 sets done')).toBeOnTheScreen();
    expect(screen.getByText('Chest')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-hero-card')).not.toBeOnTheScreen();
    expect(useWorkoutSessionStore.getState().isSessionActive).toBe(true);
    // §19.3: the reps label uses an EN DASH, and reps are not editable (⚠W14).
    expect(screen.getAllByText('8–12 reps')).toHaveLength(2);
    expect(screen.queryByLabelText(/Reps for set/)).not.toBeOnTheScreen();
  });

  test('[O8] a session started on an earlier day shows the stale banner', async () => {
    const startedAt = new Date(Date.now() - 36 * 60 * 60 * 1000);
    runtimeApi({ current: session({ startedAt: startedAt.toISOString() }) });
    await renderMemberApp({ initialState: workoutState() });
    const banner = await screen.findByTestId('stale-session-banner');
    expect(within(banner).getByText(/^Started \w+, \w{3} \d{1,2}$/)).toBeOnTheScreen();
    expect(
      within(banner).getByText(
        "This workout is still open from an earlier day. Finish or end it, and today's workout will be ready when you come back."
      )
    ).toBeOnTheScreen();
  });

  // Reported from a device review: the two set-row field labels were rendering
  // as visible two-line text, doubling every row's height. On the web they are
  // aria-labels only.
  test('§19.3: the set-row field labels are accessible names, never visible text', async () => {
    runtimeApi();
    await renderMemberApp({ initialState: workoutState() });
    await screen.findByTestId('exercise-stage');
    expect(screen.getByLabelText('Weight for set 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Weight unit for set 1')).toBeOnTheScreen();
    expect(screen.queryByText('Weight for set 1')).not.toBeOnTheScreen();
    expect(screen.queryByText('Weight unit for set 1')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Weight unit for set/)).not.toBeOnTheScreen();
  });

  // §19.0: the header and the exercise nav are siblings of the scroll, so the
  // set list moves behind them instead of taking them with it.
  test('§19.0: the session header and exercise nav sit outside the scroll view', async () => {
    runtimeApi();
    await renderMemberApp({ initialState: workoutState() });
    const scroll = await screen.findByTestId('session-scroll');
    expect(within(scroll).queryByTestId('session-exit')).not.toBeOnTheScreen();
    expect(within(scroll).queryByTestId('workout-exercise-nav')).not.toBeOnTheScreen();
    expect(screen.getByTestId('session-exit')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-exercise-nav')).toBeOnTheScreen();
  });

  test('a session started today shows no banner', async () => {
    runtimeApi();
    await renderMemberApp({ initialState: workoutState() });
    await screen.findByTestId('exercise-stage');
    expect(screen.queryByTestId('stale-session-banner')).not.toBeOnTheScreen();
  });
});

describe('logging a set (§20, §21)', () => {
  test('blocks completing without a weight, then clears the message on the next keystroke', async () => {
    const user = userEvent.setup();
    const api = runtimeApi();
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('set-action-201'));
    expect(screen.getByText('Enter a weight before marking this set complete.')).toBeOnTheScreen();
    expect(api.mutations()).toEqual([]);

    await user.type(screen.getByTestId('set-weight-201'), '100');
    expect(screen.queryByText('Enter a weight before marking this set complete.')).not.toBeOnTheScreen();
  });

  test('rejects a non-positive weight', async () => {
    const user = userEvent.setup();
    const api = runtimeApi();
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '0');
    await user.press(screen.getByTestId('set-action-201'));
    expect(screen.getByText('Weight must be greater than 0.')).toBeOnTheScreen();
    expect(api.mutations()).toEqual([]);
  });

  test('sends the target reps, the typed weight and a device completed_at', async () => {
    const user = userEvent.setup();
    const api = runtimeApi({ overrides: { [PATCH_201]: {} } });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));

    const patch = api.mutations()[0];
    expect(patch.url).toBe('/workouts/77/exercises/301/sets/201');
    expect(patch.body).toMatchObject({
      actual_reps: 12,
      actual_weight_value: 100,
      actual_weight_unit: 'lb',
      rest_seconds_actual: 60,
      is_completed: true,
    });
    expect(Date.parse(patch.body.completed_at)).toBeGreaterThan(0);
    // Nothing is optimistic: the full six-call reload follows.
    expect(api.count('GET', '/my-plans/current')).toBe(2);
  });

  test('⚠W19: typing a weight fills that set and every later set of the exercise', async () => {
    const user = userEvent.setup();
    runtimeApi({ current: session({ sets: [set(201, 1), set(202, 2), set(203, 3)] }) });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-202'), '80');
    expect(screen.getByTestId('set-weight-202')).toHaveDisplayValue('80');
    expect(screen.getByTestId('set-weight-203')).toHaveDisplayValue('80');
    // Earlier sets are untouched.
    expect(screen.getByTestId('set-weight-201')).toHaveDisplayValue('');
  });

  test('prefills the weight from the last logged weight for that exercise', async () => {
    runtimeApi({ stats: [{ exercise: { id: 5 }, last_weight_value: 135, last_weight_unit: 'kg' }] });
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByTestId('set-weight-201')).toHaveDisplayValue('135');
    expect(screen.getByLabelText('Weight unit for set 1')).toHaveAccessibilityValue({ text: 'kg' });
  });

  test('un-completing sends is_completed false and a null completed_at, with no validation', async () => {
    const user = userEvent.setup();
    const api = runtimeApi({
      current: session({ sets: [set(201, 1, { completed: true }), set(202, 2)] }),
      overrides: { [PATCH_201]: {} },
    });
    await renderMemberApp({ initialState: workoutState() });
    const undo = await screen.findByTestId('set-action-201');
    expect(undo).toHaveAccessibleName('Undo');
    await user.press(undo);
    expect(api.mutations()[0].body).toMatchObject({ is_completed: false, completed_at: null });
  });

  test('[O9] a failed set update shows the server message and keeps the workout', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: { [PATCH_201]: httpError(409, { success: false, message: 'Workout session is not in progress' }) },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
    expect(screen.getByText('Workout error')).toBeOnTheScreen();
    expect(screen.getByText('Workout session is not in progress')).toBeOnTheScreen();
    expect(screen.queryByText('Request failed with status code 409')).not.toBeOnTheScreen();
    expect(screen.queryByText('Failed to update set.')).not.toBeOnTheScreen();
    expect(screen.getByTestId('exercise-stage')).toBeOnTheScreen();
  });

  test('[O9] a 422 still reads "Validation failed", not the field message', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: httpError(422, {
          success: false,
          message: 'Validation failed',
          errors: { actual_weight_value: ['The actual weight value cannot be negative'] },
        }),
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
    expect(screen.getByText('Validation failed')).toBeOnTheScreen();
    expect(screen.queryByText('The actual weight value cannot be negative')).not.toBeOnTheScreen();
  });

  test('⚠W20: while rest runs, the next set is locked', async () => {
    const user = userEvent.setup();
    runtimeApi({ overrides: { [PATCH_201]: {} } });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
    expect(await screen.findByTestId('rest-timer-expanded')).toBeOnTheScreen();
    expect(screen.getByTestId('set-action-202')).toBeDisabled();
  });
});

describe('rest timer (§22, RN-SPEC-time §7.2 + O4)', () => {
  async function startRest(user) {
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: session() },
          { session: session({ sets: [set(201, 1, { completed: true }), set(202, 2)] }) },
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
    return screen.findByTestId('rest-timer-expanded');
  }

  test('a completed set with planned rest starts the timer and [O4] schedules one notification', async () => {
    const user = userEvent.setup();
    await startRest(user);
    expect(screen.getByTestId('rest-timer-digits')).toHaveTextContent('1:00');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled(); // already granted
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Rest complete',
          body: 'Time for your next set.',
          sound: 'default',
          data: expect.objectContaining({ kind: 'rest-end', source: 'scheduled', setId: 201 }),
        }),
        identifier: 'gymido.rest',
        trigger: expect.objectContaining({ type: 'date' }),
      })
    );
  });

  test('±5s adjusts the countdown and reschedules the notification', async () => {
    const user = userEvent.setup();
    const tray = installNotificationTray();
    await startRest(user);
    await waitFor(() => expect(tray.pendingRestEnd()).toHaveLength(1));
    const [before] = tray.pendingRestEnd();

    await user.press(screen.getByLabelText('Increase rest timer by 5 seconds'));
    expect(screen.getByTestId('rest-timer-digits')).toHaveTextContent('1:05');
    // [O4-A1] replaced, not added: still exactly one, now 5s later.
    await waitFor(() => expect(tray.pendingRestEnd()[0]?.content.data.token).not.toBe(before.content.data.token));
    expect(tray.allRestEnd()).toHaveLength(1);
    expect(tray.pendingRestEnd()[0].trigger.date.getTime() - before.trigger.date.getTime()).toBeGreaterThanOrEqual(4000);

    await user.press(screen.getByLabelText('Decrease rest timer by 5 seconds'));
    expect(screen.getByTestId('rest-timer-digits')).toHaveTextContent('1:00');
  });

  test('skip clears the timer silently and cancels the notification (⚠T10)', async () => {
    const user = userEvent.setup();
    const tray = installNotificationTray();
    await startRest(user);
    await waitFor(() => expect(tray.pendingRestEnd()).toHaveLength(1));
    await user.press(screen.getByTestId('rest-timer-skip'));
    expect(screen.queryByTestId('rest-timer-expanded')).not.toBeOnTheScreen();
    await waitFor(() => expect(tray.allRestEnd()).toHaveLength(0));
    // The next set is unlocked again.
    expect(screen.getByTestId('set-action-202')).toBeEnabled();
  });

  test('un-completing a set clears a running timer', async () => {
    const user = userEvent.setup();
    const api = runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: session() },
          { session: session({ sets: [set(201, 1, { completed: true }), set(202, 2)] }) },
          { session: session() },
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
    await screen.findByTestId('rest-timer-expanded');

    await user.press(screen.getByTestId('set-action-201'));
    expect(screen.queryByTestId('rest-timer-expanded')).not.toBeOnTheScreen();
    expect(api.mutations()).toHaveLength(2);
  });
});

// §22.3: the auto-scroll is driven entirely by highlightedSetKey, and the ring
// is that key made visible — so asserting the ring pins the triggers exactly.
function isHighlighted(setId) {
  const row = screen.getByTestId(`set-row-301:${setId}`);
  const style = Array.isArray(row.props.style)
    ? Object.assign({}, ...row.props.style.flat(Infinity).filter(Boolean))
    : row.props.style;
  return style.borderWidth === 2 && style.borderColor === 'rgba(244,180,0,0.60)';
}

// Lifecycle pairing invariants D and B. Both failed before this was written:
// the Workout screen was keyed on its focus generation, so refocusing a still
// mounted tab remounted the whole runtime — which threw away a running rest and
// its [O4] notification — while isSessionActive never went false on blur, so the
// tab bar stayed hidden over other tabs.
describe('surviving a tab switch (invariants D and B)', () => {
  async function runningRest(user) {
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: session() },
          { session: session({ sets: [set(201, 1, { completed: true }), set(202, 2)] }) },
          { session: session({ sets: [set(201, 1, { completed: true }), set(202, 2)] }) },
        ],
      },
    });
    const rendered = await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
    await screen.findByTestId('rest-timer-expanded');
    return rendered;
  }

  test('D: a running rest survives leaving the tab and coming back', async () => {
    const user = userEvent.setup();
    const { navigation } = await runningRest(user);

    await act(async () => navigation.current.navigate(routes.SettingsTab));
    await act(async () => navigation.current.navigate(routes.WorkoutTab));

    await screen.findByTestId('exercise-stage');
    expect(screen.getByTestId('rest-timer-expanded')).toBeOnTheScreen();
  });

  // §26.1: the one silent refetch in the app. With the runtime no longer
  // remounting, a literal "reset to loading and reload on focus" would throw the
  // skeleton over a live workout and take the rest timer off screen with it.
  test('§26.1: refocusing a running session refetches silently and picks up server changes', async () => {
    const user = userEvent.setup();
    const { navigation } = await runningRest(user);
    const stage = screen.getByTestId('exercise-stage');

    await act(async () => navigation.current.navigate(routes.SettingsTab));
    await act(async () => navigation.current.navigate(routes.WorkoutTab));

    // No skeleton, and the same mounted stage — not a remounted one.
    expect(screen.queryByTestId('workout-skeleton')).not.toBeOnTheScreen();
    expect(screen.getByTestId('exercise-stage')).toBe(stage);
    expect(screen.getByTestId('rest-timer-expanded')).toBeOnTheScreen();
    // The refetch still ran: the third 'GET /workouts/current' reply has set 1
    // completed, and the row reflects it.
    await waitFor(() => expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo'));
  });

  // §26.1 blur table: the runtime survives, the transient overlays do not.
  test('the exercise sheet does not come back open after a tab switch', async () => {
    const user = userEvent.setup();
    const { navigation } = await runningRest(user);
    await user.press(screen.getByTestId('session-show-all'));
    expect(await screen.findByTestId('exercise-sheet')).toBeOnTheScreen();

    await act(async () => navigation.current.navigate(routes.SettingsTab));
    await act(async () => navigation.current.navigate(routes.WorkoutTab));

    await screen.findByTestId('exercise-stage');
    expect(screen.queryByTestId('exercise-sheet')).not.toBeOnTheScreen();
    // …while the rest itself is still running (invariant D).
    expect(screen.getByTestId('rest-timer-expanded')).toBeOnTheScreen();
  });

  test('the discard dialog does not come back open after a tab switch', async () => {
    const user = userEvent.setup();
    const { navigation } = await runningRest(user);
    await user.press(screen.getByTestId('session-exit'));
    expect(await screen.findByTestId('discard-dialog')).toBeOnTheScreen();

    await act(async () => navigation.current.navigate(routes.SettingsTab));
    await act(async () => navigation.current.navigate(routes.WorkoutTab));

    await screen.findByTestId('exercise-stage');
    expect(screen.queryByTestId('discard-dialog')).not.toBeOnTheScreen();
  });

  // [O10] §4 + [O12] §2: session?.id and the skeleton are never on screen
  // together, and a failed silent reload shows the retry bar — not the error
  // screen, and (since O12) not merely a transient toast.
  test('[O12] a failed silent reload keeps the workout on screen and shows the retry bar', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: session() },
          httpError(500, { message: 'Could not refresh the workout.' }),
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));

    const bar = await screen.findByTestId('reload-error-bar');
    expect(within(bar).getByText("Couldn't refresh your workout")).toBeOnTheScreen();
    expect(within(bar).getByText('Your last set was saved. Some details may be out of date.')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise-stage')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-skeleton')).not.toBeOnTheScreen();
  });

  test('[O10] the post-mutation reload never flashes the skeleton over a session', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: session() },
          { session: session({ sets: [set(201, 1, { completed: true }), set(202, 2)] }) },
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');

    const seen = [];
    const stop = setInterval(() => seen.push(Boolean(screen.queryByTestId('workout-skeleton'))), 1);
    await user.press(screen.getByTestId('set-action-201'));
    await screen.findByTestId('rest-timer-expanded');
    clearInterval(stop);

    expect(seen.some(Boolean)).toBe(false);
  });

  test('B: the tab bar is hidden only while the workout is the focused tab', async () => {
    const user = userEvent.setup();
    const { navigation } = await runningRest(user);
    expect(useWorkoutSessionStore.getState().isSessionActive).toBe(true);

    await act(async () => navigation.current.navigate(routes.SettingsTab));
    expect(useWorkoutSessionStore.getState().isSessionActive).toBe(false);

    await act(async () => navigation.current.navigate(routes.WorkoutTab));
    await screen.findByTestId('exercise-stage');
    expect(useWorkoutSessionStore.getState().isSessionActive).toBe(true);
  });
});

// [O12] "Show what the app already knows, and offer a retry." Covers the one
// case where the PATCH succeeded and the reload did not (or not yet): the
// owner's report of set 1 still reading "Did it" while set 2 was also active.
describe('[O12] confirmed writes and the retry bar', () => {
  const DONE_201 = () => session({ sets: [set(201, 1, { completed: true }), set(202, 2)] });
  const FRESH = () => session();

  // A reload the test releases by hand, so the in-between state is observable.
  function heldReload(reply) {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    return { handler: async () => { await gate; return reply; }, release: () => release() };
  }

  async function logSet201(user) {
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
  }

  test('§1: a saved set reads "Undo" before the reload lands, and the header agrees', async () => {
    const user = userEvent.setup();
    const held = heldReload({ session: DONE_201() });
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, held.handler],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);

    // The reload is still in flight, yet the row and the header already agree.
    await waitFor(() => expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo'));
    expect(screen.getByText('1/2 sets done')).toBeOnTheScreen();

    await act(async () => held.release());
    expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo');
  });

  test('§3: the rest timer starts on the PATCH, without waiting for the reload', async () => {
    const user = userEvent.setup();
    const held = heldReload({ session: DONE_201() });
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, held.handler],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);

    // The reload has NOT been released, and the timer is already running.
    expect(await screen.findByTestId('rest-timer-expanded')).toBeOnTheScreen();
    await act(async () => held.release());
  });

  test('§4: "Saving…" ends when the PATCH settles, not when the reload does', async () => {
    const user = userEvent.setup();
    const held = heldReload({ session: DONE_201() });
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, held.handler],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);

    await waitFor(() => expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo'));
    expect(screen.queryByText('Saving…')).not.toBeOnTheScreen();
    await act(async () => held.release());
  });

  test('§3a: a failed reload gates nothing — the set stays completed and the timer runs', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, networkError()],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);

    await screen.findByTestId('reload-error-bar');
    // The overlay keeps the truth the server already accepted.
    expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo');
    expect(screen.getByTestId('rest-timer-expanded')).toBeOnTheScreen();
  });

  test('§2: Retry re-runs the load; a success clears the bar', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, networkError(), { session: DONE_201() }],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);
    await screen.findByTestId('reload-error-bar');

    await user.press(screen.getByTestId('reload-retry'));
    await waitFor(() => expect(screen.queryByTestId('reload-error-bar')).not.toBeOnTheScreen());
    expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo');
  });

  test('§2: a failed Retry changes nothing — same bar, and "Retry" comes back enabled', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, networkError()],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);
    await screen.findByTestId('reload-error-bar');

    await user.press(screen.getByTestId('reload-retry'));
    await waitFor(() => expect(screen.getByTestId('reload-retry')).toHaveAccessibleName('Retry'));
    expect(screen.getByTestId('reload-retry')).toBeEnabled();
    expect(within(screen.getByTestId('reload-error-bar')).getByText("Couldn't refresh your workout")).toBeOnTheScreen();
  });

  test('§1: when the server disagrees, the server wins and the athlete is told why', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        // The reload says set 1 is NOT completed after all.
        'GET /workouts/current': [{ session: FRESH() }, { session: FRESH() }],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);

    expect(await screen.findByText("That set didn't save after all. Tap it again.")).toBeOnTheScreen();
    expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Did it');
  });

  test('§1: when the server agrees, there is no message', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [{ session: FRESH() }, { session: DONE_201() }],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);
    await screen.findByTestId('rest-timer-expanded');
    expect(screen.queryByText("That set didn't save after all. Tap it again.")).not.toBeOnTheScreen();
  });

  // §3a — the spec's likeliest explanation for the owner's report. Two reloads
  // overlap WITHIN ONE FOCUS and land newest-then-older; the older payload is
  // genuinely pre-PATCH. Without the per-load generation guard it would commit
  // last and put "Did it" back. (Across a refocus, invariant C's focus guard
  // already catches it — which is why this must be two post-mutation reloads.)
  test('§3a: an older reload that lands after a newer one is discarded', async () => {
    const user = userEvent.setup();
    // No rest, so set 2 unlocks straight away — from the OVERLAY, since reload
    // #1 is still in flight when it does.
    const noRest = (done1, done2) =>
      session({
        sets: [
          set(201, 1, { rest: 0, completed: done1 }),
          set(202, 2, { rest: 0, completed: done2 }),
          // A third set keeps the workout unfinished, so no completion popup.
          set(203, 3, { rest: 0 }),
        ],
      });
    // Reload #1 is SLOW rather than held open indefinitely: a promise that never
    // settles stalls the test harness's act(), which no real user would hit.
    // 400ms is enough for reload #2 to be issued and commit first.
    const slowStale = () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ session: noRest(false, false) }), 400);
      });
    runtimeApi({
      overrides: {
        [PATCH_201]: {},
        'PATCH /workouts/77/exercises/301/sets/202': {},
        'GET /workouts/current': [{ session: noRest(false, false) }, slowStale, { session: noRest(true, true) }],
      },
    });
    await renderMemberApp({ initialState: workoutState() });

    await logSet201(user); // PATCH 201 → reload #1 (slow, pre-PATCH data)
    await waitFor(() => expect(screen.getByTestId('set-action-202')).toBeEnabled());
    await user.press(screen.getByTestId('set-action-202')); // PATCH 202 → reload #2, commits first
    await waitFor(() => expect(screen.getByTestId('set-action-202')).toHaveAccessibleName('Undo'));

    // Let reload #1 finally land. It is older, so it must not win.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Undo');
    expect(screen.getByTestId('set-action-202')).toHaveAccessibleName('Undo');
    expect(screen.queryByText("That set didn't save after all. Tap it again.")).not.toBeOnTheScreen();
  });

  test('§1: a failed PATCH advances nothing and records nothing', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        [PATCH_201]: httpError(500, { message: 'Could not save the set.' }),
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await logSet201(user);

    expect(await screen.findByText('Could not save the set.')).toBeOnTheScreen();
    expect(screen.getByTestId('set-action-201')).toHaveAccessibleName('Did it');
    expect(screen.queryByTestId('rest-timer-expanded')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('reload-error-bar')).not.toBeOnTheScreen();
  });
});

describe('auto-scroll to the next set (§22.3)', () => {
  const COMPLETED_FIRST = () => session({ sets: [set(201, 1, { completed: true, rest: 1 }), set(202, 2)] });

  async function completeFirstSet(user, { rest = 1 } = {}) {
    runtimeApi({
      current: session({ sets: [set(201, 1, { rest }), set(202, 2)] }),
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: session({ sets: [set(201, 1, { rest }), set(202, 2)] }) },
          { session: COMPLETED_FIRST() },
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-201'), '100');
    await user.press(screen.getByTestId('set-action-201'));
  }

  test('a rest reaching 0 naturally targets the next set', async () => {
    const user = userEvent.setup();
    await completeFirstSet(user, { rest: 1 });
    await screen.findByTestId('rest-timer-expanded');
    expect(isHighlighted(202)).toBe(false);

    await waitFor(() => expect(screen.queryByTestId('rest-timer-expanded')).not.toBeOnTheScreen(), {
      timeout: 4000,
    });
    expect(isHighlighted(202)).toBe(true);
  });

  test('Skip rest targets the next set', async () => {
    const user = userEvent.setup();
    await completeFirstSet(user, { rest: 60 });
    await screen.findByTestId('rest-timer-expanded');
    await user.press(screen.getByTestId('rest-timer-skip'));
    expect(isHighlighted(202)).toBe(true);
  });

  test('completing a set with no rest at all targets the next set', async () => {
    const user = userEvent.setup();
    await completeFirstSet(user, { rest: 0 });
    expect(screen.queryByTestId('rest-timer-expanded')).not.toBeOnTheScreen();
    await waitFor(() => expect(isHighlighted(202)).toBe(true));
  });

  test('⚠T10: stepping −5s down to 0 ends the rest silently and targets nothing', async () => {
    const user = userEvent.setup();
    await completeFirstSet(user, { rest: 5 });
    await screen.findByTestId('rest-timer-expanded');
    await user.press(screen.getByLabelText('Decrease rest timer by 5 seconds'));
    await waitFor(() => expect(screen.queryByTestId('rest-timer-expanded')).not.toBeOnTheScreen());
    expect(isHighlighted(202)).toBe(false);
  });

  test('un-doing a set targets nothing', async () => {
    const user = userEvent.setup();
    runtimeApi({
      current: COMPLETED_FIRST(),
      overrides: {
        [PATCH_201]: {},
        'GET /workouts/current': [
          { session: COMPLETED_FIRST() },
          { session: session({ sets: [set(201, 1, { rest: 1 }), set(202, 2)] }) },
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('set-action-201'));
    await waitFor(() => expect(screen.getByTestId('set-action-201')).toBeEnabled());
    expect(isHighlighted(202)).toBe(false);
  });
});

describe('completing and discarding (§23, §24)', () => {
  test('⚠W13: completing the last set auto-completes and shows the popup snapshot', async () => {
    const user = userEvent.setup();
    const done = session({ sets: [set(201, 1, { completed: true }), set(202, 2, { completed: true })] });
    runtimeApi({
      current: session({ sets: [set(201, 1, { completed: true }), set(202, 2, { rest: 0 })] }),
      overrides: {
        'PATCH /workouts/77/exercises/301/sets/202': {},
        'POST /workouts/77/complete': {},
        'GET /workouts/current': [
          { session: session({ sets: [set(201, 1, { completed: true }), set(202, 2, { rest: 0 })] }) },
          { session: done },
          { session: null },
        ],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.type(await screen.findByTestId('set-weight-202'), '100');
    await user.press(screen.getByTestId('set-action-202'));

    const popup = await screen.findByTestId('completion-popup');
    expect(within(popup).getByText('Great job!')).toBeOnTheScreen();
    expect(within(popup).getByText('You finished Strength Base and kept your momentum today.')).toBeOnTheScreen();
    expect(within(popup).getByText('2/2 sets done. Consistency wins.')).toBeOnTheScreen();
    // ⚠W15: volume is unit-blind and labelled lb.
    expect(within(popup).getByText('2,400 lb')).toBeOnTheScreen();
    // The session is gone, so the popup sits over the hub.
    expect(await screen.findByTestId('today-hero-card')).toBeOnTheScreen();

    await user.press(within(popup).getByTestId('completion-dismiss'));
    expect(screen.queryByTestId('completion-popup')).not.toBeOnTheScreen();
  });

  test('[O9] a failed completion keeps the session on screen', async () => {
    const user = userEvent.setup();
    runtimeApi({
      overrides: {
        'POST /workouts/77/complete': httpError(409, { success: false, message: 'Workout session is not in progress' }),
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('complete-workout'));
    expect(screen.getByText('Workout session is not in progress')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise-stage')).toBeOnTheScreen();
    expect(screen.queryByTestId('completion-popup')).not.toBeOnTheScreen();
  });

  test('discard asks once, then abandons and returns to the hub', async () => {
    const user = userEvent.setup();
    const api = runtimeApi({
      overrides: {
        'POST /workouts/77/abandon': {},
        'GET /workouts/current': [{ session: session() }, { session: null }],
      },
    });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('session-exit'));
    const dialog = screen.getByTestId('discard-dialog');
    expect(within(dialog).getByText('Discard this workout?')).toBeOnTheScreen();
    expect(
      within(dialog).getByText("Your progress won't be saved and this session will be discarded.")
    ).toBeOnTheScreen();

    // "Keep going" leaves the session alone.
    await user.press(within(dialog).getByTestId('discard-keep-going'));
    expect(screen.queryByTestId('discard-dialog')).not.toBeOnTheScreen();
    expect(api.mutations()).toEqual([]);

    await user.press(screen.getByTestId('discard-workout'));
    await user.press(screen.getByTestId('discard-confirm'));
    expect(api.mutations().map((call) => call.url)).toEqual(['/workouts/77/abandon']);
    expect(await screen.findByTestId('today-hero-card')).toBeOnTheScreen();
    expect(useWorkoutSessionStore.getState().isSessionActive).toBe(false);
  });

  test('[O9] a failed discard shows the server message and keeps the session', async () => {
    const user = userEvent.setup();
    runtimeApi({ overrides: { 'POST /workouts/77/abandon': networkError() } });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('discard-workout'));
    await user.press(screen.getByTestId('discard-confirm'));
    expect(screen.getByText('Network Error')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise-stage')).toBeOnTheScreen();
  });
});

describe('navigation between exercises (§19.4–§19.8)', () => {
  const twoExercises = () =>
    session({
      exercises: [
        {
          id: 301,
          exercise_name_snapshot: 'Bench Press',
          exercise: { id: 5, name: 'Bench Press', primary_muscle_group: { name: 'Chest' } },
          sets: [set(201, 1)],
        },
        {
          id: 302,
          exercise_name_snapshot: 'Row',
          exercise: { id: 6, name: 'Row', primary_muscle_group: { name: 'Back' } },
          sets: [set(211, 1), set(212, 2)],
        },
      ],
    });

  test('Up next jumps to the later exercise and shows the browsing bar', async () => {
    const user = userEvent.setup();
    runtimeApi({ current: twoExercises() });
    await renderMemberApp({ initialState: workoutState() });
    const upNext = await screen.findByTestId('up-next-card');
    expect(within(upNext).getByText('Row')).toBeOnTheScreen();
    expect(within(upNext).getByText('2 sets left · Back')).toBeOnTheScreen();

    await user.press(upNext);
    const stage = screen.getByTestId('exercise-stage');
    expect(within(stage).getByText('Exercise 2 of 2')).toBeOnTheScreen();
    expect(within(stage).getByText('Row')).toBeOnTheScreen();
    expect(screen.getByTestId('browsing-bar')).toBeOnTheScreen();

    await user.press(screen.getByTestId('browsing-resume'));
    expect(within(screen.getByTestId('exercise-stage')).getByText('Current exercise')).toBeOnTheScreen();
    expect(screen.queryByTestId('browsing-bar')).not.toBeOnTheScreen();
  });

  test('the sheet lists exercises, filters by muscle and keeps the filter (⚠W22)', async () => {
    const user = userEvent.setup();
    runtimeApi({ current: twoExercises() });
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByTestId('session-show-all'));
    const sheet = screen.getByTestId('exercise-sheet');
    expect(within(sheet).getByText('All Exercises')).toBeOnTheScreen();

    // By testID: the muscle name now also appears on the card itself.
    await user.press(within(sheet).getByTestId('sheet-chip-Back'));
    expect(within(sheet).queryByTestId('sheet-exercise-301')).not.toBeOnTheScreen();
    await user.press(within(sheet).getByTestId('sheet-exercise-302'));
    expect(screen.queryByTestId('exercise-sheet')).not.toBeOnTheScreen();
    expect(within(screen.getByTestId('exercise-stage')).getByText('Row')).toBeOnTheScreen();

    // Reopening keeps the "Back" filter.
    await user.press(screen.getByTestId('session-show-all'));
    expect(within(screen.getByTestId('exercise-sheet')).queryByTestId('sheet-exercise-301')).not.toBeOnTheScreen();
  });

  // §19.7 full anatomy. The owner's review found the sheet was a plain text
  // list; these pin the card contents that replaced it.
  describe('the sheet is a card list (§19.7)', () => {
    const sheet = () => screen.getByTestId('exercise-sheet');

    async function openSheet(current) {
      const user = userEvent.setup();
      runtimeApi({ current });
      await renderMemberApp({ initialState: workoutState() });
      await user.press(await screen.findByTestId('session-show-all'));
      return user;
    }

    test('each card carries the name, muscle, completed/total count and a sets chip', async () => {
      await openSheet(twoExercises());
      const card = within(sheet()).getByTestId('sheet-exercise-302');
      expect(within(card).getByText('Row')).toBeOnTheScreen();
      expect(within(card).getByText('Back')).toBeOnTheScreen();
      // Completed sets over total sets — never exercises, never reps.
      expect(within(card).getByTestId('sheet-count-302')).toHaveTextContent('0/2');
      expect(within(card).getByText('2 Sets')).toBeOnTheScreen();
      // Singular only at exactly 1.
      expect(within(within(sheet()).getByTestId('sheet-exercise-301')).getByText('1 Set')).toBeOnTheScreen();
    });

    test('the three button states are Resume, Go and View', async () => {
      await openSheet(
        session({
          exercises: [
            {
              id: 301,
              exercise_name_snapshot: 'Bench Press',
              exercise: { id: 5, name: 'Bench Press', primary_muscle_group: { name: 'Chest' } },
              sets: [set(201, 1, { completed: true })],
            },
            {
              id: 302,
              exercise_name_snapshot: 'Row',
              exercise: { id: 6, name: 'Row', primary_muscle_group: { name: 'Back' } },
              sets: [set(211, 1)],
            },
            {
              id: 303,
              exercise_name_snapshot: 'Curl',
              exercise: { id: 7, name: 'Curl', primary_muscle_group: { name: 'Arms' } },
              sets: [set(221, 1)],
            },
          ],
        })
      );
      // 301 is finished → View; 302 is the active exercise → Resume; 303 → Go.
      expect(within(sheet()).getByTestId('sheet-action-301')).toHaveAccessibleName('View');
      expect(within(sheet()).getByTestId('sheet-action-302')).toHaveAccessibleName('Resume');
      expect(within(sheet()).getByTestId('sheet-action-303')).toHaveAccessibleName('Go');
    });

    test('the gold highlight follows the ACTIVE exercise, not the one being browsed', async () => {
      const user = await openSheet(twoExercises());
      // Browse the second exercise, then reopen the sheet.
      await user.press(within(sheet()).getByTestId('sheet-exercise-302'));
      await user.press(screen.getByTestId('session-show-all'));
      // 301 still has the incomplete set, so it stays current.
      expect(within(sheet()).getByTestId('sheet-action-301')).toHaveAccessibleName('Resume');
      expect(within(sheet()).getByTestId('sheet-action-302')).toHaveAccessibleName('Go');
    });

    test('pressing the button selects the exercise and closes, exactly like the card', async () => {
      const user = await openSheet(twoExercises());
      await user.press(within(sheet()).getByTestId('sheet-action-302'));
      expect(screen.queryByTestId('exercise-sheet')).not.toBeOnTheScreen();
      expect(within(screen.getByTestId('exercise-stage')).getByText('Row')).toBeOnTheScreen();
    });

    test('badge numbers keep their session positions when a filter hides earlier exercises', async () => {
      const user = await openSheet(twoExercises());
      await user.press(within(sheet()).getByTestId('sheet-chip-Back'));
      // Row is the SECOND exercise, so its badge reads 2 even though it is the
      // only card left.
      expect(within(within(sheet()).getByTestId('sheet-badge-302')).getByText('2')).toBeOnTheScreen();
    });
  });
});
