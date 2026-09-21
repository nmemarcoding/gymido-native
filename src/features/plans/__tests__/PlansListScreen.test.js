import { screen, userEvent, within } from '@testing-library/react-native';

import { routes } from '../../../navigation/routes';
import { apiClient } from '../../../shared/api/client';
import { httpError, mockApi, networkError } from '../../../test/mockApi';
import {
  category,
  currentPlan,
  NOT_FOUND_CURRENT,
  planDetail,
  planItem,
  plansList,
} from '../../../test/planFixtures';
import { focusedPath, renderMemberApp } from '../../../test/renderMemberApp';

const NO_ENROLLMENT = { 'GET /my-plans/current': httpError(404, NOT_FOUND_CURRENT) };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('S1 states (RN-SPEC-plans §3.7)', () => {
  test('loading: inline "Loading plans" loader', async () => {
    mockApi({ 'GET /plans': () => new Promise(() => {}), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(screen.getByRole('header', { name: 'Library' })).toBeOnTheScreen();
    expect(screen.getByText('Loading plans')).toBeOnTheScreen();
  });

  test('loads with GET /plans (no query params) and GET /my-plans/current in parallel', async () => {
    const api = mockApi({ 'GET /plans': plansList([planItem()]), ...NO_ENROLLMENT });
    await renderMemberApp();
    await screen.findByText('Beginner Full Body Foundation');
    expect(apiClient.get).toHaveBeenCalledWith('/plans');
    expect(api.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /plans', 'GET /my-plans/current']);
  });

  test('empty: "No plans available", no heading, no action button', async () => {
    mockApi({ 'GET /plans': plansList([]), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText('No plans available')).toBeOnTheScreen();
    expect(screen.getByText('No active workout plans were returned by the backend.')).toBeOnTheScreen();
    expect(screen.queryByText('Choose your next plan')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  test('populated, no active plan: heading, count pill, cards', async () => {
    mockApi({
      'GET /plans': plansList([planItem({ id: 1 }), planItem({ id: 2, name: 'Push Pull Legs', days_per_week: 5 })]),
      ...NO_ENROLLMENT,
    });
    await renderMemberApp();
    expect(await screen.findByText('Choose your next plan')).toBeOnTheScreen();
    expect(screen.getByText('2 plans')).toBeOnTheScreen();
    expect(screen.getByText('Push Pull Legs')).toBeOnTheScreen();
    expect(screen.getByText('5 days / week')).toBeOnTheScreen();
    expect(screen.getAllByText('Build Muscle')).toHaveLength(2);
    // One category → no category subheadings (only the card eyebrows).
    expect(screen.queryByText('Plans')).not.toBeOnTheScreen();
  });

  test('singular count pill', async () => {
    mockApi({ 'GET /plans': plansList([planItem()]), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText('1 plan')).toBeOnTheScreen();
  });

  test('category subheadings show when there is more than one group', async () => {
    mockApi({
      'GET /plans': plansList([
        planItem({ id: 1, category: category(1, 'Build Muscle') }),
        planItem({ id: 2, category: undefined, name: 'Uncategorised' }),
      ]),
      ...NO_ENROLLMENT,
    });
    await renderMemberApp();
    expect(await screen.findByText('Plans')).toBeOnTheScreen();
    expect(screen.getAllByText('Build Muscle')).toHaveLength(2);
  });

  test('with an active plan: featured card, Mon→Sun weekday pills, excluded from the browse list', async () => {
    const plans = [planItem({ id: 1, name: 'Active One' }), planItem({ id: 2, name: 'Other One' })];
    mockApi({
      'GET /plans': plansList(plans),
      'GET /my-plans/current': currentPlan({ plan: plans[0], weekdayIds: [5, 1, 3] }),
    });
    await renderMemberApp();
    const card = await screen.findByTestId('active-plan-card');
    expect(within(card).getByText('Active plan')).toBeOnTheScreen();
    expect(within(card).getByText('Active One')).toBeOnTheScreen();
    expect(within(card).getByText('3 training days / week · Build Muscle')).toBeOnTheScreen();
    expect(within(card).getByText('Active')).toBeOnTheScreen();
    const weekdayNames = within(card)
      .getAllByText(/day$/)
      .map((node) => node.props.children);
    expect(weekdayNames).toEqual(['Monday', 'Wednesday', 'Friday']);
    expect(screen.getByText('Switch your plan')).toBeOnTheScreen();
    expect(screen.getByText('1 plan')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-card-1')).not.toBeOnTheScreen();
  });

  test('active plan only: no section heading at all', async () => {
    const plan = planItem({ id: 1 });
    mockApi({ 'GET /plans': plansList([plan]), 'GET /my-plans/current': currentPlan({ plan }) });
    await renderMemberApp();
    await screen.findByTestId('active-plan-card');
    expect(screen.queryByText('Switch your plan')).not.toBeOnTheScreen();
    expect(screen.queryByText('Choose your next plan')).not.toBeOnTheScreen();
  });

  test('plans exist but none are browsable: heading alone', async () => {
    mockApi({ 'GET /plans': plansList([planItem({ is_active: false })]), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText('Choose your next plan')).toBeOnTheScreen();
    expect(screen.queryByText(/^\d+ plans?$/)).not.toBeOnTheScreen();
  });

  test('active plan without days_per_week: "Your active routine"', async () => {
    const plan = planItem({ id: 9, days_per_week: undefined, category: undefined });
    mockApi({ 'GET /plans': plansList([]), 'GET /my-plans/current': currentPlan({ plan }) });
    await renderMemberApp();
    expect(await screen.findByText('Your active routine')).toBeOnTheScreen();
    // Empty state still renders under the featured card.
    expect(screen.getByText('No plans available')).toBeOnTheScreen();
  });

  test('private trainer plan: the featured card uses the enrollment copy', async () => {
    const privatePlan = planItem({ id: 77, name: 'Coach Nima Block' });
    mockApi({ 'GET /plans': plansList([planItem({ id: 1 })]), 'GET /my-plans/current': currentPlan({ plan: privatePlan }) });
    await renderMemberApp();
    expect(await screen.findByText('Coach Nima Block')).toBeOnTheScreen();
  });

  test('PlanCard description is clamped to 2 lines; the name to 1', async () => {
    mockApi({ 'GET /plans': plansList([planItem()]), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText(/^Simple full-body/)).toHaveProp('numberOfLines', 2);
    expect(screen.getByText('Beginner Full Body Foundation')).toHaveProp('numberOfLines', 1);
  });

  test('parity: a plan without days_per_week shows " days / week"', async () => {
    mockApi({ 'GET /plans': plansList([planItem({ days_per_week: undefined })]), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText(' days / week')).toBeOnTheScreen();
  });
});

describe('S1 errors (⚠4: transport text, no retry)', () => {
  test.each([
    ['network', networkError(), 'Network Error'],
    ['timeout', networkError('timeout of 15000ms exceeded'), 'timeout of 15000ms exceeded'],
    ['500', httpError(500, { success: false, message: 'boom' }), 'Request failed with status code 500'],
    ['401', httpError(401, { success: false, message: 'Unauthorized' }), 'Request failed with status code 401'],
    ['422', httpError(422, { success: false, message: 'Validation failed' }), 'Request failed with status code 422'],
  ])('%s → "Plans unavailable" with the transport message', async (_label, error, message) => {
    mockApi({ 'GET /plans': error, ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText('Plans unavailable')).toBeOnTheScreen();
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.queryByText(/retry/i)).not.toBeOnTheScreen();
  });

  test('an empty message falls back to "Please try again."', async () => {
    mockApi({ 'GET /plans': Object.assign(new Error(''), { isAxiosError: true }), ...NO_ENROLLMENT });
    await renderMemberApp();
    expect(await screen.findByText('Please try again.')).toBeOnTheScreen();
  });

  test('a non-404 current-plan error fails the whole load', async () => {
    mockApi({ 'GET /plans': plansList([planItem()]), 'GET /my-plans/current': httpError(403, { success: false }) });
    await renderMemberApp();
    expect(await screen.findByText('Plans unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Request failed with status code 403')).toBeOnTheScreen();
  });

  test('⚠5: only the first page is requested, never page 2', async () => {
    const api = mockApi({
      'GET /plans': plansList(Array.from({ length: 20 }, (_, index) => planItem({ id: index + 1 }))),
      ...NO_ENROLLMENT,
    });
    await renderMemberApp();
    expect(await screen.findByText('20 plans')).toBeOnTheScreen();
    expect(api.count('GET', '/plans')).toBe(1);
  });
});

describe('S1 navigation (RN-SPEC-plans §3.4, §3.6, §9)', () => {
  test('tapping a PlanCard pushes S2 with the id as a string', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /plans': plansList([planItem({ id: 3 })]),
      ...NO_ENROLLMENT,
      'GET /plans/3': planDetail({ id: 3 }),
      'GET /plans/3/days': { items: [] },
    });
    const { navigation } = await renderMemberApp();
    await user.press(await screen.findByTestId('plan-card-3'));
    expect(focusedPath(navigation.current.getRootState())).toEqual([routes.LibraryTab, routes.PlanDetail]);
    expect(navigation.current.getCurrentRoute().params).toEqual({ planId: '3' });
  });

  test('"Go to workout" switches to the Workout tab; "View plan" pushes S2', async () => {
    const user = userEvent.setup();
    const plan = planItem({ id: 4 });
    mockApi({
      'GET /plans': plansList([plan]),
      'GET /my-plans/current': currentPlan({ plan }),
      'GET /plans/4': planDetail({ id: 4 }),
      'GET /plans/4/days': { items: [] },
    });
    const { navigation } = await renderMemberApp();
    await user.press(await screen.findByText('View plan'));
    expect(navigation.current.getCurrentRoute()).toMatchObject({ name: routes.PlanDetail, params: { planId: '4' } });

    navigation.current.goBack();
    await user.press(await screen.findByText('Go to workout'));
    expect(focusedPath(navigation.current.getRootState())).toEqual([routes.WorkoutTab]);
  });
});
