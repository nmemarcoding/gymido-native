import { act, screen, userEvent } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '../../shared/api/client';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { httpError, mockApi } from '../../test/mockApi';
import { daysList, NOT_FOUND_CURRENT, planDetail, planItem, plansList } from '../../test/planFixtures';
import { focusedPath, planDetailState, renderMemberApp } from '../../test/renderMemberApp';
import { routes } from '../routes';
import { layoutFor } from '../shell/layoutMetrics';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

const NO_ENROLLMENT = { 'GET /my-plans/current': httpError(404, NOT_FOUND_CURRENT) };

function libraryApi(overrides = {}) {
  return {
    'GET /plans': plansList([planItem({ id: 3, name: 'Strength Base' })]),
    'GET /plans/3': planDetail({ id: 3, name: 'Strength Base' }),
    'GET /plans/3/days': daysList([]),
    ...NO_ENROLLMENT,
    ...overrides,
  };
}

const libraryStack = (navigation) =>
  navigation.current.getRootState().routes.find((route) => route.name === routes.LibraryTab).state.routes;

afterEach(() => {
  jest.restoreAllMocks();
  useWindowDimensions.mockImplementation(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
});

describe('tabs (RN-SPEC-plans §1.3)', () => {
  test('six tabs in web order; admins get Settings too (no admin UI on mobile)', async () => {
    mockApi(libraryApi());
    await renderMemberApp();
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Workout',
      'Exercises',
      'Library',
      'Progress',
      'Trainer',
      'Settings',
    ]);
    expect(screen.queryByText('Admin')).not.toBeOnTheScreen();
    expect(screen.getByTestId(`tab-${routes.LibraryTab}`)).toBeSelected();
  });

  test('the tab bar sits above the bottom inset with 16px padding on top of it (owner O2)', async () => {
    useSafeAreaInsets.mockReturnValue({ top: 47, bottom: 34, left: 0, right: 0 });
    mockApi(libraryApi());
    await renderMemberApp();
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 50, paddingTop: 12 });
    useSafeAreaInsets.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});

describe('fresh mount on every focus (§8.1)', () => {
  test('returning to S1 shows the loader and refetches', async () => {
    const user = userEvent.setup();
    const api = mockApi(libraryApi());
    const { navigation } = await renderMemberApp();
    await user.press(await screen.findByTestId('plan-card-3'));
    await screen.findByText('START WORKOUT PLAN');

    let resolvePlans;
    apiClient.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePlans = resolve;
        })
    );
    await act(async () => {
      navigation.current.goBack();
    });
    expect(screen.getByText('Loading plans')).toBeOnTheScreen();
    await act(async () => {
      resolvePlans({ data: { success: true, data: plansList([planItem({ id: 3, name: 'Reloaded' })]) } });
    });
    expect(await screen.findByText('Reloaded')).toBeOnTheScreen();
    expect(api.count('GET', '/my-plans/current')).toBeGreaterThanOrEqual(3);
  });

  test('a response from an earlier focus is dropped', async () => {
    const user = userEvent.setup();
    let resolveFirst;
    mockApi(
      libraryApi({
        'GET /plans': [
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
          plansList([planItem({ id: 3, name: 'Second load' })]),
        ],
      })
    );
    await renderMemberApp();
    await user.press(screen.getByTestId(`tab-${routes.WorkoutTab}`));
    await user.press(screen.getByTestId(`tab-${routes.LibraryTab}`));
    expect(await screen.findByText('Second load')).toBeOnTheScreen();
    await act(async () => {
      resolveFirst(plansList([planItem({ id: 3, name: 'Stale load' })]));
    });
    expect(screen.queryByText('Stale load')).not.toBeOnTheScreen();
  });
});

describe('Library tab press (§9)', () => {
  test('from S2 on another tab, lands on a single fresh S1', async () => {
    const user = userEvent.setup();
    mockApi(libraryApi());
    const { navigation } = await renderMemberApp({ initialState: planDetailState('3') });
    await screen.findByText('START WORKOUT PLAN');
    await user.press(screen.getByTestId(`tab-${routes.WorkoutTab}`));
    await user.press(screen.getByTestId(`tab-${routes.LibraryTab}`));
    expect(libraryStack(navigation).map((route) => route.name)).toEqual([routes.PlansList]);
    expect(await screen.findByText('Strength Base')).toBeOnTheScreen();
  });

  test('while already on S1, remounts it and reloads', async () => {
    const user = userEvent.setup();
    const api = mockApi(libraryApi());
    const { navigation } = await renderMemberApp();
    await screen.findByText('Strength Base');
    const firstKey = libraryStack(navigation)[0].key;
    await user.press(screen.getByTestId(`tab-${routes.LibraryTab}`));
    await screen.findByText('Strength Base');
    expect(libraryStack(navigation)).toHaveLength(1);
    expect(libraryStack(navigation)[0].key).not.toBe(firstKey);
    expect(api.count('GET', '/plans')).toBe(2);
  });
});

describe('back behaviour (backBehavior="history")', () => {
  test('a Library tab press keeps tab history: back returns to the previous tab', async () => {
    const user = userEvent.setup();
    mockApi(libraryApi());
    const { navigation } = await renderMemberApp();
    await screen.findByText('Strength Base');
    await user.press(screen.getByTestId(`tab-${routes.ProgressTab}`));
    await user.press(screen.getByTestId(`tab-${routes.LibraryTab}`));
    await screen.findByText('Strength Base');
    await act(async () => {
      navigation.current.goBack();
    });
    expect(navigation.current.getCurrentRoute().name).toBe(routes.ProgressTab);
  });

  test('back from Workout after an activation returns to Library on S1, not S2', async () => {
    const user = userEvent.setup();
    mockApi(
      libraryApi({
        'POST /my-plans': { enrollment: { id: 40 } },
        'POST /my-plans/40/schedule': { enrollment_id: 40, schedule: [] },
      })
    );
    const { navigation } = await renderMemberApp({ initialState: planDetailState('3') });
    await user.press(await screen.findByText('START WORKOUT PLAN'));
    expect(navigation.current.getCurrentRoute().name).toBe(routes.WorkoutTab);
    await act(async () => {
      navigation.current.goBack();
    });
    expect(focusedPath(navigation.current.getRootState())).toEqual([routes.LibraryTab, routes.PlansList]);
  });
});

describe('phone vs tablet (§2.8)', () => {
  test.each([
    [390, false, 16],
    [639, false, 16],
    [640, false, 20],
    [767, false, 20],
    [768, true, 20],
  ])('width %i → desktop %s, gutter %i', (width, isDesktop, gutter) => {
    expect(layoutFor(width)).toEqual({ isDesktop, gutter });
  });

  test('≥768pt: no tab bar, sidebar stub instead', async () => {
    useWindowDimensions.mockImplementation(() => ({ width: 1024, height: 768, scale: 2, fontScale: 1 }));
    mockApi(libraryApi());
    await renderMemberApp();
    await screen.findByText('Strength Base');
    expect(screen.queryByTestId('tab-bar')).not.toBeOnTheScreen();
    expect(screen.getByTestId('desktop-sidebar')).toBeOnTheScreen();
    expect(screen.getByText('Plans')).toBeOnTheScreen();
  });
});

describe('motion (§2.6)', () => {
  test('with reduce motion off, the day chevron animates without errors', async () => {
    useReducedMotion.mockReturnValue(false);
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockApi(libraryApi({ 'GET /plans/3/days': daysList([{ id: 11, workout_plan_id: 3, day_number: 1, title: 'A' }]), 'GET /plans/3/days/11/exercises': { items: [] } }));
    await renderMemberApp({ initialState: planDetailState('3') });
    await user.press(await screen.findByRole('button', { name: /^1/ }));
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByRole('button', { name: /^1/ })).toBeCollapsed();
    jest.useRealTimers();
    useReducedMotion.mockReturnValue(true);
  });
});
