import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import EmptyState from '../shared/components/EmptyState';
import ErrorAlert from '../shared/components/ErrorAlert';
import { InlineError } from '../shared/components/FeedbackBox';
import Loader from '../shared/components/Loader';
import PillButton from '../shared/components/PillButton';
import StateSlot, { STATE_COLUMN_MAX, STATE_LOADER_PADDING } from '../shared/components/StateSlot';
import { listMyPlans, isGeneratorAvailable } from './myPlans/api/myPlansApi';
import { MEMBER_PLAN_TEXT } from './myPlans/memberPlanAdapter';
import MyPlansScreen from './myPlans/MyPlansScreen';
import NotificationPanel from './notifications/NotificationPanel';
import NotificationsScreen from './notifications/NotificationsScreen';
import { useNotificationStore } from './notifications/notificationStore';
import { getCurrentPlan, getPlan, listDayExercises, listPlanDays, listPlans } from './plans/api/libraryApi';
import PlanDetailScreen from './plans/screens/PlanDetailScreen';
import PlansLibraryScreen from './plans/screens/PlansLibraryScreen';
import { resetProfileStore, useProfileStore } from './profile/profileStore';
import ProfileSettingsScreen from './profile/screens/ProfileSettingsScreen';
import { loadProgress } from './progress/api/progressApi';
import ProgressScreen from './progress/ProgressScreen';
import WeightHistoryChart from './trainer/clients/components/WeightHistoryChart';
import {
  listExercisesPage,
  listPlanDays as listBuilderDays,
  listDayExercises as listBuilderExercises,
} from './trainer/plans/api/plansApi';
import ExercisePickerSheet from './trainer/plans/components/ExercisePickerSheet';
import { SharedPlanScreen } from './trainer/plans/screens/PlanScreen';
import { getMyTrainerApplication, getTrainer, listTrainers, submitTrainerApplication } from './trainers/api/trainersApi';
import TrainerApplyScreen from './trainers/screens/TrainerApplyScreen';
import TrainerDetailScreen from './trainers/screens/TrainerDetailScreen';
import TrainersScreen from './trainers/screens/TrainersScreen';

// RN-SPEC-v2-phase2 Group D, Member states rows 8-17, 19-22 and 24-30 (the
// rows in this group's files): copy, kind, Retry presence, and the tablet/web
// placement (whole-page states in the centred 640 column under the header;
// section states keep their section's width).

const mockNavigation = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockRoute = { key: 'route-1', name: 'Route', params: {} };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: jest.fn(),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('./shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('../shared/components/toastStore', () => ({ ...jest.requireActual('../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));
jest.mock('./plans/api/libraryApi', () => ({
  listPlans: jest.fn(),
  getCurrentPlan: jest.fn(),
  getPlan: jest.fn(),
  listPlanDays: jest.fn(),
  listDayExercises: jest.fn(),
  cancelEnrollment: jest.fn(),
  enrollInPlan: jest.fn(),
  createSchedule: jest.fn(),
  replaceSchedule: jest.fn(),
}));
jest.mock('./myPlans/components/MyPlansEntryCard', () => () => null);
jest.mock('./myPlans/components/CopyToMyPlansCard', () => () => null);
jest.mock('./planGenerator/components/GeneratorEntryCard', () => () => null);
jest.mock('./myPlans/api/myPlansApi', () => ({
  listMyPlans: jest.fn(),
  isGeneratorAvailable: jest.fn(),
  copyToMyPlans: jest.fn(),
  createMyPlan: jest.fn(),
  getMyPlan: jest.fn(),
  getCurrentPlan: jest.fn(),
  cancelEnrollment: jest.fn(),
  startPlan: jest.fn(),
}));
jest.mock('./trainer/plans/api/plansApi', () => ({
  ...jest.requireActual('./trainer/plans/api/plansApi'),
  listPlanDays: jest.fn(),
  listDayExercises: jest.fn(),
  listExerciseSets: jest.fn(() => Promise.resolve([])),
  listExercisesPage: jest.fn(() => Promise.resolve({ items: [], totalPages: 1 })),
  listMuscleGroups: jest.fn(() => Promise.resolve([])),
  listEquipmentTypes: jest.fn(() => Promise.resolve([])),
  listPlanCategories: jest.fn(() => Promise.resolve([])),
  listDifficultyLevels: jest.fn(() => Promise.resolve([])),
}));
jest.mock('./trainer/plans/components/SortableExerciseList', () => () => null);
jest.mock('./trainer/plans/loadExerciseCatalog', () => ({ wait: () => Promise.resolve() }));
jest.mock('./profile/CoachingCard', () => () => null);
jest.mock('./auth/authService', () => ({ logout: jest.fn() }));
jest.mock('./profile/api/profileApi', () => ({ getProfile: jest.fn(), updateProfile: jest.fn(), sendPasswordResetEmail: jest.fn() }));
jest.mock('./progress/api/progressApi', () => ({ loadProgress: jest.fn() }));
jest.mock('./trainers/api/trainersApi', () => ({
  TRAINERS_PER_PAGE: 20,
  listTrainers: jest.fn(),
  getTrainer: jest.fn(),
  requestCoaching: jest.fn(),
  getMyTrainerApplication: jest.fn(),
  submitTrainerApplication: jest.fn(),
  applicationBody: jest.fn(),
}));

const SERVER = 'Error message from the server';
const serverError = () => ({ response: { status: 500, data: { message: SERVER } } });
const transportError = (message) => Object.assign(new Error(message), { isAxiosError: true });
const retryButtons = (tree) => tree.root.findAll((node) => node.props.title === 'Retry' && typeof node.type !== 'string');
const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));

function pending() {
  return new Promise(() => {});
}

const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

function slotOf(node) {
  let parent = node.parent;
  while (parent && parent.type !== StateSlot) {
    if (parent.props.testID !== 'state-slot') {
      return null;
    }
    parent = parent.parent;
  }
  return parent;
}
const slotStyle = (slot) => StyleSheet.flatten(slot.findAll((node) => node.props.testID === 'state-slot')[0].props.style);
const find = (tree, Kind, props = {}) =>
  tree.root.findAll((node) => node.type === Kind && Object.entries(props).every(([k, v]) => node.props[k] === v))[0];

// The state card sits directly in the centred 640 column (under the header,
// in the page's normal flow).
function expectInSlot(tree, Kind, props, { loader = false } = {}) {
  const card = find(tree, Kind, props);
  expect(card).toBeTruthy();
  const slot = slotOf(card);
  expect(slot).toBeTruthy();
  const style = slotStyle(slot);
  expect(style).toEqual(expect.objectContaining({ width: '100%', maxWidth: STATE_COLUMN_MAX, alignSelf: 'center' }));
  if (loader) {
    expect(style.paddingVertical).toBe(STATE_LOADER_PADDING);
  }
  return card;
}
const inlineError = (tree, title) => find(tree, InlineError, { title });

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = { key: 'route-1', name: 'Route', params: {} };
});

describe('Notifications (rows 8-9)', () => {
  beforeEach(() => useNotificationStore.setState({ notifications: [], unreadCount: 0, hasMore: false, isLoading: false }));

  it('page loading: "Loading notifications" in the column', async () => {
    useNotificationStore.setState({ isLoading: true });
    const tree = await render(<NotificationsScreen />);
    expectInSlot(tree, Loader, { label: 'Loading notifications' });
  });

  it('row 8: the page EmptyState in the column', async () => {
    const tree = await render(<NotificationsScreen />);
    const empty = expectInSlot(tree, EmptyState, { title: 'No notifications' });
    expect(empty.props.message).toBe('You’re all caught up. New updates will appear here.');
  });

  it('row 9: the panel EmptyState switches with the filter in a polite live region', async () => {
    const tree = await render(<NotificationPanel />);
    let empty = tree.root.findByType(EmptyState);
    expect(empty.props).toEqual(expect.objectContaining({ live: true, title: 'No notifications', message: 'You’re all caught up for now.' }));
    const unread = tree.root.find((node) => node.props.accessibilityLabel === 'Show unread notifications' && typeof node.props.onPress === 'function');
    await act(async () => unread.props.onPress());
    empty = tree.root.findByType(EmptyState);
    expect(empty.props).toEqual(expect.objectContaining({ live: true, title: 'No unread notifications', message: 'You’re all caught up for now.' }));
  });
});

describe('Plans (rows 10-11)', () => {
  it('loading: "Loading plans" in the column, 48 above and below', async () => {
    listPlans.mockReturnValue(pending());
    getCurrentPlan.mockReturnValue(pending());
    const tree = await render(<PlansLibraryScreen />);
    expectInSlot(tree, Loader, { label: 'Loading plans' }, { loader: true });
  });

  // v2 Phase 4 N2 (approved 27 Oct): the page error gains the one Retry style.
  it('row 10: Inline error with the transport text + Retry (N2), in the column', async () => {
    listPlans.mockRejectedValue(transportError('Network Error'));
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render(<PlansLibraryScreen />);
    const box = expectInSlot(tree, InlineError, { title: 'Plans unavailable' });
    expect(box.props.message).toBe('Network Error');
    expect(slotOf(tree.root.findAll((node) => node.props.testID === 'plans-retry' && typeof node.props.onPress === 'function')[0])).not.toBeNull();
  });

  it('row 10: "Please try again." when there is no transport text', async () => {
    listPlans.mockRejectedValue({});
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render(<PlansLibraryScreen />);
    expect(inlineError(tree, 'Plans unavailable').props.message).toBe('Please try again.');
  });

  it('row 11: "No plans available" stays in the page flow (a section)', async () => {
    listPlans.mockResolvedValue([]);
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render(<PlansLibraryScreen />);
    const empty = find(tree, EmptyState, { title: 'No plans available' });
    expect(empty.props.message).toBe('No active workout plans were returned by the backend.');
    expect(slotOf(empty)).toBeNull();
  });
});

describe('Plan detail (row 12)', () => {
  beforeEach(() => {
    mockRoute = { key: 'PlanDetail-1', name: 'PlanDetail', params: { planId: '5' } };
  });

  it('loading: "Loading plan" in the column, 48 above and below', async () => {
    getPlan.mockReturnValue(pending());
    listPlanDays.mockReturnValue(pending());
    getCurrentPlan.mockReturnValue(pending());
    const tree = await render(<PlanDetailScreen />);
    expectInSlot(tree, Loader, { label: 'Loading plan' }, { loader: true });
  });

  // v2 Phase 4 N2 (approved 27 Oct): the page error gains the one Retry style.
  it('row 12: an unexpected load failure = Inline error "Plan unavailable" (the error text) + Retry (N2)', async () => {
    getPlan.mockResolvedValue({ plan: { id: 5, name: 'Push' } });
    // Not a list: the load throws past allSettled (the web's `error` state).
    listPlanDays.mockResolvedValue({ items: 'broken' });
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render(<PlanDetailScreen />);
    const box = expectInSlot(tree, InlineError, { title: 'Plan unavailable' });
    expect(box.props.message).toMatch(/map/);
    expect(tree.root.findAll((node) => node.props.testID === 'plan-detail-retry' && typeof node.props.onPress === 'function')).not.toHaveLength(0);
  });

  it('row 12: single failures stay allSettled (⚠8: no error, the hollow page)', async () => {
    getPlan.mockRejectedValue(serverError());
    listPlanDays.mockRejectedValue(serverError());
    getCurrentPlan.mockRejectedValue(serverError());
    const tree = await render(<PlanDetailScreen />);
    expect(inlineError(tree, 'Plan unavailable')).toBeUndefined();
    expect(texts(tree)).toContain('Workout plan');
  });
});

describe('My plans (rows 13-14)', () => {
  beforeEach(() => isGeneratorAvailable.mockResolvedValue(false));

  it('loading: "Loading your plans" in the column', async () => {
    listMyPlans.mockReturnValue(pending());
    const tree = await render(<MyPlansScreen />);
    expectInSlot(tree, Loader, { label: 'Loading your plans' });
  });

  it('row 13: ErrorAlert + Retry in the column; Retry reloads', async () => {
    listMyPlans.mockRejectedValueOnce(serverError());
    listMyPlans.mockResolvedValue({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    const tree = await render(<MyPlansScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load your plans' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => alert.props.onRetry());
    expect(listMyPlans).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('No plans yet');
  });

  // Jest reports fontScale 2 by default; row 14's layout is the 1× one.
  const atFontScale = (fontScale, width = 390) =>
    jest.spyOn(require('react-native'), 'useWindowDimensions', 'get').mockReturnValue(() => ({ width, height: 844, scale: 3, fontScale }));

  it('row 14: EmptyState + compact glass "Create a plan" and "Browse the catalog"; the header keeps the one gold "Create a plan"', async () => {
    const spy = atFontScale(1);
    listMyPlans.mockResolvedValue({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    const tree = await render(<MyPlansScreen />);
    const empty = expectInSlot(tree, EmptyState, {}, {});
    expect([empty.props.title, empty.props.message]).toEqual([
      'No plans yet',
      'Create a plan from scratch, or copy one from the catalog to make it yours.',
    ]);
    const create = find(tree, PillButton, { testID: 'my-plans-empty-create' });
    const browse = find(tree, PillButton, { testID: 'my-plans-browse' });
    expect([create.props.variant, create.props.size]).toEqual(['secondary', 'compact']);
    const golds = tree.root.findAllByType(PillButton).filter((button) => (button.props.variant ?? 'primary') === 'primary');
    expect(golds.map((button) => button.props.testID)).toEqual(['my-plans-create']);
    expect([browse.props.variant, browse.props.size]).toEqual(['secondary', 'compact']);
    expect(StyleSheet.flatten(create.parent.props.style)).toEqual(expect.objectContaining({ flexDirection: 'row', justifyContent: 'center', gap: 8 }));
    await act(async () => create.props.onPress());
    await act(async () => browse.props.onPress());
    expect(mockNavigation.push.mock.calls.map((call) => call[0])).toEqual(['MyPlanCreate', 'PlansLibrary']);
    spy.mockRestore();
  });

  it.each([
    [1, 'row', false],
    [1.3, 'row', false],
    [2, 'column', true],
    [3.1, 'column', true],
  ])('row 14 §9: at fontScale %s the empty pair is a %s (full width %s), "Create a plan" first, labels never truncated', async (fontScale, direction, full) => {
    const spy = atFontScale(fontScale);
    listMyPlans.mockResolvedValue({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    const tree = await render(<MyPlansScreen />);
    const row = tree.root.find((node) => node.props.testID === 'my-plans-empty-buttons' && typeof node.type === 'string');
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe(direction);
    const buttons = row.findAll((node) => node.type === PillButton);
    expect(buttons.map((button) => button.props.testID)).toEqual(['my-plans-empty-create', 'my-plans-browse']);
    expect(buttons.map((button) => Boolean(button.props.fullWidth))).toEqual([full, full]);
    spy.mockRestore();
  });
});

describe('My plan builder (rows 15-17)', () => {
  const adapter = (loadHeader) => ({
    loadHeader,
    probeOwnership: () => Promise.resolve(true),
    getCapabilities: () => ({ addDay: true, addExercise: true, reorderExercises: false }),
    mutations: {},
    countsClients: false,
    text: MEMBER_PLAN_TEXT,
    openBack: jest.fn(),
  });

  it('loading: "Loading plan" in the column', async () => {
    listBuilderDays.mockReturnValue(pending());
    const tree = await render(<SharedPlanScreen planId="9" adapter={adapter(() => pending())} />);
    expectInSlot(tree, Loader, { label: 'Loading plan' });
  });

  it('row 15: a 404 = "Plan not found" / the member copy, in the column', async () => {
    listBuilderDays.mockResolvedValue([]);
    const tree = await render(<SharedPlanScreen planId="9" adapter={adapter(() => Promise.reject({ response: { status: 404 } }))} />);
    const empty = expectInSlot(tree, EmptyState, { title: 'Plan not found' });
    expect(empty.props.message).toBe('This plan isn’t one of yours.');
    expect(empty.props.actionLabel).toBeUndefined();
  });

  it('load failure: ErrorAlert + Retry in the column', async () => {
    listBuilderDays.mockResolvedValue([]);
    const loadHeader = jest.fn().mockRejectedValueOnce(serverError()).mockReturnValue(pending());
    const tree = await render(<SharedPlanScreen planId="9" adapter={adapter(loadHeader)} />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load this plan' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => {
      alert.props.onRetry();
    });
    expect(loadHeader).toHaveBeenCalledTimes(2);
  });

  it('rows 16-17: "No days yet" and "No exercises yet" keep their section width', async () => {
    listBuilderDays.mockResolvedValueOnce([]);
    let tree = await render(<SharedPlanScreen planId="9" adapter={adapter(() => Promise.resolve({ id: 9, name: 'Mine' }))} />);
    const noDays = find(tree, EmptyState, { title: 'No days yet' });
    expect(noDays.props.message).toBe('Add a day to start building this plan.');
    expect(slotOf(noDays)).toBeNull();

    listBuilderDays.mockResolvedValue([{ id: 1, name: 'Day 1', day_number: 1 }]);
    listBuilderExercises.mockResolvedValue([]);
    tree = await render(<SharedPlanScreen planId="9" adapter={adapter(() => Promise.resolve({ id: 9, name: 'Mine' }))} />);
    const noExercises = find(tree, EmptyState, { title: 'No exercises yet' });
    expect(noExercises.props.message).toBe('Add an exercise to this day.');
    expect(slotOf(noExercises)).toBeNull();
  });

  it('§D4: a failed catalog load reaches the picker as its alert; Retry reloads; focus returns to "Add exercise"', async () => {
    listBuilderDays.mockResolvedValue([{ id: 1, name: 'Day 1', day_number: 1 }]);
    listBuilderExercises.mockResolvedValue([]);
    listExercisesPage.mockReset();
    listExercisesPage.mockRejectedValueOnce(serverError()).mockResolvedValue({ items: [{ id: 5, name: 'Squat' }], totalPages: 1 });
    const tree = await render(<SharedPlanScreen planId="9" adapter={adapter(() => Promise.resolve({ id: 9, name: 'Mine' }))} />);
    let picker = tree.root.findByType(ExercisePickerSheet);
    expect([picker.props.loading, picker.props.catalogError, picker.props.catalog]).toEqual([false, SERVER, []]);
    const add = find(tree, PillButton, { testID: 'plan-add-exercise' });
    expect(picker.props.returnFocusRef).toBeTruthy();
    expect(picker.props.returnFocusRef.current).toBeTruthy();
    expect(add).toBeTruthy();

    await act(async () => picker.props.onRetryCatalog());
    picker = tree.root.findByType(ExercisePickerSheet);
    expect(listExercisesPage).toHaveBeenCalledTimes(2);
    expect([picker.props.loading, picker.props.catalogError, picker.props.catalog]).toEqual([false, null, [{ id: 5, name: 'Squat' }]]);
  });
});

describe('Profile (row 19)', () => {
  beforeEach(() => resetProfileStore());

  it('loading: "Loading settings" in the column, 48 above and below', async () => {
    useProfileStore.setState({ profileStatus: 'loading' });
    const tree = await render(<ProfileSettingsScreen />);
    expectInSlot(tree, Loader, { label: 'Loading settings' }, { loader: true });
  });

  it('row 19: "No profile yet" with the code\'s secondary "Create profile", in the column', async () => {
    useProfileStore.setState({ profileStatus: 'missing', profile: null });
    const tree = await render(<ProfileSettingsScreen />);
    const empty = expectInSlot(tree, EmptyState, { title: 'No profile yet' });
    expect(empty.props).toEqual(
      expect.objectContaining({ message: 'Create your profile to unlock settings.', actionLabel: 'Create profile', actionTestID: 'settings-create-profile' }),
    );
    await act(async () => empty.props.onAction());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Onboarding');
  });
});

describe('Progress (rows 20, 22)', () => {
  it('loading: "Loading progress" in the column, 48 above and below', async () => {
    loadProgress.mockReturnValue(pending());
    const tree = await render(<ProgressScreen />);
    expectInSlot(tree, Loader, { label: 'Loading progress' }, { loader: true });
  });

  it('row 20: Inline error with the transport text, no Retry, in the column', async () => {
    loadProgress.mockRejectedValue(transportError('timeout of 15000ms exceeded'));
    const tree = await render(<ProgressScreen />);
    const box = expectInSlot(tree, InlineError, { title: 'Progress unavailable' });
    expect(box.props.message).toBe('timeout of 15000ms exceeded');
    expect(retryButtons(tree)).toHaveLength(0);
  });

  it('row 20: "Please try again." without a transport text', async () => {
    loadProgress.mockRejectedValue({});
    const tree = await render(<ProgressScreen />);
    expect(inlineError(tree, 'Progress unavailable').props.message).toBe('Please try again.');
  });

  it('row 22: fewer than 2 points = "Not enough weight history yet"', async () => {
    const tree = await render(<WeightHistoryChart logs={[{ id: 1, recorded_on: '2026-10-01', weight_value: 80, weight_unit: 'kg' }]} unit="kg" />);
    const empty = tree.root.findByType(EmptyState);
    expect([empty.props.title, empty.props.message]).toEqual([
      'Not enough weight history yet',
      'Add a few weight logs and the chart will start showing your trend.',
    ]);
  });
});

describe('Find a trainer (rows 24-26)', () => {
  it('loading: "Loading trainers" in the column', async () => {
    listTrainers.mockReturnValue(pending());
    const tree = await render(<TrainersScreen />);
    expectInSlot(tree, Loader, { label: 'Loading trainers' });
  });

  it('row 24: ErrorAlert + Retry in the column; Retry reloads', async () => {
    listTrainers.mockRejectedValueOnce(serverError());
    listTrainers.mockResolvedValue({ items: [], pagination: null });
    const tree = await render(<TrainersScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load trainers' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => alert.props.onRetry());
    expect(listTrainers).toHaveBeenCalledTimes(2);
  });

  it('rows 25-26: the empty copy follows the search in a polite live EmptyState', async () => {
    jest.useFakeTimers();
    try {
      listTrainers.mockResolvedValue({ items: [], pagination: null });
      const tree = await render(<TrainersScreen />);
      let empty = expectInSlot(tree, EmptyState, { title: 'No trainers yet' });
      expect(empty.props).toEqual(expect.objectContaining({ live: true, message: 'Trainers appear here once they set up their profile.' }));
      const input = tree.root.find((node) => node.type === 'TextInput');
      await act(async () => input.props.onChangeText('zed'));
      await act(async () => jest.advanceTimersByTime(400));
      empty = expectInSlot(tree, EmptyState, { title: 'No trainers match that search' });
      expect(empty.props).toEqual(expect.objectContaining({ live: true, message: 'Try a different search term.' }));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Trainer profile (rows 27-28)', () => {
  beforeEach(() => {
    mockRoute = { key: 'TrainerDetail-1', name: 'TrainerDetail', params: { trainerUserId: '3' } };
  });

  it('loading: "Loading trainer" in the column', async () => {
    getTrainer.mockReturnValue(pending());
    const tree = await render(<TrainerDetailScreen />);
    expectInSlot(tree, Loader, { label: 'Loading trainer' });
  });

  it('row 27: ErrorAlert + Retry in the column; Retry reloads', async () => {
    getTrainer.mockRejectedValueOnce(serverError());
    getTrainer.mockReturnValue(pending());
    const tree = await render(<TrainerDetailScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load this trainer' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => {
      alert.props.onRetry();
    });
    expect(getTrainer).toHaveBeenCalledTimes(2);
  });

  it('row 28: a 404 = "Trainer not found" with the code\'s secondary "Back to trainers"', async () => {
    getTrainer.mockRejectedValue({ response: { status: 404 } });
    const tree = await render(<TrainerDetailScreen />);
    const empty = expectInSlot(tree, EmptyState, { title: 'Trainer not found' });
    expect(empty.props.message).toBe('This trainer isn’t available. They may have removed their profile.');
    expect(empty.props.actionLabel).toBe('Back to trainers');
    await act(async () => empty.props.onAction());
    expect(mockNavigation.push).toHaveBeenCalledWith('Trainers');
    expect(retryButtons(tree)).toHaveLength(0);
  });
});

describe('Become a trainer (rows 29-30)', () => {
  it('loading: "Loading your application" in the column', async () => {
    getMyTrainerApplication.mockReturnValue(pending());
    const tree = await render(<TrainerApplyScreen />);
    expectInSlot(tree, Loader, { label: 'Loading your application' });
  });

  it('row 29: ErrorAlert + Retry in the column; Retry reloads', async () => {
    getMyTrainerApplication.mockRejectedValueOnce(serverError());
    getMyTrainerApplication.mockResolvedValue(null);
    const tree = await render(<TrainerApplyScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load your application' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => alert.props.onRetry());
    expect(getMyTrainerApplication).toHaveBeenCalledTimes(2);
  });

  it('row 30: a submit failure = ErrorAlert "Could not submit", NO Retry, inside the form card', async () => {
    getMyTrainerApplication.mockResolvedValue(null);
    submitTrainerApplication.mockRejectedValue({ response: { status: 409, data: { message: SERVER } } });
    const tree = await render(<TrainerApplyScreen />);
    const submit = find(tree, PillButton, { testID: 'trainer-apply-submit' });
    await act(async () => submit.props.onPress());
    const alert = find(tree, ErrorAlert, { title: 'Could not submit' });
    expect(alert.props.description).toBe(SERVER);
    expect(alert.props.onRetry).toBeUndefined();
    expect(slotOf(alert)).toBeNull();
  });
});
