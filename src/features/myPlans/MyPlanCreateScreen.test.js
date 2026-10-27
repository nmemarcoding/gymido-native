import { Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import FormField from '../../shared/components/FormField';
import GradientFill from '../../shared/components/GradientFill';
import PillButton from '../../shared/components/PillButton';
import Select from '../../shared/components/Select';
import { addToast } from '../../shared/components/toastStore';
import { colors, gradients, radii, textScale } from '../../shared/theme/tokens';
import { CREATE_GLOW, TABLET_CARD_FILL, TABLET_CREATE_GLOW } from '../trainer/plans/screens/CreatePlanScreen';
import { createMyPlan } from './api/myPlansApi';
import MyPlanCreateScreen, { MEMBER_CREATE_VARIANT } from './MyPlanCreateScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockShellProps;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'MyPlanCreate-1', name: 'MyPlanCreate', params: {} }),
}));
jest.mock('../shell/ShellPage', () => (props) => {
  mockShellProps = props;
  return props.children;
});
jest.mock(
  '../trainer/TrainerOnly',
  () =>
    ({ children }) =>
      children,
);
jest.mock('./myPlanRoutes', () => ({ myPlanRoutes: { MyPlans: 'MyPlans', MyPlanCreate: 'MyPlanCreate', MyPlan: 'MyPlan' } }));
jest.mock('./api/myPlansApi', () => ({ createMyPlan: jest.fn() }));
jest.mock('../trainer/plans/api/plansApi', () => ({
  createTrainerPlan: jest.fn(),
  listPlanCategories: jest.fn(() => Promise.resolve([{ id: 4, name: 'Strength' }])),
  listDifficultyLevels: jest.fn(() => Promise.resolve([{ id: 2, name: 'Beginner' }])),
}));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'),
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
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string');
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));

function setWidth(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<MyPlanCreateScreen />);
  });
  mounted.push(tree);
  return tree;
}

async function fill(tree, { name = 'Push day', category = '4' } = {}) {
  await act(async () => comp(tree.root, 'create-plan-name').props.onChangeText(name));
  await act(async () => comp(tree.root, 'create-plan-category').props.onChange(category));
}
const submit = async (tree) =>
  act(async () => {
    comp(tree.root, 'create-plan-submit').props.onPress();
  });

beforeEach(() => setWidth(390));
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

describe('My plan create v2 look (C3), phone', () => {
  it('uses the v2 member variant', () => {
    expect(MEMBER_CREATE_VARIANT.look).toBe('v2');
  });

  it('shows the gold back link, display title, subtitle, glow and gradient card; no slug field', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBeTruthy();
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining([
        '← My plans',
        'Create a plan',
        'Private to you. Build it out, then start it.',
        'Cancel',
        'Create and add days',
      ]),
    );
    expect(shown).not.toContain('Slug');
    const title = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Create a plan');
    expect(title.props.accessibilityRole).toBe('header');
    expect(flat(title.props.style).fontSize).toBe(44);
    const back = tree.root.find((node) => node.type === 'Text' && node.props.children === '← My plans');
    expect(flat(back.props.style).color).toBe(colors.gold);
    expect(flat(host(tree.root, 'create-plan-card')[0].props.style)).toMatchObject({ borderRadius: radii.xxl, padding: 18 });
  });

  it('pairs Category with Days per week on phones, and puts Cancel before Create', async () => {
    const tree = await render();
    const pair = host(tree.root, 'create-plan-pair')[0];
    expect(pair.findAll((node) => node.props.testID === 'create-plan-category').length).toBeGreaterThan(0);
    expect(pair.findAll((node) => node.props.testID === 'create-plan-days').length).toBeGreaterThan(0);
    const buttons = host(tree.root, 'create-plan-buttons')[0];
    const ids = buttons
      .findAll((node) => typeof node.type === 'string' && /create-plan-(cancel|submit)/.test(node.props.testID ?? ''))
      .map((n) => n.props.testID);
    expect(ids[0]).toBe('create-plan-cancel');
    expect(ids).toContain('create-plan-submit');
  });

  it('Days per week defaults to 3 and Description is 2 rows on phones', async () => {
    const tree = await render();
    expect(comp(tree.root, 'create-plan-days').props.value).toBe('3');
    expect(comp(tree.root, 'create-plan-description').props.rows).toBe(2);
  });

  it('validates: Name is required., Category is required.', async () => {
    const tree = await render();
    await submit(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Name is required.', 'Category is required.']));
    expect(createMyPlan).not.toHaveBeenCalled();
  });

  it('creates with a hidden member slug, toasts and opens the plan', async () => {
    createMyPlan.mockResolvedValue({ id: 31 });
    const tree = await render();
    await fill(tree);
    await submit(tree);
    const payload = createMyPlan.mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'Push day', category_id: 4, days_per_week: 3 });
    expect(payload.slug).toMatch(/^push-day/);
    expect(texts(tree.root).some((t) => t.includes('push-day'))).toBe(false);
    expect(addToast).toHaveBeenCalledWith('success', 'Plan created', 'Add days and exercises to build it out.');
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlan', { planId: 31 });
  });

  it('saving: fields disabled and the primary loading', async () => {
    createMyPlan.mockReturnValue(new Promise(() => {}));
    const tree = await render();
    await fill(tree);
    await submit(tree);
    expect(comp(tree.root, 'create-plan-submit').props.loading).toBe(true);
    expect(comp(tree.root, 'create-plan-name').props.editable).toBe(false);
    expect(comp(tree.root, 'create-plan-category').props.disabled).toBe(true);
  });

  it('409/403: the server message in the form ErrorAlert', async () => {
    createMyPlan.mockRejectedValue({ response: { status: 409, data: { message: 'You already have a plan with that name.' } } });
    const tree = await render();
    await fill(tree);
    await submit(tree);
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining(['Could not create the plan', 'You already have a plan with that name.']),
    );
  });

  it('other failures: the generic form message', async () => {
    createMyPlan.mockRejectedValue({ response: { status: 500 } });
    const tree = await render();
    await fill(tree);
    await submit(tree);
    expect(texts(tree.root)).toContain('We could not create the plan. Please try again.');
  });

  it('Back and Cancel go to My plans', async () => {
    const tree = await render();
    act(() =>
      tree.root.find((n) => n.props.testID === 'create-plan-all-plans' && typeof n.props.onPress === 'function').props.onPress(),
    );
    act(() => comp(tree.root, 'create-plan-cancel').props.onPress());
    expect(mockNavigation.push).toHaveBeenNthCalledWith(1, 'MyPlans');
    expect(mockNavigation.push).toHaveBeenNthCalledWith(2, 'MyPlans');
  });
});

describe('My plan create v2 look (C3), tablet', () => {
  beforeEach(() => setWidth(834));

  it('centres a 600 column, 60 title, Category alone, Days + Difficulty paired, 4-row description, right-aligned buttons', async () => {
    const tree = await render();
    expect(flat(host(tree.root, 'create-plan-column')[0].props.style).maxWidth).toBe(600);
    const title = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Create a plan');
    expect(flat(title.props.style).fontSize).toBe(60);
    const pair = host(tree.root, 'create-plan-pair')[0];
    expect(pair.findAll((node) => node.props.testID === 'create-plan-category')).toHaveLength(0);
    expect(pair.findAll((node) => node.props.testID === 'create-plan-difficulty').length).toBeGreaterThan(0);
    expect(comp(tree.root, 'create-plan-description').props.rows).toBe(4);
    expect(flat(host(tree.root, 'create-plan-buttons')[0].props.style).justifyContent).toBe('flex-end');
    expect(flat(host(tree.root, 'create-plan-card')[0].props.style).padding).toBe(28);
  });
});

// Phase 2 tokens pass: exact colours (UX §8.4/§8.5) and large text (§9).
const insideKit = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if ([FormField, Select, PillButton].includes(parent.type)) {
      return true;
    }
  }
  return false;
};
const ownTexts = (root) => root.findAllByType(Text).filter((node) => !insideKit(node));
const buttonOrder = (tree) =>
  host(tree.root, 'create-plan-buttons')[0]
    .findAll((node) => typeof node.type === 'string' && /^create-plan-(cancel|submit)$/.test(node.props.testID ?? ''))
    .map((node) => node.props.testID);

describe('My plan create tokens (Phase 2 exact match)', () => {
  it('phone: the gold-ambient glow (0.18) at the board geometry, gradient-card form card', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBe(CREATE_GLOW);
    expect(CREATE_GLOW.colors).toEqual(gradients.accountGlow.colors);
    expect(CREATE_GLOW.colors[0]).toBe('rgba(255, 194, 26, 0.18)');
    const card = host(tree.root, 'create-plan-card')[0];
    expect(card.findByType(GradientFill).props).toMatchObject({ angle: gradients.card.angle, colors: gradients.card.colors });
    expect(flat(card.props.style).borderColor).toBe(colors.choiceBorder);
  });

  it('tablet: its own glow geometry and the surface-input → surface-sunk card', async () => {
    setWidth(834);
    const tree = await render();
    expect(mockShellProps.glow).toBe(TABLET_CREATE_GLOW);
    expect(TABLET_CREATE_GLOW.radial).toEqual({ cx: 0.9, cy: -0.06, rx: 0.7, ry: 0.4 });
    const card = host(tree.root, 'create-plan-card')[0];
    expect(card.findByType(GradientFill).props).toMatchObject({ angle: 160, colors: [colors.surfaceInput, colors.surfaceSunk] });
    expect(TABLET_CARD_FILL.colors).toEqual([colors.surfaceInput, colors.surfaceSunk]);
  });
});

describe('My plan create large text (UX §9)', () => {
  it.each([
    [390, 1],
    [390, 2],
    [834, 1],
    [834, 3.1],
  ])('width %s, fontScale %s: the title is capped and wraps by word; every own text is capped', async (width, scale) => {
    setWidth(width, scale);
    const tree = await render();
    const title = tree.root.find((node) => node.type === Text && node.props.children === 'Create a plan');
    expect(title.props).toMatchObject({
      maxFontSizeMultiplier: textScale.display,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
    ownTexts(tree.root).forEach((node) => {
      expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0);
      expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true);
    });
    const subtitle = tree.root.find(
      (node) => node.type === Text && node.props.children === 'Private to you. Build it out, then start it.',
    );
    expect(subtitle.props.maxFontSizeMultiplier).toBe(textScale.body);
  });

  it('fontScale 1: the pairs stay side by side and Cancel comes first', async () => {
    for (const width of [390, 834]) {
      setWidth(width, 1);
      const tree = await render();
      expect(flat(host(tree.root, 'create-plan-pair')[0].props.style).flexDirection).toBe('row');
      expect(buttonOrder(tree)).toEqual(['create-plan-cancel', 'create-plan-submit']);
      expect(flat(host(tree.root, 'create-plan-buttons')[0].props.style).flexDirection).toBe('row');
    }
  });

  it.each([2, 3.1])('fontScale %s: one column of fields; Create stacks above Cancel, both full width', async (scale) => {
    for (const width of [390, 834]) {
      setWidth(width, scale);
      const tree = await render();
      const pair = host(tree.root, 'create-plan-pair')[0];
      expect(flat(pair.props.style).flexDirection).toBe('column');
      pair.props.children.forEach((cell) => expect(flat(cell.props.style).flex).toBeUndefined());
      expect(flat(host(tree.root, 'create-plan-buttons')[0].props.style).flexDirection).toBe('column');
      expect(buttonOrder(tree)).toEqual(['create-plan-submit', 'create-plan-cancel']);
      ['create-plan-submit', 'create-plan-cancel'].forEach((id) =>
        expect(flat(comp(tree.root, id).props.style)).toMatchObject({ width: '100%' }),
      );
    }
  });
});
