import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import GradientFill from '../../../shared/components/GradientFill';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import { addToast } from '../../../shared/components/toastStore';
import { colors, gradients, muscle, radii, textScale } from '../../../shared/theme/tokens';
import { assignPlan } from '../clients/api/clientsApi';
import { openClientDetail } from '../clients/clientLinks';
import { listTrainerPlans } from './api/plansApi';
import PlanCard from './components/PlanCard';
import { CategoryChip, CoachingChip } from './components/TrainerChips';
import { CATEGORY_COLORS, CATEGORY_FILL_ALPHA, categoryColor, categoryColorIndex, planCategoryLabel } from './planCategoryColor';
import PlansListScreen, { BROWSE_SUBTITLE, TABLET_PLANS_GLOW, chunkRows, planColumns } from './screens/PlansListScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockParams = {};
let mockShellProps;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'TrainerPlans-1', name: 'TrainerPlans', params: mockParams }),
}));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shell/ShellPage', () => (props) => {
  mockShellProps = props;
  return props.children;
});
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('../clients/clientLinks', () => ({ openClientDetail: jest.fn() }));
jest.mock('../clients/api/clientsApi', () => ({ assignPlan: jest.fn() }));
jest.mock('./api/plansApi', () => ({ listTrainerPlans: jest.fn() }));
jest.mock('../../../shared/components/toastStore', () => ({
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const PLANS = [
  { id: 1, name: 'Upper / Lower Split', days_per_week: 4, category: { name: 'Strength' }, description: 'Alternate upper and lower days.' },
  { id: 2, name: 'Push / Pull / Legs', days_per_week: 6, category: { name: 'Hypertrophy' } },
  { id: 3, name: 'Full Body Basics', days_per_week: 0, category: null },
];
const page = (overrides = {}) => ({ items: PLANS, currentPage: 1, totalPages: 1, totalRecords: 3, ...overrides });

const texts = (root) =>
  root
    .findAll((node) => node.type === 'Text')
    .map((node) =>
      []
        .concat(node.props.children)
        .filter((c) => typeof c !== 'object')
        .join(''),
    );
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string');
const hosts = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (style) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) ?? {};

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

const card = (root, id) => root.findAll((node) => node.type === PlanCard && node.props.plan.id === id)[0];
function mount(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<PlansListScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  setWindow(390);
  listTrainerPlans.mockResolvedValue(page());
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

describe('planCategoryColor (RN-SPEC-v2-phase5 §1 category rule)', () => {
  it('index = sum of UTF-16 code units mod 6 over the avatar list', () => {
    const sum = [...'Strength'].reduce((total, ch) => total + ch.charCodeAt(0), 0);
    expect(categoryColorIndex('Strength')).toBe(sum % 6);
    expect(categoryColor('Strength')).toBe(CATEGORY_COLORS[sum % 6]);
    expect(CATEGORY_COLORS).toEqual([muscle.chest, muscle.back, muscle.cardio, muscle.legs, muscle.arms, muscle.core]);
    expect(CATEGORY_FILL_ALPHA).toBe(0.14);
  });

  it('is deterministic and never fails on empty or missing names', () => {
    expect(categoryColorIndex('Hypertrophy')).toBe(categoryColorIndex('Hypertrophy'));
    expect(categoryColorIndex('')).toBe(0);
    expect(categoryColorIndex(undefined)).toBe(0);
    // A surrogate pair counts as two code units.
    expect(categoryColorIndex('💪')).toBe((0xd83d + 0xdcaa) % 6);
  });

  it('labels the chip with the category name, or "Plan"', () => {
    expect(planCategoryLabel(PLANS[0])).toBe('Strength');
    expect(planCategoryLabel(PLANS[2])).toBe('Plan');
    expect(planCategoryLabel({ category: { name: '' } })).toBe('Plan');
  });
});

describe('grid helpers', () => {
  it('planColumns: tablet 2; phone 2 in browse, 1 in assign mode or above the reflow point', () => {
    expect(planColumns({ tablet: true, assigning: true, reflow: true })).toBe(2);
    expect(planColumns({ tablet: false, assigning: false, reflow: false })).toBe(2);
    expect(planColumns({ tablet: false, assigning: true, reflow: false })).toBe(1);
    expect(planColumns({ tablet: false, assigning: false, reflow: true })).toBe(1);
  });

  it('chunkRows splits into rows of n', () => {
    expect(chunkRows([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunkRows([1, 2], 1)).toEqual([[1], [2]]);
    expect(chunkRows([], 2)).toEqual([]);
  });
});

describe('CoachingChip / CategoryChip', () => {
  it('Coaching chip: teal text on teal 14 %, 28 tall minimum, a 6 px dot', () => {
    const tree = mount(<CoachingChip />);
    const chip = flat(hosts(tree.root, 'coaching-chip')[0].props.style);
    expect(chip).toEqual(expect.objectContaining({ minHeight: 28, backgroundColor: colors.tealTint, borderRadius: radii.full }));
    const label = tree.root.findByType(Text);
    expect(flat(label.props.style).color).toBe(colors.teal);
    expect(label.props.maxFontSizeMultiplier).toBe(textScale.pill);
    expect(texts(tree.root)).toEqual(['Coaching']);
  });

  it('Category chip: the hashed colour as text and as a 14 % fill layer; phone 24 / tablet 26', () => {
    const phone = mount(<CategoryChip testID="c" label="Strength" />);
    const color = categoryColor('Strength');
    expect(flat(phone.root.findByType(Text).props.style).color).toBe(color);
    expect(flat(hosts(phone.root, 'c-fill')[0].props.style)).toEqual(expect.objectContaining({ backgroundColor: color, opacity: 0.14 }));
    expect(flat(hosts(phone.root, 'c')[0].props.style).minHeight).toBe(24);
    const tablet = mount(<CategoryChip testID="c" label="Strength" size="tablet" />);
    expect(flat(hosts(tablet.root, 'c')[0].props.style).minHeight).toBe(26);
  });
});

describe('PlanCard', () => {
  it('uniform gradient-card (no featured card): chip, name heading, days, description, glass View', () => {
    const onView = jest.fn();
    const tree = mount(<PlanCard plan={PLANS[0]} onView={onView} />);
    const card = flat(hosts(tree.root, 'plan-card-1')[0].props.style);
    expect(card).toEqual(expect.objectContaining({ borderRadius: radii.xl, padding: 16, borderColor: colors.choiceBorder }));
    const fill = tree.root.findAllByType(GradientFill)[0];
    expect(fill.props.colors).toBe(gradients.card.colors);
    expect(texts(tree.root)).toEqual(['Strength', 'Upper / Lower Split', '4 days / week', 'Alternate upper and lower days.', 'View']);
    const name = tree.root.findAllByType(Text).find((node) => node.props.children === 'Upper / Lower Split');
    expect(name.props.accessibilityRole).toBe('header');
    // §9: titles wrap by word (no single-line ellipsis), capped at 1.6.
    expect(name.props.numberOfLines).toBe(3);
    expect(name.props.adjustsFontSizeToFit).toBe(true);
    expect(name.props.maxFontSizeMultiplier).toBe(textScale.title);
    const view = comp(tree.root, 'plan-card-view-1');
    expect(view.props.variant).toBe('secondary');
    expect(view.props.accessibilityLabel).toBe('View Upper / Lower Split');
    expect(view.props.size).toBe('compact');
    view.props.onPress();
    expect(onView).toHaveBeenCalled();
    expect(tree.root.findAll((node) => node.props.testID === 'plan-card-assign-1')).toHaveLength(0);
  });

  it('"Training plan" when days are 0, and no description line when absent', () => {
    const tree = mount(<PlanCard plan={PLANS[2]} onView={jest.fn()} />);
    expect(texts(tree.root)).toEqual(['Plan', 'Full Body Basics', 'Training plan', 'View']);
  });

  it('assign mode: a gold-tint "Assign" after View, with loading', () => {
    const onAssign = jest.fn();
    const tree = mount(<PlanCard plan={PLANS[1]} onView={jest.fn()} onAssign={onAssign} assignLoading />);
    const assign = comp(tree.root, 'plan-card-assign-2');
    expect(assign.props.variant).toBe('goldTint');
    expect(assign.props.loading).toBe(true);
    expect(assign.props.accessibilityLabel).toBe('Assign Push / Pull / Legs');
    // The kit variant draws it now: no fill/edge override from the card.
    expect(flat(assign.props.style).backgroundColor).toBeUndefined();
    const pill = tree.root.findAll((node) => node.props.testID === 'plan-card-assign-2' && typeof node.type === 'string')[0];
    expect(flat(pill.props.style)).toEqual(expect.objectContaining({ backgroundColor: colors.goldTint, borderWidth: 1, borderColor: colors.goldLine }));
    assign.props.onPress();
    expect(onAssign).toHaveBeenCalled();
  });

  it('assign mode: the "Assign" label is GOLD (UX O ruling 4), View keeps the glass ink', () => {
    const tree = mount(<PlanCard plan={PLANS[1]} onView={jest.fn()} onAssign={jest.fn()} />);
    const label = (id) => flat(comp(tree.root, id).findByType(Text).props.style).color;
    expect(label('plan-card-assign-2')).toBe(colors.gold);
    expect(label('plan-card-view-2')).toBe(colors.textPrimary);
  });

  it('tablet card: radius 28, padding 22, min height 200, name 28/30', () => {
    const tree = mount(<PlanCard plan={PLANS[0]} onView={jest.fn()} tablet />);
    expect(flat(hosts(tree.root, 'plan-card-1')[0].props.style)).toEqual(
      expect.objectContaining({ borderRadius: radii.xxl, padding: 22, minHeight: 200 }),
    );
    const name = tree.root.findAllByType(Text).find((node) => node.props.children === 'Upper / Lower Split');
    expect(flat(name.props.style)).toEqual(expect.objectContaining({ fontSize: 28, lineHeight: 30 }));
  });

  it('stacked (large text): View and Assign stack full width', () => {
    const tree = mount(<PlanCard plan={PLANS[0]} onView={jest.fn()} onAssign={jest.fn()} stacked />);
    expect(flat(hosts(tree.root, 'plan-card-actions-1')[0].props.style).flexDirection).toBe('column');
    expect(flat(comp(tree.root, 'plan-card-view-1').props.style).alignSelf).toBe('stretch');
    expect(flat(comp(tree.root, 'plan-card-assign-1').props.style).alignSelf).toBe('stretch');
  });
});

describe('PlansListScreen (phone)', () => {
  it('browse: Coaching chip, "Plans" h1, the gold Create, the code subtitle, no glow', async () => {
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Coaching', 'Plans', 'Create a plan', BROWSE_SUBTITLE]));
    expect(mockShellProps.glow).toBe(false);
    const create = comp(tree.root, 'plans-create');
    expect(create.props.variant).toBe('primary');
    expect(create.props.size).toBe('compact');
    expect(typeof create.props.icon).toBe('function');
    create.props.onPress();
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlanCreate');
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Plans');
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('browse: 2-col rows; the dashed "Create a plan" tile ends the grid and opens create', async () => {
    const tree = await render();
    const grid = hosts(tree.root, 'plans-grid')[0];
    const rows = grid.props.children;
    // 3 plans + the tile = 2 full rows.
    expect(rows).toHaveLength(2);
    const tile = comp(tree.root, 'plans-create-tile');
    expect(tile.props.accessibilityRole).toBe('button');
    expect(tile.props.accessibilityLabel).toBe('Create a plan');
    const tileStyle = flat(tile.props.style);
    expect(tileStyle).toEqual(expect.objectContaining({ borderStyle: 'dashed', borderRadius: radii.xl, borderColor: colors.hairlineBright }));
    tile.props.onPress();
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlanCreate');
  });

  it('tile pressed: the 4 % overlay', async () => {
    const tree = await render();
    const tile = comp(tree.root, 'plans-create-tile');
    const pressed = mount(<View>{tile.props.children({ pressed: true })}</View>);
    expect(flat(hosts(pressed.root, 'plans-create-tile-pressed')[0].props.style).backgroundColor).toBe(colors.pressOverlay);
    const rest = mount(<View>{tile.props.children({ pressed: false })}</View>);
    expect(hosts(rest.root, 'plans-create-tile-pressed')).toHaveLength(0);
  });

  it('View opens the builder', async () => {
    const tree = await render();
    comp(tree.root, 'plan-card-view-2').props.onPress();
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlan', { planId: 2 });
  });

  it('assign mode: the assign sentence replaces the subtitle, back link, glass Create, one column, no tile', async () => {
    mockParams = { assignTo: 42 };
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toContain('Pick a plan to assign to client #42.');
    expect(shown).not.toContain(BROWSE_SUBTITLE);
    expect(comp(tree.root, 'plans-create').props.variant).toBe('secondary');
    expect(tree.root.findAll((node) => node.props.testID === 'plans-create-tile')).toHaveLength(0);
    expect(hosts(tree.root, 'plans-grid')[0].props.children).toHaveLength(3);
    const back = comp(tree.root, 'plans-back-to-client');
    expect(back.props.label).toBe('← Back to client #42');
    back.props.onPress();
    expect(openClientDetail).toHaveBeenCalledWith(42);
  });

  it('assign success: "Plan assigned" toast', async () => {
    mockParams = { assignTo: 42 };
    assignPlan.mockResolvedValue({});
    const tree = await render();
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    expect(assignPlan).toHaveBeenCalledWith(42, 1, false);
    expect(addToast).toHaveBeenCalledWith('success', 'Plan assigned', 'Upper / Lower Split is now their active plan.');
  });

  it('assign 409 → T1a dialog; Replace sends replace=true and toasts "Plan replaced"', async () => {
    mockParams = { assignTo: 42 };
    assignPlan.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Has a plan' } } });
    const tree = await render();
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    const dialog = tree.root.findByType(ConfirmDialog);
    expect(dialog.props.isOpen).toBe(true);
    expect(dialog.props.title).toBe('Replace their current plan?');
    expect(dialog.props.description).toBe(
      'This client already has an active plan. Assigning Upper / Lower Split will end the current one and start this instead. Their history is kept.',
    );
    expect(dialog.props.tone).toBe('danger');
    assignPlan.mockResolvedValueOnce({});
    await act(async () => dialog.props.onConfirm());
    expect(assignPlan).toHaveBeenLastCalledWith(42, 1, true);
    expect(addToast).toHaveBeenCalledWith('success', 'Plan replaced', 'Upper / Lower Split is now their active plan.');
    expect(tree.root.findByType(ConfirmDialog).props.isOpen).toBe(false);
  });

  it('assign errors: 404 copy, 409-on-replace server text, generic copy', async () => {
    mockParams = { assignTo: 42 };
    const tree = await render();
    assignPlan.mockRejectedValueOnce({ response: { status: 404 } });
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    expect(addToast).toHaveBeenLastCalledWith('error', 'Could not assign', 'They are no longer one of your active clients.');
    assignPlan.mockRejectedValueOnce({ response: { status: 500 } });
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    expect(addToast).toHaveBeenLastCalledWith('error', 'Could not assign', 'We could not assign the plan. Please try again.');
    assignPlan.mockRejectedValueOnce({ response: { status: 409 } });
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    assignPlan.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Still blocked' } } });
    await act(async () => tree.root.findByType(ConfirmDialog).props.onConfirm());
    expect(addToast).toHaveBeenLastCalledWith('error', 'Could not assign', 'Still blocked');
  });

  it('double tap on Assign (PM bug fix): two quick presses send ONE POST, so no 409 → "Replace…"; the next tap works once it settles', async () => {
    mockParams = { assignTo: 42 };
    let settle;
    assignPlan.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    const tree = await render();
    const assignButton = comp(tree.root, 'plan-card-assign-1');
    await act(async () => {
      assignButton.props.onPress();
      assignButton.props.onPress();
    });
    expect(assignPlan).toHaveBeenCalledTimes(1);
    // A4.4: busy from the FIRST tap, on the tapped card only.
    expect(comp(tree.root, 'plan-card-assign-1').props.loading).toBe(true);
    expect(comp(tree.root, 'plan-card-assign-2').props.loading).toBe(false);
    await act(async () => settle({}));
    expect(comp(tree.root, 'plan-card-assign-1').props.loading).toBe(false);
    expect(tree.root.findByType(ConfirmDialog).props.isOpen).toBe(false);
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('success', 'Plan assigned', 'Upper / Lower Split is now their active plan.');
    assignPlan.mockResolvedValueOnce({});
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    expect(assignPlan).toHaveBeenCalledTimes(2);
  });

  it('the in-flight guard clears after an error too: the next tap POSTs again', async () => {
    mockParams = { assignTo: 42 };
    const tree = await render();
    assignPlan.mockRejectedValueOnce({ response: { status: 500 } });
    const first = comp(tree.root, 'plan-card-assign-1').props.onPress;
    await act(async () => {
      first();
      first();
    });
    expect(assignPlan).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenLastCalledWith('error', 'Could not assign', 'We could not assign the plan. Please try again.');
    assignPlan.mockResolvedValueOnce({});
    await act(async () => comp(tree.root, 'plan-card-assign-2').props.onPress());
    expect(assignPlan).toHaveBeenCalledTimes(2);
    expect(assignPlan).toHaveBeenLastCalledWith(42, 2, false);
  });

  it('double tap on Replace plan: ONE replace POST while it is pending', async () => {
    mockParams = { assignTo: 42 };
    assignPlan.mockRejectedValueOnce({ response: { status: 409 } });
    const tree = await render();
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    let settle;
    assignPlan.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    const dialog = tree.root.findByType(ConfirmDialog);
    await act(async () => {
      dialog.props.onConfirm();
      dialog.props.onConfirm();
    });
    expect(assignPlan).toHaveBeenCalledTimes(2);
    expect(assignPlan).toHaveBeenLastCalledWith(42, 1, true);
    await act(async () => settle({}));
    expect(addToast).toHaveBeenCalledWith('success', 'Plan replaced', 'Upper / Lower Split is now their active plan.');
  });

  it('dialog Cancel closes it', async () => {
    mockParams = { assignTo: 42 };
    assignPlan.mockRejectedValueOnce({ response: { status: 409 } });
    const tree = await render();
    await act(async () => comp(tree.root, 'plan-card-assign-1').props.onPress());
    await act(async () => tree.root.findByType(ConfirmDialog).props.onClose());
    expect(tree.root.findByType(ConfirmDialog).props.isOpen).toBe(false);
  });

  it('states: loading Loader, error + Retry, empty (header Create stays)', async () => {
    listTrainerPlans.mockReturnValueOnce(new Promise(() => {}));
    let tree = await render();
    expect(tree.root.findByType(Loader).props.label).toBe('Loading plans');
    expect(comp(tree.root, 'plans-create')).toBeTruthy();

    listTrainerPlans.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Boom' } } });
    tree = await render();
    const alert = tree.root.findByType(ErrorAlert);
    expect(alert.props.title).toBe('Could not load plans');
    expect(alert.props.description).toBe('Boom');
    listTrainerPlans.mockResolvedValueOnce(page({ items: [] }));
    await act(async () => alert.props.onRetry());
    const empty = tree.root.findByType(EmptyState);
    expect(empty.props.title).toBe('No plans yet');
    expect(empty.props.message).toBe('Create a private plan to build one for your clients.');
    expect(comp(tree.root, 'plans-create')).toBeTruthy();
    expect(tree.root.findAll((node) => node.props.testID === 'plans-create-tile')).toHaveLength(0);
  });

  it('pager: hidden on 1 page; Previous | status | Next; disabled ends; page change reloads', async () => {
    let tree = await render();
    expect(tree.root.findAll((node) => node.props.testID === 'plans-pager')).toHaveLength(0);

    listTrainerPlans.mockResolvedValue(page({ totalPages: 2, totalRecords: 24 }));
    tree = await render();
    const status = hosts(tree.root, 'plans-page-status')[0];
    expect(texts(tree.root)).toContain('Page 1 of 2 · 24 total');
    expect(status.props.accessibilityLiveRegion).toBe('polite');
    const pager = hosts(tree.root, 'plans-pager')[0];
    expect(pager.props.accessibilityLabel).toBe('Pagination');
    expect(flat(pager.props.style).flexDirection).toBe('row');
    expect(comp(tree.root, 'plans-previous').props.disabled).toBe(true);
    expect(comp(tree.root, 'plans-next').props.disabled).toBe(false);
    expect(comp(tree.root, 'plans-next').props.variant).toBe('secondary');
    listTrainerPlans.mockResolvedValue(page({ currentPage: 2, totalPages: 2, totalRecords: 24 }));
    await act(async () => comp(tree.root, 'plans-next').props.onPress());
    expect(listTrainerPlans).toHaveBeenLastCalledWith(2);
    expect(comp(tree.root, 'plans-next').props.disabled).toBe(true);
    expect(comp(tree.root, 'plans-previous').props.disabled).toBe(false);
    await act(async () => comp(tree.root, 'plans-previous').props.onPress());
    expect(listTrainerPlans).toHaveBeenLastCalledWith(1);
  });
});

describe('PlansListScreen (tablet)', () => {
  beforeEach(() => setWindow(834));

  it('the gold page wash, display title, the default-size Create, subtitle in the header, no tile', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBe(TABLET_PLANS_GLOW);
    expect(TABLET_PLANS_GLOW.colors).toBe(gradients.accountGlow.colors);
    expect(comp(tree.root, 'plans-create').props.size).toBe('default');
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Plans');
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.display);
    expect(tree.root.findAll((node) => node.props.testID === 'plans-create-tile')).toHaveLength(0);
    expect(card(tree.root, 1).props.tablet).toBe(true);
    // 3 plans in 2 columns: 2 rows, the last padded.
    expect(hosts(tree.root, 'plans-grid')[0].props.children).toHaveLength(2);
  });

  it('assign mode keeps 2 columns', async () => {
    mockParams = { assignTo: 7 };
    const tree = await render();
    expect(hosts(tree.root, 'plans-grid')[0].props.children).toHaveLength(2);
    expect(comp(tree.root, 'plan-card-assign-3')).toBeTruthy();
  });

  it('pager pill: glass fill, status left, Previous + a LIGHT Next', async () => {
    listTrainerPlans.mockResolvedValue(page({ totalPages: 3, currentPage: 1, totalRecords: 30 }));
    const tree = await render();
    const pager = flat(hosts(tree.root, 'plans-pager')[0].props.style);
    expect(pager).toEqual(expect.objectContaining({ borderRadius: radii.full, backgroundColor: colors.glass }));
    expect(comp(tree.root, 'plans-next').props.variant).toBe('light');
  });
});

describe('PlansListScreen large text (UX §9)', () => {
  it.each([1, 2, 3.1])('fontScale %p: titles capped, header and grid reflow above 1.3', async (fontScale) => {
    setWindow(390, fontScale);
    listTrainerPlans.mockResolvedValue(page({ totalPages: 2, totalRecords: 24 }));
    const tree = await render();
    const reflow = fontScale > textScale.reflowAbove;
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Plans');
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.title);
    expect(title.props.numberOfLines).toBe(3);
    expect(flat(hosts(tree.root, 'plans-header')[0].props.style).flexDirection).toBe(reflow ? 'column' : 'row');
    // Phone browse: 2 columns at 1×, 1 column above the reflow point (3 plans + tile).
    expect(hosts(tree.root, 'plans-grid')[0].props.children).toHaveLength(reflow ? 4 : 2);
    expect(card(tree.root, 1).props.stacked).toBe(reflow);
    // Every label keeps the body cap; buttons never truncate (kit PillButton).
    tree.root.findAllByType(PillButton).forEach((button) => expect(button.props.title).toBeTruthy());
    const status = hosts(tree.root, 'plans-page-status')[0];
    expect(status.props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(status.props.numberOfLines).toBeUndefined();
  });

  it('fontScale 3.1 on a tablet keeps 2 columns with stacked card buttons', async () => {
    setWindow(834, 3.1);
    mockParams = { assignTo: 9 };
    const tree = await render();
    expect(hosts(tree.root, 'plans-grid')[0].props.children).toHaveLength(2);
    expect(card(tree.root, 1).props.stacked).toBe(true);
  });
});
