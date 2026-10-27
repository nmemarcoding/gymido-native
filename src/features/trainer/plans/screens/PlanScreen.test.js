let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { apiClient } from '../../../../shared/api/client';
import AppModal from '../../../../shared/components/AppModal';
import PillButton from '../../../../shared/components/PillButton';
import { addToast } from '../../../../shared/components/toastStore';
import { colors, textScale } from '../../../../shared/theme/tokens';
import MyPlanScreen from '../../../myPlans/MyPlanScreen';
import { getCurrentPlan } from '../../../myPlans/api/myPlansApi';
import DayListCard from '../components/DayListCard';
import ExerciseCard from '../components/ExerciseCard';
import { OVERFLOW_HANDOFF_MS } from '../components/PlanOverflowSheet';
import StaticExerciseList from '../components/StaticExerciseList';
import { createTrainerPlanAdapter } from '../trainerPlanAdapter';
import { SharedPlanScreen } from './PlanScreen';

// RN-SPEC-v2-phase4 §2 + UX phase4 I §1-3 / phase6 O builder: the shared
// builder's v2 layouts (member + trainer, phone + tablet), the approved
// member "Make a copy", the T-16 copy fallback, the a11y rules and §9.

const mockNavigation = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockRoute = { key: 'r', name: 'MyPlan', params: { planId: '9' } };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../../../../shared/components/toastStore', () => ({ ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));
jest.mock('../../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../../../shell/shellLinks', () => ({ handOffToWorkout: jest.fn() }));
jest.mock('../loadExerciseCatalog', () => ({ wait: () => Promise.resolve() }));
jest.mock('../components/ExercisePickerSheet', () => () => null);
jest.mock('../../../myPlans/api/myPlansApi', () => ({
  ...jest.requireActual('../../../myPlans/api/myPlansApi'),
  getCurrentPlan: jest.fn(),
}));
jest.mock('react-native-draggable-flatlist', () => {
  const { Fragment: F } = require('react');
  return {
    NestableDraggableFlatList: ({ data, renderItem, keyExtractor }) =>
      data.map((item) => <F key={keyExtractor(item)}>{renderItem({ item, drag: jest.fn(), isActive: false })}</F>),
  };
});

const PLAN = { id: 9, name: 'My strength plan', is_active: true, days_per_week: 4 };
const DAYS = [
  { id: 1, day_number: 1, title: 'Heavy A', description: 'Squat focus', exercises_count: 2 },
  { id: 2, day_number: 2, title: 'Heavy B', exercises_count: 0 },
];
const EXERCISES = [
  { id: 11, exercise_id: 5, order_index: 1, exercise: { id: 5, name: 'Back Squat' }, target_set_summary: { set_count: 1, target_reps_min: 5, target_reps_max: 5 } },
  { id: 12, exercise_id: 6, order_index: 2, exercise: { id: 6, name: 'Barbell Bench Press' } },
];
const SETS = { 11: [{ id: 101, set_number: 1, target_reps_min: 5, target_reps_max: 5, target_weight_value: 135, target_weight_unit: 'lb', rest_seconds: 120 }] };

let getRoutes;
const ok = (value) => Promise.resolve({ data: { data: value } });
function routeGet(url) {
  for (const [pattern, value] of getRoutes) {
    if (typeof pattern === 'string' ? url === pattern : pattern.test(url)) {
      return typeof value === 'function' ? value(url) : ok(value);
    }
  }
  return ok({ items: [] });
}

function setRoutes({ root = '/my-custom-plans/9', plan = PLAN, days = DAYS, exercises = EXERCISES, own404 = true, count = 0 } = {}) {
  getRoutes = [
    [root, { plan }],
    ['/plans/9', () => (own404 ? Promise.reject({ response: { status: 404 } }) : ok({ plan }))],
    ['/plans/9/days', { items: days }],
    [/\/plans\/9\/days\/\d+\/exercises\/(\d+)\/sets$/, (url) => ok({ items: SETS[url.match(/exercises\/(\d+)\/sets/)[1]] ?? [] })],
    [/\/plans\/9\/days\/\d+\/exercises$/, { items: exercises }],
    [`${root}/affected-clients`, { active_client_count: count }],
  ];
  apiClient.get.mockImplementation((url) => routeGet(url));
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  await flush();
  return tree;
}

const hosts = (tree, id) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.testID === id);
const host = (tree, id) => hosts(tree, id)[0];
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const press = async (tree, id) => {
  await act(async () => {
    pressable(tree, id).props.onPress();
  });
  await flush();
};
const allText = (tree) =>
  tree.root
    .findAll((node) => node.type === Text)
    .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string' || typeof part === 'number').join(''));
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const exists = (tree, id) => tree.root.findAll((node) => node.props.testID === id).length > 0;
const pill = (tree, id) => tree.root.findAll((node) => node.type === PillButton && node.props.testID === id)[0];

const renderMember = () => render(<MyPlanScreen />);
const renderTrainer = () => render(<SharedPlanScreen planId="9" adapter={createTrainerPlanAdapter('9')} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  mockRoute = { key: 'r', name: 'MyPlan', params: { planId: '9' } };
  getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
});

describe('member builder, phone (UX I §1)', () => {
  beforeEach(() => setRoutes());

  it('draws the header, the Start | Edit details row and the overflow listing every plan action', async () => {
    const tree = await renderMember();
    const texts = allText(tree);
    expect(texts).toEqual(expect.arrayContaining(['My plans', 'My plan', 'My strength plan', 'Build and edit days, exercises and sets. Changes apply from your next workout.']));
    expect(pill(tree, 'my-plan-start').props).toMatchObject({ title: 'Start this plan', size: 'default', fullWidth: true });
    expect(pill(tree, 'plan-edit-details').props).toMatchObject({ variant: 'secondary', size: 'compact' });
    expect(pressable(tree, 'plan-overflow').props.accessibilityLabel).toBe('More plan actions: Edit details, Make a copy, Deactivate, Delete plan');
    // The tablet-only buttons live in the overflow on phones.
    expect(pill(tree, 'plan-make-copy')).toBeUndefined();
    expect(hosts(tree, 'plan-delete')).toHaveLength(0);
  });

  it('the day tabs are a tablist; the selected tab is light; a tab press loads that day', async () => {
    const tree = await renderMember();
    const tablist = tree.root.find((node) => node.props.testID === 'plan-day-tabs' && node.props.accessibilityRole === 'tablist');
    expect(tablist.props.accessibilityLabel).toBe('Plan days');
    const first = pressable(tree, 'plan-day-1');
    expect(first.props).toMatchObject({ accessibilityRole: 'tab', accessibilityState: { selected: true } });
    expect(flat(first).backgroundColor).toBe(colors.textPrimary);
    expect(flat(pressable(tree, 'plan-day-2')).backgroundColor).toBe(colors.fillChip);
    expect(allText(tree)).toContain('Day 1: Heavy A');
    // The "#n" pill is dropped as drawn.
    expect(allText(tree)).not.toContain('#1');
    await press(tree, 'plan-day-2');
    expect(apiClient.get).toHaveBeenCalledWith('/plans/9/days/2/exercises');
    expect(pressable(tree, 'plan-day-2').props.accessibilityState).toEqual({ selected: true });
  });

  it('review M3: the tablist holds only the day tabs ("Add a day" is a button outside it); the content is ONE tabpanel linked to the selected tab', async () => {
    const tree = await renderMember();
    const tablist = tree.root.find((node) => node.props.testID === 'plan-day-tabs' && node.props.accessibilityRole === 'tablist');
    const tabs = tablist.findAll((node) => typeof node.type === 'string' && node.props.accessibilityRole === 'tab');
    expect(tabs.map((node) => node.props.testID)).toEqual(['plan-day-1', 'plan-day-2']);
    expect(tablist.findAll((node) => node.props.testID === 'plan-add-day')).toHaveLength(0);
    expect(pressable(tree, 'plan-add-day').props.accessibilityRole).toBe('button');
    const panels = () => tree.root.findAll((node) => typeof node.type === 'string' && node.props.role === 'tabpanel');
    expect(panels()).toHaveLength(1);
    expect(panels()[0].props).toMatchObject({ testID: 'plan-day-panel', accessibilityLabel: 'Day 1: Heavy A', 'aria-labelledby': 'plan-day-tab-1' });
    expect(pressable(tree, 'plan-day-1').props.nativeID).toBe('plan-day-tab-1');
    // The strip and the exercise list sit inside the panel.
    expect(panels()[0].findAll((node) => node.props.testID === 'plan-day-strip').length).toBeGreaterThan(0);
    await press(tree, 'plan-day-2');
    expect(panels()[0].props).toMatchObject({ accessibilityLabel: 'Day 2: Heavy B', 'aria-labelledby': 'plan-day-tab-2' });
  });

  it('the selected-day strip carries the description and the day Edit / Delete', async () => {
    const tree = await renderMember();
    expect(allText(tree)).toContain('Squat focus');
    expect(pressable(tree, 'plan-day-delete-1').props.accessibilityLabel).toBe('Delete day 1');
    await press(tree, 'plan-day-edit-1');
    expect(tree.root.find((node) => node.props.testID === 'edit-day-modal' && node.props.isOpen !== undefined).props.isOpen).toBe(true);
  });

  it('the "Add a day" circle opens the Add day modal', async () => {
    const tree = await renderMember();
    const add = pressable(tree, 'plan-add-day');
    expect(add.props.accessibilityLabel).toBe('Add a day');
    expect(flat(add)).toMatchObject({ width: 40, height: 40, borderStyle: 'dashed' });
    await press(tree, 'plan-add-day');
    expect(tree.root.find((node) => node.props.testID === 'add-day-modal' && node.props.isOpen !== undefined).props.isOpen).toBe(true);
  });

  it('cards: a hero card with sets, the compact row without; no position badge; names read "exercise n of N"', async () => {
    const tree = await renderMember();
    const cards = tree.root.findAllByType(ExerciseCard);
    expect(cards).toHaveLength(2);
    expect(exists(tree, 'plan-exercise-photo-11')).toBe(true);
    expect(exists(tree, 'plan-exercise-photo-12')).toBe(false);
    const names = tree.root.findAll((node) => node.type === Text && /exercise \d of 2$/.test(node.props.accessibilityLabel ?? ''));
    expect(names.map((node) => node.props.accessibilityLabel)).toEqual(['Back Squat, exercise 1 of 2', 'Barbell Bench Press, exercise 2 of 2']);
    expect(allText(tree)).not.toContain('1');
    // Both rows keep Add set + Delete (code), Delete is the danger-tint button.
    expect(pressable(tree, 'plan-exercise-add-set-12')).toBeTruthy();
    expect(flat(host(tree, 'plan-exercise-delete-12'))).toMatchObject({ backgroundColor: colors.dangerDotTint, borderColor: colors.dangerDotBorder });
    expect(host(tree, 'plan-exercise-list').props.accessibilityRole).toBe('list');
    expect(allText(tree)).toContain('Drag the grip handle to reorder exercises.');
    expect(pill(tree, 'plan-add-exercise').props.variant).toBe('secondary');
  });

  it('a set row: "Set n", the summary, Edit / Delete labelled per set', async () => {
    const tree = await renderMember();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Set 1', '5 reps · 135 lb · 120s rest']));
    expect(pressable(tree, 'plan-set-edit-101').props.accessibilityLabel).toBe('Edit set 1 of Back Squat');
    await press(tree, 'plan-set-delete-101');
    const dialog = tree.root.find((node) => node.props.testID === 'plan-action-dialog' && node.props.isOpen !== undefined);
    expect(dialog.props).toMatchObject({ isOpen: true, title: 'Delete set 1?', description: 'This removes set 1 from Back Squat.' });
  });

  it('no days: the "No days yet" empty state in a surface card', async () => {
    setRoutes({ days: [] });
    const tree = await renderMember();
    expect(allText(tree)).toEqual(expect.arrayContaining(['No days yet', 'Add a day to start building this plan.']));
    expect(hosts(tree, 'plan-day-1')).toHaveLength(0);
  });

  it('inactive: the inactive banner + the hint; the overflow offers Activate', async () => {
    setRoutes({ plan: { ...PLAN, is_active: false } });
    const tree = await renderMember();
    expect(allText(tree)).toEqual(expect.arrayContaining(['This plan is inactive', 'Activate this plan to start it.']));
    expect(pressable(tree, 'plan-overflow').props.accessibilityLabel).toBe('More plan actions: Edit details, Make a copy, Activate, Delete plan');
    expect(pill(tree, 'my-plan-start').props.disabled).toBe(true);
  });

  it('the current plan hides Start and shows the status box', async () => {
    getCurrentPlan.mockResolvedValue({ enrollment: { id: 3, workout_plan_id: 9 } });
    const tree = await renderMember();
    expect(pill(tree, 'my-plan-start')).toBeUndefined();
    expect(allText(tree)).toEqual(expect.arrayContaining(['This is your current plan']));
  });
});

describe('member "Make a copy" (RN-SPEC-v2-phase4 §2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setRoutes();
  });
  afterEach(() => jest.useRealTimers());

  async function copyFromOverflow(tree) {
    await press(tree, 'plan-overflow');
    await press(tree, 'plan-overflow-make-copy');
    await act(async () => {
      jest.advanceTimersByTime(OVERFLOW_HANDOFF_MS);
    });
    await flush();
  }

  it('posts the own plan id, toasts and opens the copy with Edit details once', async () => {
    apiClient.post.mockReturnValue(ok({ plan: { id: 44 } }));
    const tree = await renderMember();
    await copyFromOverflow(tree);
    expect(apiClient.post).toHaveBeenCalledWith('/my-custom-plans/copies', { workout_plan_id: 9 });
    expect(addToast).toHaveBeenCalledWith('success', 'Plan copied', 'You’re now on your copy in My plans. Give it a name.');
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlan', { planId: 44, nameTheCopy: true });
  });

  it('no id in the response: "Your copy is in My plans." and My plans', async () => {
    apiClient.post.mockReturnValue(ok({}));
    const tree = await renderMember();
    await copyFromOverflow(tree);
    expect(addToast).toHaveBeenCalledWith('success', 'Plan copied', 'Your copy is in My plans.');
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlans');
  });

  it('404 → "This plan can’t be copied."; 403 → the server message', async () => {
    apiClient.post.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Nope' } } });
    let tree = await renderMember();
    await copyFromOverflow(tree);
    expect(addToast).toHaveBeenLastCalledWith('error', 'Could not copy the plan', 'This plan can’t be copied.');
    apiClient.post.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Your trainer manages your plans.' } } });
    tree = await renderMember();
    await copyFromOverflow(tree);
    expect(addToast).toHaveBeenLastCalledWith('error', 'Could not copy the plan', 'Your trainer manages your plans.');
  });

  it('one request at a time: the tablet button is loading and a second tap does nothing', async () => {
    mockWidth = 834;
    let resolve;
    apiClient.post.mockReturnValue(new Promise((done) => (resolve = done)));
    const tree = await renderMember();
    await press(tree, 'plan-make-copy');
    expect(pill(tree, 'plan-make-copy').props.loading).toBe(true);
    pill(tree, 'plan-make-copy').props.onPress();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ data: { data: { plan: { id: 5 } } } }));
    await flush();
    expect(pill(tree, 'plan-make-copy').props.loading).toBe(false);
  });
});

describe('member builder, tablet (UX I §2)', () => {
  beforeEach(() => {
    mockWidth = 834;
    setRoutes();
  });

  it('every plan action inline, no overflow; Start is the compact gold pill; Delete plan is danger-tint', async () => {
    const tree = await renderMember();
    expect(hosts(tree, 'plan-overflow')).toHaveLength(0);
    for (const id of ['plan-edit-details', 'plan-make-copy', 'plan-deactivate']) {
      expect(pill(tree, id).props).toMatchObject({ variant: 'secondary', size: 'compact' });
    }
    expect(flat(host(tree, 'plan-delete')).backgroundColor).toBe(colors.dangerDotTint);
    expect(pill(tree, 'my-plan-start').props).toMatchObject({ size: 'compact', fullWidth: false });
  });

  it('the days card (Plan days / Structure) with counts and per-day Edit / Delete; the selected day is gold-tint', async () => {
    const tree = await renderMember();
    expect(tree.root.findByType(DayListCard).props.look).toBe('member');
    expect(allText(tree)).toEqual(expect.arrayContaining(['Plan days', 'Structure', '2 exercises', '0 exercises']));
    expect(pressable(tree, 'plan-day-edit-2')).toBeTruthy();
    const selected = pressable(tree, 'plan-day-1');
    expect(selected.props.accessibilityState).toEqual({ selected: true });
    expect(StyleSheet.flatten(selected.parent.props.style)).toMatchObject({ backgroundColor: colors.goldTint, borderColor: colors.gold });
    expect(hosts(tree, 'plan-day-tabs')).toHaveLength(0);
  });

  it('two columns at 1×, one column past the §9 reflow point', async () => {
    let tree = await renderMember();
    const aside = (t) => t.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.width === 236);
    expect(aside(tree)).toHaveLength(1);
    mockFontScale = 3.1;
    tree = await renderMember();
    expect(aside(tree)).toHaveLength(0);
  });
});

describe('trainer builder (phase6 O)', () => {
  beforeEach(() => {
    mockRoute = { key: 'r', name: 'TrainerPlan', params: { planId: '9' } };
    setRoutes({ root: '/trainer/plans/9', count: 3 });
  });

  it('phone: back pill, the header card with the teal chip, Edit details + Make a copy, the gold-selected tabs, light Add exercise', async () => {
    const tree = await renderTrainer();
    expect(allText(tree)).toEqual(expect.arrayContaining(['All plans', 'Builder', 'Plan days']));
    expect(host(tree, 'plan-eyebrow-chip')).toBeTruthy();
    expect(pill(tree, 'plan-edit-details')).toBeTruthy();
    expect(pill(tree, 'plan-make-copy')).toBeTruthy();
    expect(flat(pressable(tree, 'plan-day-1')).backgroundColor).toBe(colors.gold);
    expect(pill(tree, 'plan-add-exercise').props.variant).toBe('light');
    expect(allText(tree)).toContain('Add a day');
  });

  it('the affected-clients banner (amber) when the count is > 0', async () => {
    const tree = await renderTrainer();
    expect(allText(tree)).toEqual(expect.arrayContaining(['3 clients are on this plan']));
    expect(flat(host(tree, 'plan-clients-banner')).backgroundColor).toBe(colors.warningFill);
  });

  it('"Sets" collapses a card to the compact row and expands it again (display only)', async () => {
    const tree = await renderTrainer();
    expect(exists(tree, 'plan-exercise-photo-11')).toBe(true);
    await press(tree, 'plan-exercise-sets-11');
    expect(exists(tree, 'plan-exercise-photo-11')).toBe(false);
    expect(hosts(tree, 'plan-set-101')).toHaveLength(0);
    expect(pill(tree, 'plan-exercise-sets-11').props.accessibilityLabel).toBe('Show the sets of Back Squat');
    await press(tree, 'plan-exercise-sets-11');
    expect(exists(tree, 'plan-exercise-photo-11')).toBe(true);
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('phone trainer set rows draw the gold-tint badge that reads "Set n"', async () => {
    const tree = await renderTrainer();
    const badge = tree.root.find((node) => typeof node.type === 'string' && node.props.accessibilityLabel === 'Set 1');
    expect(StyleSheet.flatten(badge.props.style).backgroundColor).toBe(colors.goldTint);
  });

  it('tablet: inline buttons in the card, the days panel, the gold Add exercise', async () => {
    mockWidth = 834;
    const tree = await renderTrainer();
    expect(hosts(tree, 'plan-overflow')).toHaveLength(0);
    expect(pill(tree, 'plan-deactivate')).toBeTruthy();
    expect(tree.root.findByType(DayListCard).props.look).toBe('trainer');
    expect(pill(tree, 'plan-add-exercise').props.variant).toBe('primary');
    expect(pill(tree, 'plan-add-day').props.variant).toBe('ghost');
  });

  it('copy without an id: "Your copy is in the plans list." → the plans list', async () => {
    apiClient.post.mockReturnValue(ok({}));
    const tree = await renderTrainer();
    await press(tree, 'plan-make-copy');
    expect(addToast).toHaveBeenCalledWith('success', 'Plan copied', 'Your copy is in the plans list.');
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlans');
  });

  it('catalog plan: chip "Plan", the public notice with the gold "Copy this plan", no overflow, the static list', async () => {
    setRoutes({ root: '/trainer/plans/9', own404: false });
    const tree = await renderTrainer();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Plan', 'This is a public plan']));
    expect(pill(tree, 'plan-copy-this').props.variant ?? 'primary').toBe('primary');
    expect(hosts(tree, 'plan-overflow')).toHaveLength(0);
    expect(pill(tree, 'plan-edit-details')).toBeUndefined();
    expect(tree.root.findAllByType(StaticExerciseList)).toHaveLength(1);
    expect(hosts(tree, 'plan-add-day')).toHaveLength(0);
  });
});

describe('builder confirms (a11y ruling: alert-style, Cancel first, blocked while running)', () => {
  beforeEach(() => setRoutes());

  it('Delete day: 409 shows the member conflict box; Cancel and the scrim do nothing while it runs', async () => {
    let reject;
    apiClient.delete.mockReturnValue(new Promise((_, fail) => (reject = fail)));
    const tree = await renderMember();
    await press(tree, 'plan-day-delete-1');
    const dialog = () => tree.root.find((node) => node.props.testID === 'plan-action-dialog' && node.props.isOpen !== undefined);
    expect(dialog().props.title).toBe('Delete Day 1?');
    await press(tree, 'plan-action-dialog-confirm');
    expect(pill(tree, 'plan-action-dialog-confirm').props.loading).toBe(true);
    await act(async () => pill(tree, 'plan-action-dialog-cancel').props.onPress());
    await act(async () => dialog().props.onClose());
    expect(dialog().props.isOpen).toBe(true);
    await act(async () => reject({ response: { status: 409, data: { message: 'Server says no' } } }));
    await flush();
    expect(allText(tree)).toEqual(
      expect.arrayContaining(['This day can’t be deleted while you’re on this plan, or once it has workout history.', 'Server says no'])
    );
    expect(host(tree, 'plan-action-error').props.accessibilityRole).toBe('alert');
    await act(async () => pill(tree, 'plan-action-dialog-cancel').props.onPress());
    expect(tree.root.findAll((node) => node.props.testID === 'plan-action-dialog' && node.props.isOpen === true)).toHaveLength(0);
  });

  it('Delete plan 409 on an active plan turns into "This plan can’t be deleted" with the gold Deactivate', async () => {
    jest.useFakeTimers();
    apiClient.delete.mockRejectedValue({ response: { status: 409, data: { message: 'On it' } } });
    const tree = await renderMember();
    await press(tree, 'plan-overflow');
    await press(tree, 'plan-overflow-delete');
    await act(async () => jest.advanceTimersByTime(OVERFLOW_HANDOFF_MS));
    await flush();
    await press(tree, 'plan-action-dialog-confirm');
    expect(pill(tree, 'plan-action-dialog-confirm').props).toMatchObject({ title: 'Deactivate plan', variant: 'primary' });
    expect(allText(tree)).toContain('On it');
    jest.useRealTimers();
  });
});

describe('review LOWs (builder a11y)', () => {
  beforeEach(() => setRoutes());

  it('the day "Edit" names its day, like "Delete day n" (phone strip and tablet days card)', async () => {
    const tree = await renderMember();
    expect(pressable(tree, 'plan-day-edit-1').props.accessibilityLabel).toBe('Edit day 1');
    mockWidth = 834;
    const tablet = await renderMember();
    expect(pressable(tablet, 'plan-day-edit-1').props.accessibilityLabel).toBe('Edit day 1');
  });

  it('a double tap on a confirm runs the action ONCE', async () => {
    apiClient.delete.mockReturnValue(new Promise(() => {}));
    const tree = await renderMember();
    await press(tree, 'plan-day-delete-1');
    const onPress = pill(tree, 'plan-action-dialog-confirm').props.onPress;
    await act(async () => {
      onPress();
      onPress();
    });
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
  });

  it('the plain row grip (28 wide) reaches 44 with hitSlop', async () => {
    const tree = await renderMember();
    const grip = tree.root.find((node) => node.props.testID === 'plan-exercise-grip-12' && typeof node.props.onAccessibilityAction === 'function');
    expect(StyleSheet.flatten(grip.props.style).width).toBe(28);
    expect(grip.props.hitSlop).toEqual({ top: 0, bottom: 0, left: 8, right: 8 });
  });
});

// Review 26fc4a8 M2: builder confirms are ALERT dialogs (role alertdialog).
describe('review M2: the builder confirm is an alertdialog', () => {
  beforeEach(() => setRoutes());

  it('PlanActionDialog asks AppModal for role "alertdialog"', async () => {
    const tree = await renderMember();
    await press(tree, 'plan-day-delete-1');
    const modal = tree.root.find((node) => node.type === AppModal && node.props.testID === 'plan-action-dialog');
    expect(modal.props.role).toBe('alertdialog');
  });

  it('the dialog card host view carries role "alertdialog"', async () => {
    const tree = await renderMember();
    await press(tree, 'plan-day-delete-1');
    expect(host(tree, 'plan-action-dialog').props.role).toBe('alertdialog');
  });
});

// Review 26fc4a8 M7: reorder through the grip's Move up / Move down actions.
describe('review M7: reorder (Move up / Move down)', () => {
  beforeEach(() => setRoutes());

  const names = (tree) => allText(tree).filter((value) => value === 'Back Squat' || value === 'Barbell Bench Press');
  const moveAction = async (tree, id, actionName) => {
    const grip = tree.root.find((node) => node.props.testID === id && typeof node.props.onAccessibilityAction === 'function');
    await act(async () => grip.props.onAccessibilityAction({ nativeEvent: { actionName } }));
    await flush();
  };

  it('the grip offers Move up / Move down, labelled "Drag to reorder {name}"', async () => {
    const tree = await renderMember();
    const grip = tree.root.find((node) => node.props.testID === 'plan-exercise-grip-11' && typeof node.props.onAccessibilityAction === 'function');
    expect(grip.props.accessibilityLabel).toBe('Drag to reorder Back Squat');
    expect(grip.props.accessibilityActions.map((action) => action.label)).toEqual(['Move up', 'Move down']);
  });

  it('Move down on the first row: optimistic new order + POST the whole order', async () => {
    apiClient.post.mockResolvedValue({ data: { data: { items: [{ id: 12, order_index: 1 }, { id: 11, order_index: 2 }] } } });
    const tree = await renderMember();
    expect(names(tree)).toEqual(['Back Squat', 'Barbell Bench Press']);
    await moveAction(tree, 'plan-exercise-grip-11', 'moveDown');
    expect(apiClient.post).toHaveBeenCalledWith('/my-custom-plans/9/days/1/exercises/reorder', { order: [12, 11] });
    expect(names(tree)).toEqual(['Barbell Bench Press', 'Back Squat']);
  });

  it('Move up on the last row moves it first', async () => {
    apiClient.post.mockResolvedValue({ data: { data: { items: [] } } });
    const tree = await renderMember();
    await moveAction(tree, 'plan-exercise-grip-12', 'moveUp');
    expect(apiClient.post).toHaveBeenCalledWith('/my-custom-plans/9/days/1/exercises/reorder', { order: [12, 11] });
    expect(names(tree)).toEqual(['Barbell Bench Press', 'Back Squat']);
  });

  it('edges do nothing: Move up on the first row, Move down on the last', async () => {
    const tree = await renderMember();
    await moveAction(tree, 'plan-exercise-grip-11', 'moveUp');
    await moveAction(tree, 'plan-exercise-grip-12', 'moveDown');
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(names(tree)).toEqual(['Back Squat', 'Barbell Bench Press']);
  });

  it('a failed reorder snaps back to the old order with the error toast', async () => {
    apiClient.post.mockRejectedValue({ response: { status: 500, data: { message: 'Nope' } } });
    const tree = await renderMember();
    await moveAction(tree, 'plan-exercise-grip-11', 'moveDown');
    expect(names(tree)).toEqual(['Back Squat', 'Barbell Bench Press']);
    expect(addToast).toHaveBeenCalledWith('error', 'Could not reorder the exercises', 'Nope');
  });
});

describe('§9 large text (fontScale 1 / 2 / 3.1)', () => {
  beforeEach(() => setRoutes());

  it.each([1, 2, 3.1])('member phone at %s×: the title caps at 1.3×, the action row stacks past 1.3×', async (scale) => {
    mockFontScale = scale;
    const tree = await renderMember();
    const title = tree.root.find((node) => node.type === Text && node.props.accessibilityRole === 'header' && node.props.children === 'My strength plan');
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: textScale.display, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    const direction = flat(host(tree, 'plan-header-actions')).flexDirection;
    expect(direction).toBe(scale > textScale.reflowAbove ? 'column' : 'row');
  });

  it.each([1, 2, 3.1])('set rows at %s×: Edit / Delete drop below the text past 1.3×', async (scale) => {
    mockFontScale = scale;
    const tree = await renderMember();
    const direction = StyleSheet.flatten(host(tree, 'plan-set-101').props.style).flexDirection;
    expect(direction).toBe(scale > textScale.reflowAbove ? 'column' : 'row');
  });

  it.each([1, 3.1])('trainer tablet at %s×: the copy stays whole (no numberOfLines on names)', async (scale) => {
    mockWidth = 834;
    mockFontScale = scale;
    mockRoute = { key: 'r', name: 'TrainerPlan', params: { planId: '9' } };
    setRoutes({ root: '/trainer/plans/9' });
    const tree = await renderTrainer();
    const name = tree.root.find((node) => node.type === Text && node.props.accessibilityLabel === 'Back Squat, exercise 1 of 2');
    expect(name.props.numberOfLines).toBeUndefined();
    expect(name.props.maxFontSizeMultiplier).toBe(textScale.body);
  });
});

