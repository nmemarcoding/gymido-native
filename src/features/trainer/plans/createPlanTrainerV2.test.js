import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ErrorAlert from '../../../shared/components/ErrorAlert';
import FormField from '../../../shared/components/FormField';
import GradientFill from '../../../shared/components/GradientFill';
import Select from '../../../shared/components/Select';
import { addToast } from '../../../shared/components/toastStore';
import { colors, gradients, radii, textScale } from '../../../shared/theme/tokens';
import { createTrainerPlan } from './api/plansApi';
import { CORNER_GLOW_SIZE, TRAINER_CREATE_GLOW, TRAINER_TABLET_CREATE_GLOW } from './components/TrainerCreatePlanLayout';
import CreatePlanScreen from './screens/CreatePlanScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockShellProps;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'TrainerPlanCreate-1', name: 'TrainerPlanCreate', params: {} }),
}));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shell/ShellPage', () => (props) => {
  mockShellProps = props;
  return props.children;
});
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('./api/plansApi', () => ({
  createTrainerPlan: jest.fn(),
  listPlanCategories: jest.fn(() => Promise.resolve([{ id: 4, name: 'Strength' }])),
  listDifficultyLevels: jest.fn(() => Promise.resolve([{ id: 2, name: 'Beginner' }])),
}));
jest.mock('../../../shared/components/toastStore', () => ({
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const texts = (root) =>
  root
    .findAll((node) => node.type === 'Text')
    .map((node) =>
      []
        .concat(node.props.children)
        .filter((c) => typeof c !== 'object')
        .join(''),
    );
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string');
const flat = (style) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) ?? {};

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<CreatePlanScreen />);
  });
  mounted.push(tree);
  return tree;
}
const field = (tree, id) => tree.root.findAll((node) => (node.type === FormField || node.type === Select) && node.props.testID === id)[0];
async function fill(tree, { name = 'Client A – Hypertrophy', category = '4' } = {}) {
  await act(async () => field(tree, 'create-plan-name').props.onChangeText(name));
  await act(async () => field(tree, 'create-plan-category').props.onChange(category));
}
const submit = (tree) =>
  act(async () => {
    comp(tree.root, 'create-plan-submit').props.onPress();
  });

beforeEach(() => {
  jest.clearAllMocks();
  setWindow(390);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

describe('Trainer plan create, phone (TrainerPlanCreate)', () => {
  it('the gold page wash, glass back pill, display-md title, subtitle, the gradient card', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBe(TRAINER_CREATE_GLOW);
    expect(TRAINER_CREATE_GLOW.colors).toBe(gradients.accountGlow.colors);
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['← All plans', 'Create a plan', 'Private to you. Only clients you assign it to will see it.']),
    );
    const back = comp(tree.root, 'create-plan-all-plans');
    expect(back.props.accessibilityRole).toBe('link');
    expect(back.props.hitSlop).toEqual(expect.objectContaining({ top: 2, bottom: 2 }));
    expect(flat(back.props.style)).toEqual(
      expect.objectContaining({ minHeight: 40, borderRadius: radii.full, backgroundColor: colors.fillGlass, borderColor: colors.hairlineButton }),
    );
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Create a plan');
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.display);
    expect(flat(title.props.style).fontSize).toBe(44);
    const card = flat(host(tree.root, 'create-plan-card').props.style);
    expect(card).toEqual(expect.objectContaining({ borderRadius: radii.xxl, padding: 18, borderColor: colors.choiceBorder }));
    expect(comp(tree.root, 'create-plan-card').findAllByType(GradientFill)[0].props.colors).toBe(gradients.card.colors);
    expect(tree.root.findAll((node) => node.props.testID === 'create-plan-corner-glow')).toHaveLength(0);
  });

  it('opens EMPTY with the trainer Slug field, the well boxes, Days 3, and Category 1.4 | Days 1', async () => {
    const tree = await render();
    ['create-plan-name', 'create-plan-slug', 'create-plan-category', 'create-plan-days', 'create-plan-difficulty', 'create-plan-description'].forEach(
      (id) => expect(field(tree, id).props.variant).toBe('well'),
    );
    expect(field(tree, 'create-plan-name').props.value).toBe('');
    expect(field(tree, 'create-plan-name').props.placeholder).toBe('Client A – Hypertrophy');
    expect(field(tree, 'create-plan-slug').props.helperText).toBe('Lowercase letters, numbers, hyphens and underscores.');
    expect(field(tree, 'create-plan-days').props.value).toBe('3');
    expect(field(tree, 'create-plan-category').props.options[0]).toEqual({ value: '', label: 'Select a category' });
    expect(field(tree, 'create-plan-difficulty').props.options[0]).toEqual({ value: '', label: 'No difficulty set' });
    expect(field(tree, 'create-plan-description').props.rows).toBe(3);
    const pair = host(tree.root, 'create-plan-pair');
    expect(flat(pair.props.style).flexDirection).toBe('row');
    const [categoryCell, daysCell] = pair.props.children;
    expect(flat(categoryCell.props.style).flex).toBe(1.4);
    expect(flat(daysCell.props.style).flex).toBe(1);
  });

  it('buttons: Cancel (flex 1) then the gold Create (flex 1.8), both 54 tall', async () => {
    const tree = await render();
    const buttons = host(tree.root, 'create-plan-buttons').props.children;
    expect(buttons.map((button) => button.props.testID)).toEqual(['create-plan-cancel', 'create-plan-submit']);
    expect(flat(comp(tree.root, 'create-plan-cancel').props.style)).toEqual(expect.objectContaining({ flex: 1, minHeight: 54 }));
    expect(flat(comp(tree.root, 'create-plan-submit').props.style)).toEqual(expect.objectContaining({ flex: 1.8, minHeight: 54 }));
    expect(comp(tree.root, 'create-plan-cancel').props.variant).toBe('secondary');
  });

  it('slug follows the name until edited once', async () => {
    const tree = await render();
    await act(async () => field(tree, 'create-plan-name').props.onChangeText('  Client A Hypertrophy! '));
    expect(field(tree, 'create-plan-slug').props.value).toBe('client-a-hypertrophy');
    await act(async () => field(tree, 'create-plan-slug').props.onChangeText('custom_slug'));
    await act(async () => field(tree, 'create-plan-name').props.onChangeText('Other'));
    expect(field(tree, 'create-plan-slug').props.value).toBe('custom_slug');
  });

  it('empty submit: field errors, no request; editing a field clears its error', async () => {
    const tree = await render();
    await submit(tree);
    expect(createTrainerPlan).not.toHaveBeenCalled();
    expect(field(tree, 'create-plan-name').props.error).toBe('Name is required.');
    expect(field(tree, 'create-plan-slug').props.error).toBe('Slug is required.');
    expect(field(tree, 'create-plan-category').props.error).toBe('Category is required.');
    await act(async () => field(tree, 'create-plan-name').props.onChangeText('A'));
    expect(field(tree, 'create-plan-name').props.error).toBeUndefined();
  });

  it('saving: fields disabled, Create loading, Cancel enabled, double submit ignored; success toast then the builder', async () => {
    let resolve;
    createTrainerPlan.mockReturnValue(new Promise((res) => (resolve = res)));
    const tree = await render();
    await fill(tree);
    await submit(tree);
    await submit(tree);
    expect(createTrainerPlan).toHaveBeenCalledTimes(1);
    expect(field(tree, 'create-plan-name').props.editable).toBe(false);
    expect(field(tree, 'create-plan-category').props.disabled).toBe(true);
    expect(comp(tree.root, 'create-plan-submit').props.loading).toBe(true);
    expect(comp(tree.root, 'create-plan-cancel').props.disabled).toBeFalsy();
    await act(async () => resolve({ id: 77 }));
    expect(addToast).toHaveBeenCalledWith('success', 'Plan created', 'Add days and exercises to build it out.');
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlan', { planId: 77 });
  });

  it('409: the slug error (server text or the fallback)', async () => {
    createTrainerPlan.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    const tree = await render();
    await fill(tree);
    await submit(tree);
    expect(field(tree, 'create-plan-slug').props.error).toBe('This slug is already in use.');
    expect(comp(tree.root, 'create-plan-submit').props.loading).toBe(false);
  });

  it('422 / other: the form ErrorAlert at the top of the card, no Retry', async () => {
    createTrainerPlan.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Validation failed' } } });
    const tree = await render();
    await fill(tree);
    await submit(tree);
    let alert = tree.root.findByType(ErrorAlert);
    expect(alert.props.title).toBe('Could not create the plan');
    expect(alert.props.description).toBe('Validation failed');
    expect(alert.props.onRetry).toBeUndefined();
    const cardChildren = comp(tree.root, 'create-plan-card').findAll((node) => node.type === ErrorAlert || node.type === FormField);
    expect(cardChildren[0].type).toBe(ErrorAlert);

    createTrainerPlan.mockRejectedValueOnce({ response: { status: 500 } });
    await submit(tree);
    alert = tree.root.findByType(ErrorAlert);
    expect(alert.props.description).toBe('We could not create the plan. Please try again.');
    // Editing clears the form error.
    await act(async () => field(tree, 'create-plan-description').props.onChangeText('x'));
    expect(tree.root.findAllByType(ErrorAlert)).toHaveLength(0);
  });

  it('Back and Cancel go to All plans', async () => {
    const tree = await render();
    comp(tree.root, 'create-plan-all-plans').props.onPress();
    comp(tree.root, 'create-plan-cancel').props.onPress();
    expect(mockNavigation.push).toHaveBeenNthCalledWith(1, 'TrainerPlans');
    expect(mockNavigation.push).toHaveBeenNthCalledWith(2, 'TrainerPlans');
  });

  it('back pill pressed: the 4 % overlay', async () => {
    const tree = await render();
    const back = comp(tree.root, 'create-plan-all-plans');
    let pressed;
    act(() => {
      pressed = create(<View>{back.props.children({ pressed: true })}</View>);
    });
    expect(flat(host(pressed.root, 'create-plan-all-plans-pressed').props.style).backgroundColor).toBe(colors.pressOverlay);
    act(() => pressed.unmount());
  });
});

describe('Trainer plan create, tablet (TabletTrainerPlanCreate)', () => {
  beforeEach(() => setWindow(834));

  it('620 column, display-xl title, card radius 32 padding 30 + a 260 gold corner glow', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBe(TRAINER_TABLET_CREATE_GLOW);
    expect(flat(host(tree.root, 'create-plan-column').props.style).maxWidth).toBe(620);
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Create a plan');
    expect(flat(title.props.style).fontSize).toBe(56);
    expect(flat(host(tree.root, 'create-plan-card').props.style)).toEqual(expect.objectContaining({ borderRadius: radii.xxxl, padding: 30 }));
    const glow = flat(host(tree.root, 'create-plan-corner-glow').props.style);
    expect(glow).toEqual(expect.objectContaining({ width: CORNER_GLOW_SIZE, height: CORNER_GLOW_SIZE, position: 'absolute' }));
    expect(comp(tree.root, 'create-plan-corner-glow').findByType(GradientFill).props.colors).toBe(gradients.cardCornerGlow.colors);
  });

  it('Category | Days equal, Description 4 rows, buttons right-aligned at 58', async () => {
    const tree = await render();
    const [categoryCell, daysCell] = host(tree.root, 'create-plan-pair').props.children;
    expect(flat(categoryCell.props.style).flex).toBe(1);
    expect(flat(daysCell.props.style).flex).toBe(1);
    expect(field(tree, 'create-plan-description').props.rows).toBe(4);
    expect(flat(host(tree.root, 'create-plan-buttons').props.style).justifyContent).toBe('flex-end');
    expect(flat(comp(tree.root, 'create-plan-submit').props.style)).toEqual(expect.objectContaining({ minHeight: 58, paddingHorizontal: 30 }));
    expect(flat(comp(tree.root, 'create-plan-cancel').props.style)).toEqual(expect.objectContaining({ minHeight: 58, paddingHorizontal: 26 }));
  });
});

describe('Trainer plan create large text (UX §9)', () => {
  it.each([
    [390, 1],
    [390, 2],
    [390, 3.1],
    [834, 3.1],
  ])('width %p fontScale %p: title capped; pair and buttons stack above 1.3 (primary first)', async (width, fontScale) => {
    setWindow(width, fontScale);
    const tree = await render();
    const stacked = fontScale > textScale.reflowAbove;
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Create a plan');
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.display);
    expect(title.props.numberOfLines).toBe(3);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(flat(host(tree.root, 'create-plan-pair').props.style).flexDirection).toBe(stacked ? 'column' : 'row');
    const order = host(tree.root, 'create-plan-buttons').props.children.map((button) => button.props.testID);
    expect(order).toEqual(stacked ? ['create-plan-submit', 'create-plan-cancel'] : ['create-plan-cancel', 'create-plan-submit']);
    if (stacked) {
      expect(flat(comp(tree.root, 'create-plan-submit').props.style).alignSelf).toBe('stretch');
    }
    const back = tree.root.findAllByType(Text).find((node) => node.props.children === '← All plans');
    expect(back.props.maxFontSizeMultiplier).toBe(textScale.body);
  });
});
