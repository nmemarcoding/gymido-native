import { screen, userEvent, within } from '@testing-library/react-native';

import { routes } from '../../../navigation/routes';
import { formatDateForInput } from '../../../shared/utils/timestamps';
import { httpError, mockApi, networkError } from '../../../test/mockApi';
import {
  currentPlan,
  day,
  daysList,
  enrollmentCreated,
  exercise,
  exercisesList,
  NOT_FOUND_CURRENT,
  planDetail,
  planItem,
  scheduleSaved,
  TRAINER_LOCK,
} from '../../../test/planFixtures';
import { focusedPath, planDetailState, renderMemberApp } from '../../../test/renderMemberApp';

const DAYS = [day(11, 1, 'Full Body A', 3), day(12, 2, 'Full Body B', 3), day(13, 3, 'Full Body C', 3)];
const NO_ENROLLMENT = { 'GET /my-plans/current': httpError(404, NOT_FOUND_CURRENT) };

function planThreeApi(overrides = {}) {
  return {
    'GET /plans/3': planDetail({ id: 3, name: 'Strength Base', days_per_week: 3 }),
    'GET /plans/3/days': daysList(DAYS),
    'GET /plans/3/days/11/exercises': exercisesList([
      exercise(1, { name: 'Goblet Squat', code: 'LEGS', group: 'Legs', summary: { set_count: 3, target_reps_min: 8, target_reps_max: 12 } }),
      exercise(2, { name: 'Romanian Deadlift', code: 'HAMSTRINGS', group: 'Hamstrings', summary: { set_count: 1, target_reps_min: 8 } }),
    ]),
    'GET /plans/3/days/12/exercises': exercisesList([exercise(3, { name: 'Row', summary: { set_count: 2, target_reps_max: 10 } })]),
    'GET /plans/3/days/13/exercises': exercisesList([]),
    ...NO_ENROLLMENT,
    ...overrides,
  };
}

async function openPlan(planId = '3') {
  const rendered = await renderMemberApp({ initialState: planDetailState(planId) });
  return rendered;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('S2 load (RN-SPEC-plans §4.2)', () => {
  test('shows "Loading plan" first', async () => {
    mockApi({ ...planThreeApi(), 'GET /plans/3': () => new Promise(() => {}) });
    await openPlan();
    expect(screen.getByText('Loading plan')).toBeOnTheScreen();
  });

  test('phase 1 in parallel, then one exercises request per day (3 + days calls)', async () => {
    const api = mockApi(planThreeApi());
    await openPlan();
    await screen.findByText('Strength Base');
    expect(api.calls.map((call) => call.url)).toEqual([
      '/plans/3',
      '/plans/3/days',
      '/my-plans/current',
      '/plans/3/days/11/exercises',
      '/plans/3/days/12/exercises',
      '/plans/3/days/13/exercises',
    ]);
  });

  test('summary card: eyebrow, name, description, stats and pill', async () => {
    mockApi(planThreeApi());
    await openPlan();
    const card = await screen.findByTestId('summary-card');
    expect(within(card).getByText('Build Muscle')).toBeOnTheScreen();
    expect(within(card).getByRole('header', { name: 'Strength Base' })).toBeOnTheScreen();
    expect(within(card).getByText(/^Simple full-body/)).toHaveProp('numberOfLines', 3);
    expect(within(card).getByText('Days')).toBeOnTheScreen();
    // Days = 3 (days_per_week) and Exercises = 2 + 1 + 0 = 3.
    expect(within(card).getAllByText('3')).toHaveLength(2);
    expect(within(card).getByText('Exercises')).toBeOnTheScreen();
    expect(within(card).getByText('Beginner')).toBeOnTheScreen();
    expect(within(card).getByText('3× / week')).toBeOnTheScreen();
    expect(screen.getByText('Workout days')).toBeOnTheScreen();
    expect(screen.queryByText('Current plan')).not.toBeOnTheScreen();
  });

  test('⚠12: "Days" and the pill use days_per_week, not the day rows', async () => {
    mockApi(planThreeApi({ 'GET /plans/3': planDetail({ id: 3, days_per_week: 5, difficulty_level: undefined }) }));
    await openPlan();
    const card = await screen.findByTestId('summary-card');
    expect(within(card).getByText('5× / week')).toBeOnTheScreen();
    expect(within(card).getByText('5')).toBeOnTheScreen();
    expect(within(card).getByText('—')).toBeOnTheScreen();
    // Three rows are still rendered.
    expect(screen.getAllByTestId(/^day-row-/)).toHaveLength(3);
  });

  test('failed exercise calls become empty days; the page still renders', async () => {
    mockApi(planThreeApi({ 'GET /plans/3/days/11/exercises': networkError() }));
    await openPlan();
    expect(await screen.findByText('No exercises were returned for Full Body A.')).toBeOnTheScreen();
  });

  test('private trainer plan: the GET /plans/{id} 404 is absorbed and the enrollment copy is used', async () => {
    const privatePlan = planItem({ id: 3, name: 'Coach Block', days_per_week: 3 });
    mockApi(
      planThreeApi({
        'GET /plans/3': httpError(404, { success: false, message: 'Workout plan not found' }),
        'GET /my-plans/current': currentPlan({ plan: privatePlan, weekdayIds: [2, 4, 6] }),
      })
    );
    await openPlan();
    expect(await screen.findByRole('header', { name: 'Coach Block' })).toBeOnTheScreen();
    expect(screen.getByText('Current plan')).toBeOnTheScreen();
    expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
    expect(screen.getByText('Selected: Tue, Thu, Sat')).toBeOnTheScreen();
  });

  test.each([401, 403])('current plan %s is treated as no enrollment', async (status) => {
    mockApi(planThreeApi({ 'GET /my-plans/current': httpError(status, { success: false }) }));
    await openPlan();
    expect(await screen.findByText('START WORKOUT PLAN')).toBeOnTheScreen();
  });
});

describe('S2 day accordion (§4.4)', () => {
  test('the first day starts open; one open at a time; the open row closes', async () => {
    const user = userEvent.setup();
    mockApi(planThreeApi());
    await openPlan();
    await screen.findByText('Goblet Squat');

    const header = (title) => screen.getByRole('button', { name: new RegExp(title) });
    expect(header('Full Body A')).toBeExpanded();
    expect(header('Full Body B')).toBeCollapsed();

    await user.press(header('Full Body B'));
    expect(header('Full Body A')).toBeCollapsed();
    expect(header('Full Body B')).toBeExpanded();
    expect(screen.queryByText('Goblet Squat')).not.toBeOnTheScreen();
    expect(screen.getByText('Row')).toBeOnTheScreen();

    await user.press(header('Full Body B'));
    expect(header('Full Body B')).toBeCollapsed();
    expect(screen.queryByText('Row')).not.toBeOnTheScreen();
  });

  test('row meta, focus chips and set summaries', async () => {
    mockApi(planThreeApi());
    await openPlan();
    // 3 + 1 sets = 4 × 3.5 = 14 → 15 min.
    expect(await screen.findByText('2 exercises · ~15 min')).toBeOnTheScreen();
    expect(screen.getByText('1 exercise · ~10 min')).toBeOnTheScreen();
    expect(screen.getByText('0 exercises')).toBeOnTheScreen();
    expect(screen.getByText('Legs')).toBeOnTheScreen();
    expect(screen.getByText('Hamstrings')).toBeOnTheScreen();
    expect(screen.getByText('3 sets × 8-12 reps')).toBeOnTheScreen();
    // ⚠15.
    expect(screen.getByText('1 sets × 8 reps')).toBeOnTheScreen();
  });

  test('⚠11: the muscle code shows raw, single line, no shrink or ellipsis', async () => {
    mockApi(planThreeApi());
    await openPlan();
    const code = await screen.findByText('HAMSTRINGS');
    expect(code).toHaveProp('numberOfLines', 1);
    expect(code).not.toHaveProp('adjustsFontSizeToFit');
    expect(code).not.toHaveProp('ellipsizeMode');
  });

  test('"EX" when the exercise has no muscle group; "Reps open" for a max-only target', async () => {
    const user = userEvent.setup();
    mockApi(planThreeApi());
    await openPlan();
    await user.press(await screen.findByRole('button', { name: /Full Body B/ }));
    expect(screen.getByText('EX')).toBeOnTheScreen();
    expect(screen.getByText('2 sets × Reps open')).toBeOnTheScreen();
  });

  test('empty day message uses the title, or "this day"', async () => {
    const user = userEvent.setup();
    mockApi(
      planThreeApi({
        'GET /plans/3/days': daysList([day(11, 1, 'Full Body A', 3), day(14, 2, undefined, 3)]),
        'GET /plans/3/days/14/exercises': exercisesList([]),
      })
    );
    await openPlan();
    await user.press(await screen.findByRole('button', { name: /Day 2/ }));
    expect(screen.getByText('No exercises were returned for this day.')).toBeOnTheScreen();
  });
});

describe('S2 schedule card (§4.6)', () => {
  test('not enrolled: start copy, first N weekdays preselected', async () => {
    mockApi(planThreeApi());
    await openPlan();
    expect(await screen.findByText('Start this plan')).toBeOnTheScreen();
    expect(screen.getByText('Pick 3 workout days')).toBeOnTheScreen();
    expect(
      screen.getByText('Choose the weekdays to train. Activating this plan replaces any current active plan.')
    ).toBeOnTheScreen();
    expect(screen.getByText('Selected: Mon, Tue, Wed')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mon' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Thu' })).not.toBeSelected();
  });

  test('weekday rules: remove, add sorted, silent no-op when full (⚠14)', async () => {
    const user = userEvent.setup();
    mockApi(planThreeApi());
    await openPlan();
    await screen.findByText('Selected: Mon, Tue, Wed');

    await user.press(screen.getByRole('button', { name: 'Fri' }));
    expect(screen.getByText('Selected: Mon, Tue, Wed')).toBeOnTheScreen();
    expect(screen.queryByTestId('toast-error')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Tue' }));
    await user.press(screen.getByRole('button', { name: 'Fri' }));
    expect(screen.getByText('Selected: Mon, Wed, Fri')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Mon' }));
    await user.press(screen.getByRole('button', { name: 'Wed' }));
    await user.press(screen.getByRole('button', { name: 'Fri' }));
    expect(screen.getByText('Selected: None yet')).toBeOnTheScreen();
  });

  test('validation: wrong count shows the toast and sends nothing', async () => {
    const user = userEvent.setup();
    const api = mockApi(planThreeApi());
    await openPlan();
    await user.press(await screen.findByRole('button', { name: 'Tue' }));
    await user.press(screen.getByText('START WORKOUT PLAN'));
    expect(screen.getByText('Plan activation failed')).toBeOnTheScreen();
    expect(screen.getByText('Select 3 workout days to continue.')).toBeOnTheScreen();
    expect(api.mutations()).toEqual([]);
  });

  test('singular copy when N = 1', async () => {
    const user = userEvent.setup();
    mockApi(planThreeApi({ 'GET /plans/3': planDetail({ id: 3, days_per_week: 1 }) }));
    await openPlan();
    expect(await screen.findByText('Pick 1 workout day')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Mon' }));
    await user.press(screen.getByText('START WORKOUT PLAN'));
    expect(screen.getByText('Select 1 workout day to continue.')).toBeOnTheScreen();
  });
});

describe('S2 submit flow (§4.7)', () => {
  test('start with no enrollment: POST /my-plans (UTC date) → POST schedule → Workout tab, S2 replaced', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      planThreeApi({
        'POST /my-plans': enrollmentCreated(40, 3),
        'POST /my-plans/40/schedule': scheduleSaved(40),
        'GET /plans/1/days': daysList([]),
      })
    );
    const { navigation } = await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));

    expect(api.mutations()).toEqual([
      { method: 'POST', url: '/my-plans', body: { workout_plan_id: 3, started_on: formatDateForInput(new Date()) } },
      {
        method: 'POST',
        url: '/my-plans/40/schedule',
        body: {
          items: [
            { workout_plan_day_id: 11, weekday_id: 1 },
            { workout_plan_day_id: 12, weekday_id: 2 },
            { workout_plan_day_id: 13, weekday_id: 3 },
          ],
        },
      },
    ]);
    expect(focusedPath(navigation.current.getRootState())).toEqual([routes.WorkoutTab]);
    expect(navigation.current.getCurrentRoute().params).toEqual({ message: 'Strength Base activated.' });
    const library = navigation.current.getRootState().routes.find((route) => route.name === routes.LibraryTab);
    expect(library.state.routes.map((route) => route.name)).toEqual([routes.PlansList]);
  });

  test('switch: cancel → create → schedule, in that order', async () => {
    const user = userEvent.setup();
    const other = planItem({ id: 1, name: 'Old Plan' });
    const api = mockApi(
      planThreeApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: other, weekdayIds: [1] }),
        'POST /my-plans/31/cancel': { enrollment: { id: 31, status: 'cancelled' } },
        'POST /my-plans': enrollmentCreated(41, 3),
        'POST /my-plans/41/schedule': scheduleSaved(41),
        'GET /plans/1/days': daysList([]),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(api.mutations().map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /my-plans/31/cancel',
      'POST /my-plans',
      'POST /my-plans/41/schedule',
    ]);
  });

  test('a schedule POST 409 retries with PUT', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      planThreeApi({
        'POST /my-plans': enrollmentCreated(42, 3),
        'POST /my-plans/42/schedule': httpError(409, { success: false, message: 'Plan schedule already exists' }),
        'PUT /my-plans/42/schedule': scheduleSaved(42),
        'GET /plans/1/days': daysList([]),
      })
    );
    const { navigation } = await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(api.mutations().map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /my-plans',
      'POST /my-plans/42/schedule',
      'PUT /my-plans/42/schedule',
    ]);
    expect(navigation.current.getCurrentRoute().name).toBe(routes.WorkoutTab);
  });

  test('enrollment id falls back to data.id', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      planThreeApi({
        'POST /my-plans': { id: 55 },
        'POST /my-plans/55/schedule': scheduleSaved(55),
        'GET /plans/1/days': daysList([]),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(api.mutations()[1].url).toBe('/my-plans/55/schedule');
  });

  test('current plan: "UPDATE SCHEDULE" sends PUT only (never cancel)', async () => {
    const user = userEvent.setup();
    const plan = planItem({ id: 3, name: 'Strength Base', days_per_week: 3 });
    const api = mockApi(
      planThreeApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan, weekdayIds: [5, 1, 3] }),
        'PUT /my-plans/31/schedule': scheduleSaved(31),
        'GET /plans/1/days': daysList([]),
      })
    );
    const { navigation } = await openPlan();
    expect(await screen.findByText('Current plan')).toBeOnTheScreen();
    expect(screen.getByText('Schedule')).toBeOnTheScreen();
    expect(screen.getByText('Your training days')).toBeOnTheScreen();
    expect(
      screen.getByText('These are the 3 days you train on. Adjust them and tap update to reschedule.')
    ).toBeOnTheScreen();
    expect(screen.getByText('Selected: Mon, Wed, Fri')).toBeOnTheScreen();

    await user.press(screen.getByText('UPDATE SCHEDULE'));
    expect(api.mutations()).toEqual([
      {
        method: 'PUT',
        url: '/my-plans/31/schedule',
        body: {
          items: [
            { workout_plan_day_id: 11, weekday_id: 1 },
            { workout_plan_day_id: 12, weekday_id: 3 },
            { workout_plan_day_id: 13, weekday_id: 5 },
          ],
        },
      },
    ]);
    expect(navigation.current.getCurrentRoute().params).toEqual({ message: 'Strength Base schedule updated.' });
  });

  test('trainer lock: cancel 409 → server message, banner, disabled CTA (⚠9)', async () => {
    const user = userEvent.setup();
    const other = planItem({ id: 1, name: 'Coach Plan' });
    const api = mockApi(
      planThreeApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: other, weekdayIds: [1] }),
        'POST /my-plans/31/cancel': httpError(409, TRAINER_LOCK),
      })
    );
    const { navigation } = await openPlan();

    // Nothing hints at the lock before the attempt.
    const cta = await screen.findByRole('button', { name: /START WORKOUT PLAN/ });
    expect(cta).toBeEnabled();
    expect(screen.queryByTestId('trainer-lock-banner')).not.toBeOnTheScreen();

    await user.press(screen.getByText('START WORKOUT PLAN'));
    expect(screen.getByText('Plan activation failed')).toBeOnTheScreen();
    expect(screen.getByText('This plan is managed by your trainer and cannot be changed')).toBeOnTheScreen();
    expect(screen.getByText('This plan is managed by your trainer')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /START WORKOUT PLAN/ })).toBeDisabled();
    expect(api.mutations().map((call) => call.url)).toEqual(['/my-plans/31/cancel']);

    // Weekday chips stay tappable (⚠14).
    expect(screen.getByRole('button', { name: 'Thu' })).toBeEnabled();

    // "My trainer" goes to the Trainer tab.
    await user.press(screen.getByText('My trainer'));
    expect(navigation.current.getCurrentRoute().name).toBe(routes.TrainerTab);
  });

  test('trainer lock is forgotten on the next focus', async () => {
    const user = userEvent.setup();
    const other = planItem({ id: 1, name: 'Coach Plan' });
    mockApi(
      planThreeApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: other, weekdayIds: [1] }),
        'POST /my-plans/31/cancel': httpError(409, TRAINER_LOCK),
      })
    );
    const { navigation } = await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    await user.press(screen.getByText('My trainer'));
    navigation.current.goBack();
    expect(await screen.findByText('START WORKOUT PLAN')).toBeOnTheScreen();
    expect(screen.queryByTestId('trainer-lock-banner')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /START WORKOUT PLAN/ })).toBeEnabled();
  });

  test('rescheduling never calls cancel, so the trainer lock cannot block it', async () => {
    const user = userEvent.setup();
    const plan = planItem({ id: 3, name: 'Strength Base', days_per_week: 3 });
    const api = mockApi(
      planThreeApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan, weekdayIds: [1, 3, 5] }),
        'PUT /my-plans/31/schedule': scheduleSaved(31),
        'GET /plans/1/days': daysList([]),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('UPDATE SCHEDULE'));
    expect(api.mutations().map((call) => `${call.method} ${call.url}`)).toEqual(['PUT /my-plans/31/schedule']);
  });

  test('⚠3: a 422 reads "Validation failed"', async () => {
    const user = userEvent.setup();
    mockApi(
      planThreeApi({
        'POST /my-plans': enrollmentCreated(43, 3),
        'POST /my-plans/43/schedule': httpError(422, {
          success: false,
          message: 'Validation failed',
          errors: { items: ['schedule item count must match the saved plan day count'] },
        }),
      })
    );
    const { navigation } = await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(screen.getByText('Validation failed')).toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().name).toBe(routes.PlanDetail);
    // The CTA is usable again.
    expect(screen.getByRole('button', { name: /START WORKOUT PLAN/ })).toBeEnabled();
  });

  test('⚠1: days_per_week < saved days sends only the first N days', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      planThreeApi({
        'GET /plans/3': planDetail({ id: 3, days_per_week: 2 }),
        'POST /my-plans': enrollmentCreated(44, 3),
        'POST /my-plans/44/schedule': httpError(422, { success: false, message: 'Validation failed' }),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(api.mutations()[1].body).toEqual({
      items: [
        { workout_plan_day_id: 11, weekday_id: 1 },
        { workout_plan_day_id: 12, weekday_id: 2 },
      ],
    });
    expect(screen.getByText('Validation failed')).toBeOnTheScreen();
  });

  test('⚠1: days_per_week > saved days pairs only the saved days', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      planThreeApi({
        'GET /plans/3': planDetail({ id: 3, days_per_week: 4 }),
        'POST /my-plans': enrollmentCreated(45, 3),
        'POST /my-plans/45/schedule': scheduleSaved(45),
        'GET /plans/1/days': daysList([]),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(api.mutations()[1].body.items).toHaveLength(3);
  });

  test('⚠2: create fails after the cancel → no rollback, message shown', async () => {
    const user = userEvent.setup();
    const other = planItem({ id: 1 });
    const api = mockApi(
      planThreeApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: other }),
        'POST /my-plans/31/cancel': { enrollment: { id: 31, status: 'cancelled' } },
        'POST /my-plans': httpError(500, { success: false, message: 'db down' }),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(screen.getByText('db down')).toBeOnTheScreen();
    expect(api.mutations().map((call) => call.url)).toEqual(['/my-plans/31/cancel', '/my-plans']);
  });

  test('a create 409 shows the server message', async () => {
    const user = userEvent.setup();
    mockApi(
      planThreeApi({
        'POST /my-plans': httpError(409, { success: false, message: 'An active plan enrollment already exists' }),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(screen.getByText('An active plan enrollment already exists')).toBeOnTheScreen();
  });

  test('a network failure shows the transport message', async () => {
    const user = userEvent.setup();
    mockApi(planThreeApi({ 'POST /my-plans': networkError() }));
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(screen.getByText('Network Error')).toBeOnTheScreen();
  });

  test('the error toast stays until the next attempt clears it', async () => {
    const user = userEvent.setup();
    mockApi(
      planThreeApi({
        'POST /my-plans': [networkError(), enrollmentCreated(46, 3)],
        'POST /my-plans/46/schedule': () => new Promise(() => {}),
      })
    );
    await openPlan();
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(screen.getByText('Network Error')).toBeOnTheScreen();
    await user.press(screen.getByText('START WORKOUT PLAN'));
    expect(screen.queryByText('Network Error')).not.toBeOnTheScreen();
    // In flight: CTA disabled and busy, chips still tappable (⚠14).
    const cta = screen.getByRole('button', { name: /START WORKOUT PLAN/ });
    expect(cta).toBeDisabled();
    expect(cta).toBeBusy();
    expect(screen.getByRole('button', { name: 'Sun' })).toBeEnabled();
  });
});

describe('⚠8 hollow page for a missing plan', () => {
  const missing = {
    'GET /plans/999': httpError(404, { success: false, message: 'Workout plan not found' }),
    'GET /plans/999/days': httpError(404, { success: false, message: 'Workout plan not found' }),
  };

  test('no enrollment: undefined === undefined → "Current plan" + "UPDATE SCHEDULE", tap → create 404 toast', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      ...missing,
      ...NO_ENROLLMENT,
      'POST /my-plans': httpError(404, { success: false, message: 'Workout plan not found' }),
    });
    await openPlan('999');
    expect(await screen.findByText('Workout plan')).toBeOnTheScreen();
    expect(screen.getByText('Current plan')).toBeOnTheScreen();
    expect(screen.getByText('0× / week')).toBeOnTheScreen();
    expect(screen.getByText('—')).toBeOnTheScreen();
    expect(screen.getByText('Workout days')).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^day-row-/)).toHaveLength(0);
    expect(screen.getByText('Your training days')).toBeOnTheScreen();
    expect(screen.getByText('These are the 0 days you train on. Adjust them and tap update to reschedule.')).toBeOnTheScreen();

    await user.press(screen.getByText('UPDATE SCHEDULE'));
    expect(api.mutations()).toEqual([
      { method: 'POST', url: '/my-plans', body: { workout_plan_id: 999, started_on: formatDateForInput(new Date()) } },
    ]);
    expect(screen.getByText('Workout plan not found')).toBeOnTheScreen();
  });

  test('with an enrollment: start copy, and a tap cancels the current plan first', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      ...missing,
      'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: planItem({ id: 1 }) }),
      'POST /my-plans/31/cancel': { enrollment: { id: 31, status: 'cancelled' } },
      'POST /my-plans': httpError(404, { success: false, message: 'Workout plan not found' }),
    });
    await openPlan('999');
    expect(await screen.findByText('Pick 0 workout days')).toBeOnTheScreen();
    expect(screen.queryByText('Current plan')).not.toBeOnTheScreen();
    await user.press(screen.getByText('START WORKOUT PLAN'));
    expect(api.mutations().map((call) => call.url)).toEqual(['/my-plans/31/cancel', '/my-plans']);
  });
});

describe('S2 navigation (§9)', () => {
  test('"‹ Plans" pushes a new S1; back returns to S2', async () => {
    const user = userEvent.setup();
    mockApi({ ...planThreeApi(), 'GET /plans': { items: [] } });
    const { navigation } = await openPlan();
    await user.press(await screen.findByTestId('back-to-plans'));
    const library = () => navigation.current.getRootState().routes.find((route) => route.name === routes.LibraryTab);
    expect(library().state.routes.map((route) => route.name)).toEqual([
      routes.PlansList,
      routes.PlanDetail,
      routes.PlansList,
    ]);
    navigation.current.goBack();
    expect(navigation.current.getCurrentRoute().name).toBe(routes.PlanDetail);
  });
});
