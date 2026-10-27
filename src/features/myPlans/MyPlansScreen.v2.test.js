// v2 Phase 4 §1 (UX H My plans #14 / Tablet: My plans #90, N4 dark cards):
// the v2 layout, every state, the cards, the copy card and §9 large text.
let mockWindow = { width: 390, height: 844, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ scale: 3, ...mockWindow }),
}));
const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'MyPlans-1', name: 'MyPlans', params: {} }),
}));
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children, testID, glow }) => (
    <View testID={testID} glow={glow}>
      {children}
    </View>
  );
});
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('./myPlanRoutes', () => ({
  myPlanRoutes: { MyPlans: 'MyPlans', MyPlanCreate: 'MyPlanCreate', MyPlan: 'MyPlan', PlanGenerator: 'PlanGenerator' },
}));
jest.mock('./api/myPlansApi', () => ({ listMyPlans: jest.fn(), isGeneratorAvailable: jest.fn(), copyToMyPlans: jest.fn() }));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'), ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import GradientFill from '../../shared/components/GradientFill';
import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { addToast } from '../../shared/components/toastStore';
import { colors, gradients, radii, textScale } from '../../shared/theme/tokens';
import { copyToMyPlans, isGeneratorAvailable, listMyPlans } from './api/myPlansApi';
import CopyToMyPlansCard, { COPY_NO_ID_MESSAGE, COPY_SUCCESS_MESSAGE } from './components/CopyToMyPlansCard';
import MyPlansEntryCard from './components/MyPlansEntryCard';
import MyPlansScreen, { MY_PLANS_GLOW, MY_PLANS_GLOW_TABLET } from './MyPlansScreen';

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(textOf);
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const button = (tree, id) => tree.root.findAllByType(PillButton).find((node) => node.props.testID === id);
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

const PLANS = [
  { id: 1, name: 'My strength plan', is_active: true, days_per_week: 3, category: { name: 'Strength' }, description: 'Heavy basics.' },
  { id: 2, name: 'Push / Pull / Legs (copy)', is_active: false, days_per_week: 6, category: { name: 'Hypertrophy' } },
  { id: 3, name: 'Build Muscle', is_active: true, days_per_week: 4 },
];
const page = (items, extra = {}) => ({ items, currentPage: 1, totalPages: 1, totalRecords: items.length, ...extra });

async function render(element = <MyPlansScreen />) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  isGeneratorAvailable.mockResolvedValue(true);
  listMyPlans.mockResolvedValue(page(PLANS));
});

describe('My plans (phone)', () => {
  it('the glow, the gold back link, the 46 title + subtitle, gold Create + glass Build me a plan', async () => {
    const tree = await render();
    expect(host(tree, 'my-plans-screen').props.glow).toBe(MY_PLANS_GLOW);
    expect(MY_PLANS_GLOW.colors).toBe(gradients.accountGlow.colors);
    expect(texts(tree)).toEqual(expect.arrayContaining(['← All plans', 'My plans', 'Plans you build or copy from the catalog. Only you can see them.']));
    const title = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'My plans')[0];
    expect(flat(title).fontSize).toBe(46);
    const create_ = button(tree, 'my-plans-create');
    const generate = button(tree, 'my-plans-generate');
    expect([create_.props.variant ?? 'primary', generate.props.variant]).toEqual(['primary', 'secondary']);
    expect(StyleSheet.flatten(create_.props.style)).toEqual({ flex: 1 });
    await act(async () => create_.props.onPress());
    await act(async () => generate.props.onPress());
    expect(mockNavigation.push.mock.calls.map((call) => call[0])).toEqual(['MyPlanCreate', 'PlanGenerator']);
  });

  it('N4: every card is dark (gradient-card), radius 28; the only gold is "Create a plan"', async () => {
    const tree = await render();
    const card = host(tree, 'my-plan-card-1');
    expect(flat(card)).toEqual(expect.objectContaining({ borderRadius: radii.xxl, padding: 20, borderColor: colors.hairline }));
    expect(card.findAllByType(GradientFill)[0].props.colors).toBe(gradients.card.colors);
    expect(flat(card).backgroundColor).toBeUndefined();
    const golds = tree.root.findAllByType(PillButton).filter((node) => (node.props.variant ?? 'primary') === 'primary');
    expect(golds.map((node) => node.props.testID)).toEqual(['my-plans-create']);
  });

  it('cards: category, the Inactive status pill, name as heading, days, description; Open labelled with the name', async () => {
    const tree = await render();
    const pill = tree.root.findAllByType(StatusPill).find((node) => node.props.testID === 'my-plan-card-inactive-2');
    expect([pill.props.label, pill.props.tone]).toEqual(['Inactive', 'inactive']);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Strength', 'My strength plan', '3\u00a0days / week', 'Heavy basics.', 'Plan']));
    const open = button(tree, 'my-plan-card-open-2');
    expect([open.props.accessibilityLabel, open.props.variant, open.props.size]).toEqual(['Open Push / Pull / Legs (copy)', 'secondary', 'compact']);
    await act(async () => open.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlan', { planId: 2 });
  });

  it('one card per row on the phone (no featured card)', async () => {
    const tree = await render();
    const list = host(tree, 'my-plans-list');
    expect(list.props.accessibilityRole).toBe('list');
    expect(tree.root.findAll((node) => node.props.testID === 'my-plan-card-glow' && typeof node.type === 'string')).toHaveLength(0);
  });

  it('no generator: only Create a plan', async () => {
    isGeneratorAvailable.mockResolvedValue(false);
    const tree = await render();
    expect(button(tree, 'my-plans-generate')).toBeUndefined();
  });

  it('pager: "Page 1 of 3 · 45 total", glass compact Previous (disabled) / Next → page 2', async () => {
    listMyPlans.mockResolvedValue(page(PLANS, { totalPages: 3, totalRecords: 45 }));
    const tree = await render();
    expect(texts(tree)).toContain('Page 1 of 3 · 45 total');
    expect([button(tree, 'my-plans-previous').props.disabled, button(tree, 'my-plans-next').props.size]).toEqual([true, 'compact']);
    await act(async () => button(tree, 'my-plans-next').props.onPress());
    expect(listMyPlans).toHaveBeenLastCalledWith(2);
  });

  it('on hold: the box replaces the actions and the list', async () => {
    listMyPlans.mockRejectedValue({ response: { status: 403, data: { message: 'Paused' } } });
    const tree = await render();
    expect(host(tree, 'my-plans-actions')).toBeUndefined();
    expect(host(tree, 'my-plans-list')).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Your plans are on hold', 'Paused']));
  });
});

describe('Tablet: My plans', () => {
  beforeEach(() => {
    mockWindow = { width: 834, height: 1194, fontScale: 1 };
  });

  it('the tablet glow, the 60 title, inline actions', async () => {
    const tree = await render();
    expect(host(tree, 'my-plans-screen').props.glow).toBe(MY_PLANS_GLOW_TABLET);
    const title = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'My plans')[0];
    expect(flat(title).fontSize).toBe(60);
    expect(button(tree, 'my-plans-create').props.style).toBeNull();
    expect(flat(host(tree, 'my-plans-actions')).gap).toBe(10);
  });

  it('the first card is featured (display-lg name, the glow, a 52 Open); the rest pair up', async () => {
    const tree = await render();
    expect(host(tree, 'my-plan-card-glow')).toBeDefined();
    const featuredName = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'My strength plan')[0];
    expect(flat(featuredName).fontSize).toBe(52);
    expect(button(tree, 'my-plan-card-open-1').props.size).toBe('default');
    expect(button(tree, 'my-plan-card-open-2').props.size).toBe('compact');
    const list = host(tree, 'my-plans-list');
    const rows = list.children.filter((child) => typeof child !== 'string');
    expect(rows).toHaveLength(2);
  });
});

describe('My plans large text (§9)', () => {
  it.each([
    [1, 'row', false],
    [2, 'column', true],
    [3.1, 'column', true],
  ])('fontScale %s: the action pair is a %s (full width %s); the title keeps the display cap', async (fontScale, direction, full) => {
    mockWindow = { width: 390, height: 844, fontScale };
    const tree = await render();
    expect(flat(host(tree, 'my-plans-actions')).flexDirection).toBe(direction);
    expect(Boolean(button(tree, 'my-plans-create').props.fullWidth)).toBe(full);
    const title = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'My plans')[0];
    expect(title.props).toEqual(expect.objectContaining({ maxFontSizeMultiplier: textScale.display, adjustsFontSizeToFit: true }));
  });

  it('tablet past 1.3×: one card per row', async () => {
    mockWindow = { width: 834, height: 1194, fontScale: 2 };
    const tree = await render();
    const rows = host(tree, 'my-plans-list').children.filter((child) => typeof child !== 'string');
    expect(rows).toHaveLength(3);
  });
});

describe('Entry card + copy card (v2)', () => {
  it('My plans entry: the phone tile and the tablet row (56 icon tile), one link', async () => {
    let tree = await render(<MyPlansEntryCard />);
    const tile = tree.root.findAll((node) => node.props.testID === 'my-plans-entry' && typeof node.props.style === 'function')[0];
    expect(flat(tile)).toEqual(expect.objectContaining({ borderRadius: radii.xl, padding: 16 }));
    expect(StyleSheet.flatten(tile.props.style({ pressed: true })).borderColor).toBe(colors.goldLine);
    tree = await render(<MyPlansEntryCard layout="row" />);
    const row = tree.root.findAll((node) => node.props.testID === 'my-plans-entry' && typeof node.props.style === 'function')[0];
    expect(flat(row)).toEqual(expect.objectContaining({ flexDirection: 'row', borderRadius: radii.xxl }));
  });

  it('copy card: the v2 card, a glass full-width button; loading while copying', async () => {
    copyToMyPlans.mockReturnValue(new Promise(() => {}));
    const tree = await render(<CopyToMyPlansCard planId="12" />);
    expect(flat(host(tree, 'copy-to-my-plans'))).toEqual(expect.objectContaining({ borderRadius: radii.xxl, padding: 22, backgroundColor: colors.surface }));
    const copy = button(tree, 'copy-to-my-plans-button');
    expect([copy.props.variant, copy.props.fullWidth, copy.props.loading]).toEqual(['secondary', true, false]);
    await act(async () => {
      copy.props.onPress();
    });
    expect([button(tree, 'copy-to-my-plans-button').props.loading, button(tree, 'copy-to-my-plans-button').props.disabled]).toEqual([true, true]);
  });

  it('copy success toasts: the name-the-copy message, or "Your copy is in My plans." without an id', async () => {
    copyToMyPlans.mockResolvedValue({ id: 7 });
    let tree = await render(<CopyToMyPlansCard planId="12" />);
    await act(async () => button(tree, 'copy-to-my-plans-button').props.onPress());
    expect(addToast).toHaveBeenLastCalledWith('success', 'Plan copied', COPY_SUCCESS_MESSAGE);
    copyToMyPlans.mockResolvedValue({});
    tree = await render(<CopyToMyPlansCard planId="12" />);
    await act(async () => button(tree, 'copy-to-my-plans-button').props.onPress());
    expect(addToast).toHaveBeenLastCalledWith('success', 'Plan copied', COPY_NO_ID_MESSAGE);
    expect(COPY_NO_ID_MESSAGE).toBe('Your copy is in My plans.');
  });

  it('copy error: the 403 on-hold sentence in danger text, role alert', async () => {
    copyToMyPlans.mockRejectedValue({ response: { status: 403, data: { message: 'Unavailable.' } } });
    const tree = await render(<CopyToMyPlansCard planId="12" />);
    await act(async () => button(tree, 'copy-to-my-plans-button').props.onPress());
    const error = host(tree, 'copy-to-my-plans-error');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(flat(error).color).toBe(colors.dangerText);
    expect(textOf(error)).toMatch(/^Unavailable\. They’re kept safe/);
  });
});
