// v2 Phase 4 §1 (UX H Plans #21 / Tablet: Plans #88): every state and
// action of S1, phone and tablet, and §9 large text at 1 / 2 / 3.1.
let mockWindow = { width: 390, height: 844, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ scale: 3, ...mockWindow }),
}));
const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'PlansLibrary-1', name: 'PlansLibrary', params: {} }),
}));
jest.mock('../../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children, testID }) => <View testID={testID}>{children}</View>;
});
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../api/libraryApi', () => ({ listPlans: jest.fn(), getCurrentPlan: jest.fn() }));
jest.mock('../../myPlans/api/myPlansApi', () => ({ listMyPlans: jest.fn() }));
jest.mock('../../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn() }));

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import { colors, radii, textScale } from '../../../shared/theme/tokens';
import { listMyPlans } from '../../myPlans/api/myPlansApi';
import { getGeneratorProfile } from '../../planGenerator/api/generatorApi';
import { openShellPath } from '../../shell/shellLinks';
import { getCurrentPlan, listPlans } from '../api/libraryApi';
import PlansLibraryScreen from './PlansLibraryScreen';

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(textOf);
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const pressableEl = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.children === 'function')[0];
// The PressOverlay element a Pressable's children render for a press state.
const overlayOf = (node, pressed) => [].concat(node.props.children({ pressed }).props.children).find((child) => child?.props && 'pressed' in child.props);
const flat = (node, pressed = false) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed }) : node.props.style);
const pending = () => new Promise(() => {});

const weekday = (id, name) => ({ id, name, sort_order: id });
const PLANS = [
  { id: 1, name: 'Upper / Lower Split', is_active: true, days_per_week: 4, category: { name: 'Strength' } },
  { id: 2, name: 'Push / Pull / Legs', is_active: true, days_per_week: 6, category: { name: 'Hypertrophy' }, description: 'A classic split.' },
  { id: 3, name: 'Full Body Basics', is_active: true, days_per_week: 3, category: { name: 'Hypertrophy' } },
];
const CURRENT = {
  enrollment: { id: 50, plan: { id: 1 } },
  schedule: [
    { weekday: weekday(1, 'Monday'), plan_day: { title: 'Upper A' } },
    { weekday: weekday(4, 'Thursday'), plan_day: { title: 'Lower A' } },
  ],
};

async function render() {
  let tree;
  await act(async () => {
    tree = create(<PlansLibraryScreen />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  listPlans.mockResolvedValue(PLANS);
  getCurrentPlan.mockResolvedValue(CURRENT);
  listMyPlans.mockResolvedValue({ items: [] });
  getGeneratorProfile.mockResolvedValue({ available: true });
});

describe('Plans states', () => {
  it('loading: "Loading plans" in the state column', async () => {
    listPlans.mockReturnValue(pending());
    const tree = await render();
    expect(tree.root.findByType(Loader).props.label).toBe('Loading plans');
    expect(host(tree, 'plans-active-card')).toBeUndefined();
  });

  it('error (N2): "Plans unavailable" + the transport text + Retry, which re-runs the load', async () => {
    listPlans.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    const tree = await render();
    const error = tree.root.findByType(InlineError);
    expect([error.props.title, error.props.message]).toEqual(['Plans unavailable', 'Network Error']);
    await act(async () => pressable(tree, 'plans-retry').props.onPress());
    expect(listPlans).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(InlineError)).toHaveLength(0);
    expect(host(tree, 'plans-active-card')).toBeDefined();
  });

  it('error without a transport text: "Please try again."', async () => {
    listPlans.mockRejectedValueOnce({});
    const tree = await render();
    expect(tree.root.findByType(InlineError).props.message).toBe('Please try again.');
  });

  it('a 404 current plan = no active plan; "Choose your next plan" with the count', async () => {
    getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
    const tree = await render();
    expect(host(tree, 'plans-active-card')).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Choose your next plan', '3 plans']));
  });

  it('empty (0 plans): the EmptyState copy; no browse heading', async () => {
    listPlans.mockResolvedValue([]);
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['No plans available', 'No active workout plans were returned by the backend.']));
    expect(texts(tree)).not.toContain('Choose your next plan');
  });

  it('active plan only: the card + entry tiles, no section heading', async () => {
    listPlans.mockResolvedValue([PLANS[0]]);
    const tree = await render();
    expect(host(tree, 'plans-active-card')).toBeDefined();
    expect(texts(tree)).not.toContain('Switch your plan');
  });
});

describe('Plans active card (gold as drawn, N4)', () => {
  it('flat gold, radius 28, padding 22; badge, category top-right, the name, the days line', async () => {
    const tree = await render();
    const card = flat(host(tree, 'plans-active-card'));
    expect(card).toEqual(expect.objectContaining({ backgroundColor: colors.gold, borderRadius: radii.xxl, padding: 22, overflow: 'hidden' }));
    expect(flat(host(tree, 'plans-active-ring'))).toEqual(expect.objectContaining({ width: 220, borderWidth: 28, borderColor: colors.inkFaint }));
    expect(flat(host(tree, 'plans-active-badge')).backgroundColor).toBe(colors.inkTint);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Active plan', 'Strength', 'Upper / Lower Split', '4 training days / week', 'Your week']));
    expect(texts(tree)).not.toContain('4 training days / week · Strength');
  });

  it('the week: 7 read-only chips, training days dark with gold text, labelled with full names', async () => {
    const tree = await render();
    const row = host(tree, 'plans-week-chips');
    expect(row.props.accessibilityLabel).toBe('Training days: Monday, Thursday');
    expect(row.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('plans-week-chip-') && typeof node.type === 'string')).toHaveLength(7);
    expect(flat(host(tree, 'plans-week-chip-1')).backgroundColor).toBe(colors.ground);
    expect(flat(host(tree, 'plans-week-chip-2')).backgroundColor).toBe(colors.inkTint);
  });

  it('without schedule days the "Your week" block hides', async () => {
    getCurrentPlan.mockResolvedValue({ enrollment: { id: 50, plan: { id: 1 } }, schedule: [] });
    const tree = await render();
    expect(texts(tree)).not.toContain('Your week');
    expect(host(tree, 'plans-week-chips')).toBeUndefined();
  });

  it('Go to workout → the Workout tab; View plan → Plan detail', async () => {
    const tree = await render();
    await act(async () => pressable(tree, 'plans-go-to-workout').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/workout');
    await act(async () => pressable(tree, 'plans-view-active').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanDetail', { planId: '1' });
  });

  it('pressed: the dark button keeps its fill and gains the white 4 % overlay; the ink one the ink overlay', async () => {
    const tree = await render();
    const go = pressableEl(tree, 'plans-go-to-workout');
    expect(overlayOf(go, true).props.pressed).toBe(true);
    expect(Boolean(overlayOf(go, true).props.ink)).toBe(false);
    expect(flat(go).backgroundColor).toBe(colors.ground);
    const view = pressableEl(tree, 'plans-view-active');
    expect(overlayOf(view, true).props).toEqual(expect.objectContaining({ pressed: true, ink: true }));
    expect(overlayOf(view, false).props.pressed).toBe(false);
    expect(flat(view).backgroundColor).toBe(colors.inkTint);
  });
});

describe('Plans entry tiles and plan tiles', () => {
  it('My plans + Build me a plan side by side; each opens its screen', async () => {
    const tree = await render();
    await act(async () => pressable(tree, 'my-plans-entry').props.onPress());
    await act(async () => pressable(tree, 'generator-entry-start').props.onPress());
    expect(mockNavigation.push.mock.calls.map((call) => call[0])).toEqual(['MyPlans', 'PlanGenerator']);
    expect(flat(pressable(tree, 'my-plans-entry'))).toEqual(expect.objectContaining({ flexGrow: 1, flexBasis: 0 }));
  });

  it('generator unavailable: no tile and "My plans" spans the row', async () => {
    getGeneratorProfile.mockResolvedValue({ available: false });
    const tree = await render();
    expect(pressable(tree, 'generator-entry-start')).toBeUndefined();
    expect(flat(pressable(tree, 'my-plans-entry')).width).toBe('100%');
  });

  it('"Switch your plan" + "2 plans", grouped by category with sub-headings; a tile opens Plan detail', async () => {
    listPlans.mockResolvedValue([...PLANS, { id: 4, name: '5×5', is_active: true, days_per_week: 3, category: { name: 'Strength' } }]);
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Switch your plan', '3 plans', 'Hypertrophy', 'Strength']));
    const tile = pressable(tree, 'plans-card-2');
    expect(tile.props.accessibilityLabel).toBe('Push / Pull / Legs, Hypertrophy, 6 days / week, A classic split.');
    await act(async () => tile.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanDetail', { planId: '2' });
  });

  it('phone tiles: two per row; radius 24, padding 16; pressed = gold-line edge + overlay', async () => {
    const tree = await render();
    const rows = hosts(tree, 'plans-tile-row');
    expect(rows).toHaveLength(1);
    const tile = pressable(tree, 'plans-card-2');
    expect(flat(tile)).toEqual(expect.objectContaining({ borderRadius: radii.xl, padding: 16, backgroundColor: colors.surface }));
    expect(flat(tile, true).borderColor).toBe(colors.goldLine);
    expect(overlayOf(tile, true).props.pressed).toBe(true);
  });

  it('phone: no "New plan" and no My plans check', async () => {
    const tree = await render();
    expect(pressable(tree, 'plans-new-plan')).toBeUndefined();
    expect(listMyPlans).not.toHaveBeenCalled();
  });
});

describe('Tablet: Plans', () => {
  beforeEach(() => {
    mockWindow = { width: 834, height: 1194, fontScale: 1 };
  });

  it('N1 "New plan" (glass, plus icon) → My plan create', async () => {
    const tree = await render();
    const button = pressable(tree, 'plans-new-plan');
    expect(button.props.variant).toBe('secondary');
    await act(async () => button.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlanCreate');
  });

  it('"New plan" is hidden for a member on hold (403), shown on any other failure', async () => {
    listMyPlans.mockRejectedValueOnce({ response: { status: 403 } });
    let tree = await render();
    expect(pressable(tree, 'plans-new-plan')).toBeUndefined();
    listMyPlans.mockRejectedValueOnce({ response: { status: 500 } });
    tree = await render();
    expect(pressable(tree, 'plans-new-plan')).toBeDefined();
  });

  it('the active card: radius 32, padding 32, the 7-day grid with the day titles, the 56 pair', async () => {
    const tree = await render();
    expect(flat(host(tree, 'plans-active-card'))).toEqual(expect.objectContaining({ borderRadius: radii.xxxl, padding: 32 }));
    expect(texts(tree)).toEqual(expect.arrayContaining(['Strength · 4 days / week', 'Upper A', 'Lower A']));
    expect(host(tree, 'plans-week-grid').props.accessibilityLabel).toBe('Training days: Monday, Thursday');
    expect(flat(host(tree, 'plans-week-cell-4')).backgroundColor).toBe(colors.ground);
    expect(flat(pressableEl(tree, 'plans-go-to-workout')).minHeight).toBe(56);
  });

  it('entry rows side by side with "Get started" as a TextLink; plan cards 2 per row at radius 28', async () => {
    const tree = await render();
    expect(host(tree, 'generator-entry-card')).toBeDefined();
    expect(texts(tree)).toContain('Get started →');
    const tile = pressable(tree, 'plans-card-2');
    expect(flat(tile)).toEqual(expect.objectContaining({ borderRadius: radii.xxl, padding: 22, gap: 36 }));
    expect(hosts(tree, 'plans-tile-row')).toHaveLength(1);
  });
});

describe('Plans large text (§9)', () => {
  it.each([
    [1, 'row', 1],
    [2, 'column', 2],
    [3.1, 'column', 2],
  ])('fontScale %s: actions %s, %s tile rows; titles capped and shrink-to-fit', async (fontScale, direction, rowCount) => {
    mockWindow = { width: 390, height: 844, fontScale };
    const tree = await render();
    expect(flat(host(tree, 'plans-active-actions')).flexDirection).toBe(direction);
    expect(hosts(tree, 'plans-tile-row')).toHaveLength(rowCount);
    const title = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Upper / Lower Split')[0];
    expect(title.props).toEqual(expect.objectContaining({ maxFontSizeMultiplier: textScale.display, adjustsFontSizeToFit: true, minimumFontScale: 0.7 }));
    // Button labels never truncate.
    const label = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Go to workout')[0];
    expect(label.props.numberOfLines).toBeUndefined();
  });

  it('tablet past 1.3×: the week grid becomes the wrapping chip row', async () => {
    mockWindow = { width: 834, height: 1194, fontScale: 2 };
    const tree = await render();
    expect(host(tree, 'plans-week-grid')).toBeUndefined();
    expect(flat(host(tree, 'plans-week-chips')).flexWrap).toBe('wrap');
  });
});
