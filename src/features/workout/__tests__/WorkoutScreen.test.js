import { act, screen, userEvent } from '@testing-library/react-native';

import { routes } from '../../../navigation/routes';
import { httpError, mockApi, networkError } from '../../../test/mockApi';
import { currentPlan, day, daysList, NOT_FOUND_CURRENT, planItem, scheduleSaved } from '../../../test/planFixtures';
import { renderMemberApp } from '../../../test/renderMemberApp';
import { SAVED_TOAST_MS } from '../WorkoutScreen';

const workoutState = (params) => ({ index: 0, routes: [{ name: routes.WorkoutTab, params }] });
const PLAN = planItem({ id: 3, name: 'Coach Block', days_per_week: 5 });
const PLAN_DAYS = [day(11, 1, 'A', 3), day(12, 2, 'B', 3), day(13, 3, 'C', 3)];

function assignedApi(overrides = {}) {
  return {
    // Freshly trainer-assigned: an enrollment with no schedule rows.
    'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [] }),
    'GET /plans/3/days': daysList(PLAN_DAYS),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('S3 ScheduleSetupCard (RN-SPEC-plans §5)', () => {
  test('shows for an enrollment with plan days and no schedule; R = planDays.length', async () => {
    mockApi(assignedApi());
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByText('Set up your week')).toBeOnTheScreen();
    // R is the 3 saved days, not days_per_week (5).
    expect(screen.getByText('Pick 3 training days')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Coach Block doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.'
      )
    ).toBeOnTheScreen();
    expect(screen.getByText('Selected: Mon, Tue, Wed')).toBeOnTheScreen();
  });

  test.each([
    ['no enrollment', { 'GET /my-plans/current': httpError(404, NOT_FOUND_CURRENT) }],
    ['a saved schedule', { 'GET /my-plans/current': currentPlan({ plan: PLAN, weekdayIds: [1, 2, 3] }) }],
    ['no plan days', { 'GET /plans/3/days': daysList([]) }],
  ])('hidden with %s', async (_label, overrides) => {
    const api = mockApi(assignedApi(overrides));
    await renderMemberApp({ initialState: workoutState() });
    await screen.findByText(/Workout page placeholder/);
    await act(async () => {});
    expect(api.calls.length).toBeGreaterThan(0);
    expect(screen.queryByText('Set up your week')).not.toBeOnTheScreen();
  });

  test('"Your plan" when the plan has no name', async () => {
    mockApi(
      assignedApi({
        'GET /my-plans/current': currentPlan({ enrollmentId: 31, plan: planItem({ id: 3, name: undefined }) }),
      })
    );
    await renderMemberApp({ initialState: workoutState() });
    expect(await screen.findByText(/^Your plan doesn’t have training days yet/)).toBeOnTheScreen();
  });

  test('validation says "Pick", not "Select", and sends nothing', async () => {
    const user = userEvent.setup();
    const api = mockApi(assignedApi());
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByRole('button', { name: 'Wed' }));
    await user.press(screen.getByText('Save training days'));
    expect(screen.getByText('Couldn’t save your days')).toBeOnTheScreen();
    expect(screen.getByText('Pick 3 training days to continue.')).toBeOnTheScreen();
    expect(api.mutations()).toEqual([]);
  });

  test('saves every plan day (never a slice), then shows "Training days saved." and reloads', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      assignedApi({
        'GET /my-plans/current': [
          currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [] }),
          currentPlan({ enrollmentId: 31, plan: PLAN, weekdayIds: [2, 4, 6] }),
        ],
        'POST /my-plans/31/schedule': scheduleSaved(31),
      })
    );
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByRole('button', { name: 'Tue' }));
    await user.press(screen.getByRole('button', { name: 'Fri' }));
    await user.press(screen.getByText('Save training days'));

    expect(api.mutations()).toEqual([
      {
        method: 'POST',
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
    expect(await screen.findByText('Training days saved.')).toBeOnTheScreen();
    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(api.count('GET', '/my-plans/current')).toBe(2);
    expect(screen.queryByText('Set up your week')).not.toBeOnTheScreen();
  });

  test('a POST 409 retries with PUT', async () => {
    const user = userEvent.setup();
    const api = mockApi(
      assignedApi({
        'POST /my-plans/31/schedule': httpError(409, { success: false, message: 'Plan schedule already exists' }),
        'PUT /my-plans/31/schedule': scheduleSaved(31),
      })
    );
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByText('Save training days'));
    expect(api.mutations().map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /my-plans/31/schedule',
      'PUT /my-plans/31/schedule',
    ]);
    expect(await screen.findByText('Training days saved.')).toBeOnTheScreen();
  });

  test.each([
    ['422', httpError(422, { success: false, message: 'Validation failed', errors: { items: ['weekday not found'] } }), 'Validation failed'],
    ['network', networkError(), 'Network Error'],
  ])('%s error shows in the card toast', async (_label, error, message) => {
    const user = userEvent.setup();
    mockApi(assignedApi({ 'POST /my-plans/31/schedule': error }));
    await renderMemberApp({ initialState: workoutState() });
    await user.press(await screen.findByText('Save training days'));
    expect(screen.getByText('Couldn’t save your days')).toBeOnTheScreen();
    expect(screen.getByText(message)).toBeOnTheScreen();
  });
});

describe('Workout "Saved" hand-off toast (RN-SPEC-plans §4.8)', () => {
  test('shows the route message once, clears after 3500ms, then clears the param', async () => {
    jest.useFakeTimers();
    mockApi({ 'GET /my-plans/current': httpError(404, NOT_FOUND_CURRENT) });
    const { navigation } = await renderMemberApp({ initialState: workoutState({ message: 'Strength Base activated.' }) });

    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(screen.getByText('Strength Base activated.')).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(SAVED_TOAST_MS - 1);
    });
    expect(screen.getByText('Strength Base activated.')).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Strength Base activated.')).not.toBeOnTheScreen();
    expect(navigation.current.getCurrentRoute().params?.message).toBeUndefined();
  });

  test('uses 3500ms', () => {
    expect(SAVED_TOAST_MS).toBe(3500);
  });
});
