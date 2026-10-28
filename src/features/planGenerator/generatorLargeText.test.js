import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { getGeneratorProfile, previewGeneratedPlan, searchExercises } from './api/generatorApi';
import PlanGeneratorPreviewScreen from './screens/PlanGeneratorPreviewScreen';
import PlanGeneratorScreen, { isReflow } from './screens/PlanGeneratorScreen';

// v2 Phase 2 tokens pass (group D): UX §9 large text and the §8.5/§8.6 board
// colours on the questionnaire, its review and the preview. React Native's
// Jest setup reports fontScale 2, so every layout test sets it explicitly.

let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const mockNavigation = { push: jest.fn(), replace: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'PlanGenerator-1', name: 'PlanGenerator', params: mockParams }),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children, dockHeight }) => (
    <View testID="shell-page" dockHeight={dockHeight}>
      {children}
    </View>
  );
});
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('./generatorRoutes', () => ({
  generatorRoutes: { PlanGenerator: 'PlanGenerator', PlanGeneratorPreview: 'PlanGeneratorPreview' },
}));
jest.mock('./useTabBarClearance', () => ({ useTabBarClearance: () => 0 }));
// PinnedDock (UX native final audit 27 Oct 2026, ruling 1) reads the safe area.
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/components/BlurLayer', () => {
  const { View } = require('react-native');
  return (props) => <View testID="blur-layer" {...props} />;
});
jest.mock('../../shared/components/ConfirmDialog', () => () => null);
jest.mock('../../shared/components/Select', () => () => null);
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error', info: 'info' },
  addToast: jest.fn(),
}));
jest.mock('./api/generatorApi', () => ({
  getGeneratorProfile: jest.fn(),
  saveGeneratorProfile: jest.fn(),
  previewGeneratedPlan: jest.fn(),
  acceptGeneratedPlan: jest.fn(),
  searchExercises: jest.fn(() => Promise.resolve([])),
}));

const { colors, textScale, gradients } = require('../../shared/theme/tokens');
const { default: PillButton } = require('../../shared/components/PillButton');
const { default: GradientFill } = require('../../shared/components/GradientFill');
const { default: ExerciseImage } = require('../../shared/components/ExerciseImage');
const { Eyebrow } = require('../../shared/components/Typography');

const OPTIONS = {
  goals: ['BUILD_MUSCLE'],
  experience_bands: ['2_PLUS_YEARS'],
  days_per_week: [3, 4],
  session_minutes: [45, 60],
  presets: [{ code: 'FULL_GYM', enabled: true, equipment: [{ id: 3 }] }],
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [{ id: 21, name: 'Quads' }],
  max_focus_muscles: 2,
  exclusion_reasons: ['DISLIKE', 'DISCOMFORT'],
};
const PROFILE = {
  goal: 'BUILD_MUSCLE',
  experience_band: '2_PLUS_YEARS',
  days_per_week: 4,
  session_minutes: 60,
  equipment_preset: 'FULL_GYM',
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [],
  preferred_split: null,
  exclusions: [{ exercise: { id: 9, name: 'Burpee' }, reason: 'DISLIKE' }],
  go_easy_area_ids: [],
};
const FEASIBLE = {
  feasible: true,
  plan_name: 'Build Muscle · 4 Days',
  split: { code: 'UL', name: 'Upper / Lower' },
  days: [
    {
      day_number: 1,
      title: 'Upper A',
      estimated_minutes: 55,
      exercises: [{ exercise: { id: 5, name: 'Bench Press', primary_muscle_group: { name: 'Chest' } }, sets: 3, why: 'a heavy press.' }],
    },
  ],
  weekly_volume: [{ muscle: { id: 1, name: 'Chest' }, sets: 10 }],
};

const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string');
const one = (tree, id) => byTestId(tree, id)[0];
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const buttonIds = (tree, id) =>
  one(tree, id)
    .findAll((node) => node.type === PillButton)
    .map((node) => node.props.testID);

const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

async function openStep6() {
  getGeneratorProfile.mockResolvedValue({ available: true, profile: PROFILE, options: OPTIONS });
  mockParams = { step: 5 };
  return render(<PlanGeneratorScreen />);
}

async function openReview() {
  const tree = await openStep6();
  await act(async () => one(tree, 'generator-next').props.onPress());
  return tree;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockParams = {};
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  jest.useRealTimers();
});

describe('isReflow (§9 rule 4: above 1.3×)', () => {
  it('1 and 1.3 keep the layout; 1.35, 2 and 3.1 reflow', () => {
    expect([1, 1.3, 1.35, 2, 3.1].map(isReflow)).toEqual([false, false, true, true, true]);
  });
});

describe('Questionnaire (PlanGenerator board)', () => {
  it('the step title: page-title cap 1.3, 3 lines by word, shrinks a long word; body text 2×', async () => {
    const tree = await openStep6();
    const title = host(tree, 'generator-step-title');
    expect(title.props).toMatchObject({
      maxFontSizeMultiplier: textScale.display,
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
      textBreakStrategy: 'simple',
    });
    expect(flat(title)).toMatchObject({ fontFamily: 'Geist-Bold' });
    expect(flat(title).fontWeight).toBeUndefined();
    // This screen's own Text (the kit's Eyebrow and PillButton labels are the
    // kit's §9 work).
    const inKit = (node) => {
      for (let at = node.parent; at; at = at.parent) {
        if (at.type === PillButton || at.type === Eyebrow || at.type === ExerciseImage) {
          return true;
        }
      }
      return false;
    };
    const others = tree.root
      .findAllByType(Text)
      .filter(
        (node) =>
          !inKit(node) &&
          node.props.testID !== 'generator-step-title' &&
          // The ghost numeral is display text (1.3 cap), decorative.
          node.props.testID !== 'generator-ghost-numeral' &&
          node.props.children !== '×' &&
          node.props.children !== '✓'
      );
    expect(others.length).toBeGreaterThan(5);
    const missing = others.filter((node) => node.props.maxFontSizeMultiplier !== textScale.body).map((node) => [].concat(node.props.children).join(''));
    expect(missing).toEqual([]);
  });

  it.each([
    [1, 390, ['generator-back', 'generator-next'], 'row'],
    [1, 700, ['generator-back', 'generator-next'], 'row'],
    [1, 834, ['generator-back', 'generator-next'], 'row'],
    [2, 700, ['generator-next', 'generator-back'], 'column'],
    [3.1, 390, ['generator-next', 'generator-back'], 'column'],
  ])('step 6, fontScale %s at %spx: buttons %j, %s', async (fontScale, width, order, direction) => {
    mockWindow = { width, height: 844, scale: 2, fontScale };
    const tree = await openStep6();
    expect(buttonIds(tree, 'generator-buttons')).toEqual(order);
    expect(flat(host(tree, 'generator-buttons')).flexDirection).toBe(direction);
    const full = one(tree, 'generator-buttons').findAll((node) => node.type === PillButton).map((node) => node.props.fullWidth);
    expect(full.every(Boolean)).toBe(direction === 'column');
  });

  it('avoid row: the name wraps to 2 lines with the full name as its label; phone stacks the pills under the name; tablet a row that stacks at 2×', async () => {
    const tree = await openStep6();
    const name = tree.root.find((node) => node.type === Text && node.props.children === 'Burpee');
    expect(name.props).toMatchObject({ numberOfLines: 2, accessibilityLabel: 'Burpee' });
    expect(flat(host(tree, 'generator-avoid-9'))).toMatchObject({ backgroundColor: colors.fillWell, borderColor: colors.hairline, borderRadius: 20 });
    expect(flat(host(tree, 'generator-avoid-9')).flexDirection).toBeUndefined();
    mockWindow = { width: 834, height: 1194, scale: 2, fontScale: 1 };
    const tablet = await openStep6();
    expect(flat(host(tablet, 'generator-avoid-9'))).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    mockWindow = { width: 834, height: 1194, scale: 2, fontScale: 2 };
    const big = await openStep6();
    expect(flat(host(big, 'generator-avoid-9')).flexDirection).toBeUndefined();
  });

  it('search: phone = the 48 pill on surface; tablet = the 52 well pill (surface-well); hairline-strong edge, text-faint placeholder, search icon', async () => {
    const tree = await openStep6();
    const input = host(tree, 'generator-avoid-search');
    expect(flat(input)).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.hairlineStrong, minHeight: 48, borderRadius: 999, paddingLeft: 44 });
    expect(flat(input).height).toBeUndefined();
    expect(input.props).toMatchObject({ placeholderTextColor: colors.textFaint, maxFontSizeMultiplier: textScale.body });
    expect(byTestId(tree, 'icon-search').length).toBeGreaterThan(0);
    mockWindow = { width: 834, height: 1194, scale: 2, fontScale: 1 };
    const tablet = await openStep6();
    expect(flat(host(tablet, 'generator-avoid-search'))).toMatchObject({ backgroundColor: colors.surfaceWell, minHeight: 52, paddingLeft: 46 });
  });
});

describe('Check your answers (GeneratorReview board)', () => {
  it('rows: the gold hero (question 13/600 on-gold-muted, answer 36 on-gold, dark Change); cards (question 12 text-muted, answer 26/700, glass Change, 44 hit)', async () => {
    const tree = await openReview();
    const hero = host(tree, 'generator-review-1');
    const [heroQuestion, heroAnswer] = hero.findAll((node) => node.type === Text);
    expect(flat(heroQuestion)).toMatchObject({ fontSize: 13, color: colors.onGoldMuted, fontFamily: 'Geist-SemiBold' });
    expect(flat(heroAnswer)).toMatchObject({ fontSize: 36, color: colors.onGold, fontFamily: 'Geist-Bold' });
    const heroChange = byTestId(tree, 'generator-review-change-1').find((node) => typeof node.props.children === 'function');
    expect(flat(heroChange)).toMatchObject({ backgroundColor: colors.onGold, minHeight: 34 });
    const row = host(tree, 'generator-review-2');
    const [question, summary] = row.findAll((node) => node.type === Text);
    expect(flat(question)).toMatchObject({ fontSize: 12, color: colors.textMuted });
    expect(flat(question).textTransform).toBeUndefined();
    expect(flat(summary)).toMatchObject({ fontSize: 26, fontFamily: 'Geist-Bold', color: colors.textPrimary });
    const change = byTestId(tree, 'generator-review-change-2').find((node) => typeof node.props.children === 'function');
    expect(flat(change)).toMatchObject({ backgroundColor: colors.hairlineStrong, minHeight: 34, borderRadius: 999 });
    expect(change.props.hitSlop.top + 34 + change.props.hitSlop.bottom).toBe(44);
  });

  it('"Change" pressed = the white 4 % overlay (state rule)', async () => {
    const tree = await openReview();
    const change = byTestId(tree, 'generator-review-change-1').find((node) => typeof node.props.children === 'function');
    let inner;
    act(() => {
      inner = create(<>{change.props.children({ pressed: true })}</>);
    });
    const overlay = inner.root.findAll((node) => node.props?.testID === 'press-overlay' && node.type === 'View')[0];
    expect(flat(overlay).backgroundColor).toBe(colors.pressOverlay);
  });

  it('the disclaimer: fill-subtle + hairline, 14/22 text-secondary', async () => {
    const tree = await openReview();
    const text = tree.root.findAll((node) => node.type === Text).find((node) => String(node.props.children).startsWith('Gymido can'));
    expect(flat(text)).toMatchObject({ fontSize: 14, lineHeight: 22, color: colors.textSecondary });
    expect(flat(text.parent)).toMatchObject({ backgroundColor: colors.fillWell, borderColor: colors.hairline });
  });

  it('fontScale 1: "Change" trails the text; 2: it drops below; 3.1: "See my plan" stacks on top', async () => {
    const tree = await openReview();
    expect(flat(host(tree, 'generator-review-top-2')).flexDirection).toBe('row');
    mockWindow = { ...mockWindow, fontScale: 2 };
    const big = await openReview();
    expect(flat(host(big, 'generator-review-top-2')).flexDirection).toBe('column');
    mockWindow = { ...mockWindow, fontScale: 3.1 };
    const huge = await openReview();
    expect(buttonIds(huge, 'generator-buttons')).toEqual(['generator-see-plan', 'generator-back']);
  });
});

describe('Preview (GeneratorPreview board)', () => {
  async function openPreview() {
    previewGeneratedPlan.mockResolvedValue(FEASIBLE);
    return render(<PlanGeneratorPreviewScreen />);
  }

  it('plan name = page title (1.3, 3 lines, shrink); day title = title-sm (1.6); body 2×', async () => {
    const tree = await openPreview();
    const texts = tree.root.findAllByType(Text);
    const name = texts.find((node) => node.props.children === 'Build Muscle · 4 Days');
    expect(name.props).toMatchObject({ maxFontSizeMultiplier: textScale.display, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    const day = host(tree, 'generator-day-header').findAll((node) => node.type === Text)[0];
    expect(day.props).toMatchObject({ maxFontSizeMultiplier: textScale.title, numberOfLines: 3, adjustsFontSizeToFit: true });
    expect(flat(day)).toMatchObject({ fontSize: 22, fontFamily: 'Geist-Bold' });
    expect(flat(day).fontWeight).toBeUndefined();
    const split = texts.find((node) => node.props.children === 'Upper / Lower');
    expect(split.props.maxFontSizeMultiplier).toBe(textScale.body);
  });

  it('day card: gradient-card from the first render, white 0.08 edge; dividers hairline', async () => {
    const tree = await openPreview();
    const card = host(tree, 'generator-day-1');
    expect(flat(card)).toMatchObject({ borderColor: colors.choiceBorder, overflow: 'hidden' });
    const fill = card.parent.findAllByType(GradientFill)[0];
    expect(fill.props.colors).toEqual(['#1E2129', '#14161C']);
  });

  // UX ruling on M2-1: web's fade stays; the fade sits in a band ABOVE the
  // buttons and the area directly behind them is opaque ground (every phone
  // width), so no card shows through.
  // DECLARED (27 Oct 2026, PLAN-GENERATOR audit b2): was phone only (390 / 431 / 700) with a 24 band; the fade is
  // now the same at EVERY width: a 32 strip, ground 0 → 1, over a solid bar (tablet included).
  // DECLARED (UX native final audit 27 Oct 2026, ruling 1 / GENERATOR-FADE, B245): the bar is the shared
  // PinnedDock. The band's testID was 'generator-bar-fade' → 'generator-sticky-bar-fade'; the ground was on
  // 'generator-sticky-row' → it is on the dock body ('generator-sticky-bar-body'), which runs to the screen edge.
  it.each([390, 431, 700, 834, 1194])('sticky bar (%spx): a 32 fade strip (ground 0 → 1) above, opaque ground behind the buttons, no blur veil', async (width) => {
    mockWindow = { width, height: 844, scale: 2, fontScale: 1 };
    const tree = await openPreview();
    const bar = host(tree, 'generator-sticky-bar');
    const band = host(tree, 'generator-sticky-bar-fade');
    const fade = band.findAllByType(GradientFill)[0];
    expect(fade.props.colors).toEqual(gradients.ctaBarFade.colors);
    expect(fade.props.stops).toEqual([0, 1]);
    expect(flat(band).height).toBe(32);
    expect(bar.findAllByType(GradientFill)).toHaveLength(1);
    expect(flat(bar).backgroundColor).toBeUndefined();
    expect(flat(host(tree, 'generator-sticky-bar-body')).backgroundColor).toBe(colors.ground);
    expect(byTestId(tree, 'blur-layer')).toHaveLength(0);
  });

  it.each([
    // DECLARED (M2-1): 390 was a row (was: ['generator-bar-change', 'generator-start'], 'row'); below 432 it stacks.
    [1, 390, ['generator-start', 'generator-bar-change'], 'column'],
    [1, 431, ['generator-start', 'generator-bar-change'], 'column'],
    [1, 432, ['generator-bar-change', 'generator-start'], 'row'],
    [1, 700, ['generator-bar-change', 'generator-start'], 'row'],
    [1, 834, ['generator-bar-change', 'generator-start'], 'row'],
    [2, 700, ['generator-start', 'generator-bar-change'], 'column'],
    [3.1, 390, ['generator-start', 'generator-bar-change'], 'column'],
  ])('fontScale %s at %spx: bar buttons %j (%s)', async (fontScale, width, order, direction) => {
    mockWindow = { width, height: 844, scale: 2, fontScale };
    const tree = await openPreview();
    expect(buttonIds(tree, 'generator-sticky-row')).toEqual(order);
    expect(flat(host(tree, 'generator-sticky-row')).flexDirection).toBe(direction);
  });

  // DECLARED (UX native final audit 27 Oct 2026, ruling 1): was the list's own paddingBottom = max(112, bar + 16)
  // (112 before measuring, 236 after a 220 bar). Now the page's scroll room = the measured dock height exactly
  // (ShellPage dockHeight → contentContainer paddingBottom); the list adds none; null until measured.
  it('the scroll room is the measured dock height (re-measured on every layout)', async () => {
    const tree = await openPreview();
    expect(flat(host(tree, 'generator-feasible')).paddingBottom).toBeUndefined();
    expect(host(tree, 'shell-page').props.dockHeight).toBeNull();
    await act(async () => host(tree, 'generator-sticky-bar').props.onLayout({ nativeEvent: { layout: { height: 220 } } }));
    expect(host(tree, 'shell-page').props.dockHeight).toBe(220);
  });

  it('day header: minutes trail at 1×, drop below the title at 2×', async () => {
    const tree = await openPreview();
    expect(flat(host(tree, 'generator-day-header')).flexDirection).toBe('row');
    mockWindow = { ...mockWindow, fontScale: 2 };
    const big = await openPreview();
    expect(flat(host(big, 'generator-day-header')).flexDirection).toBe('column');
  });

  it('refusal: title-sm capped 1.6 with shrink; go-easy actions stack primary first at 2× on a wide screen', async () => {
    mockWindow = { width: 700, height: 844, scale: 2, fontScale: 2 };
    previewGeneratedPlan.mockResolvedValue({
      feasible: false,
      reason: { code: 'GO_EASY_TOO_RESTRICTIVE', message: 'Too restrictive.', what_to_change: 'Pick fewer.', equipment_fix: true },
    });
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(host(tree, 'generator-not-feasible-title').props).toMatchObject({ maxFontSizeMultiplier: textScale.title, numberOfLines: 3, adjustsFontSizeToFit: true });
    expect(buttonIds(tree, 'generator-go-easy-actions')).toEqual(['generator-edit-go-easy', 'generator-change-equipment']);
    expect(flat(host(tree, 'generator-go-easy-actions')).flexDirection).toBe('column');
  });
});

describe('G1 card (GeneratorStates board)', () => {
  const { GeneratorUnavailable } = require('./components/GeneratorStates');
  const { gradients } = require('../../shared/theme/tokens');

  it('the gold 0.18 wash = glow-gold-ambient; the 0.08 edge stays exact', async () => {
    const tree = await render(<GeneratorUnavailable onBack={jest.fn()} />);
    const [card, glow] = tree.root.findAllByType(GradientFill);
    expect(card.props.colors).toBe(gradients.card.colors);
    expect(glow.props.colors).toBe(gradients.accountGlow.colors);
    expect(glow.props.colors[0]).toBe('rgba(255, 194, 26, 0.18)');
    expect(flat(host(tree, 'generator-unavailable')).borderColor).toBe('rgba(255, 255, 255, 0.08)');
  });

  it.each([1, 2, 3.1])('fontScale %s: title capped 1.6, 3 lines, shrinks; message 2×; no fixed height', async (fontScale) => {
    mockWindow = { ...mockWindow, fontScale };
    const tree = await render(<GeneratorUnavailable onBack={jest.fn()} />);
    const [title, message] = tree.root.findAllByType(Text);
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: textScale.title, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    expect(message.props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(message.props.numberOfLines).toBeUndefined();
    expect(flat(host(tree, 'generator-unavailable')).height).toBeUndefined();
  });
});

// UX final audit X7 ruling (27 Oct 2026, §1.1): every name in a row, card or
// list is at most 2 lines then a tail ellipsis, no font shrink. Phone + tablet.
describe.each([
  ['phone', 390],
  ['tablet', 834],
])('X7 generator row names, %s', (_label, width) => {
  const NAME = { numberOfLines: 2, ellipsizeMode: 'tail' };
  const nameNodes = (tree, value) => tree.root.findAll((node) => node.type === Text && node.props.children === value);
  const expectName = (node) => {
    expect(node.props).toMatchObject(NAME);
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  };
  beforeEach(() => {
    mockWindow = { width, height: 1194, scale: 2, fontScale: 3.1 };
  });

  it('preview: the split name, the exercise rows and the weekly-volume rows', async () => {
    previewGeneratedPlan.mockResolvedValue(FEASIBLE);
    const tree = await render(<PlanGeneratorPreviewScreen />);
    ['Upper / Lower', 'Bench Press'].forEach((value) => {
      const nodes = nameNodes(tree, value);
      expect([value, nodes.length > 0]).toEqual([value, true]);
      nodes.forEach(expectName);
    });
    // "Chest" is also the exercise row's muscle caption; the weekly-volume row name is one of them.
    expect(nameNodes(tree, 'Chest').filter((node) => node.props.numberOfLines === 2 && node.props.ellipsizeMode === 'tail')).toHaveLength(1);
  });

  it('questionnaire: the equipment rows and the avoid search results', async () => {
    getGeneratorProfile.mockResolvedValue({ available: true, profile: PROFILE, options: OPTIONS });
    mockParams = { step: 4 };
    const equipment = await render(<PlanGeneratorScreen />);
    await act(async () => one(equipment, 'generator-preset-FULL_GYM').props.onPress());
    await act(async () => one(equipment, 'generator-edit-equipment').props.onPress());
    const barbell = nameNodes(equipment, 'Barbell');
    expect(barbell.length).toBeGreaterThan(0);
    barbell.forEach(expectName);

    searchExercises.mockResolvedValue([{ id: 77, name: 'Romanian Deadlift', primary_muscle_group: null }]);
    const tree = await openStep6();
    await act(async () => host(tree, 'generator-avoid-search').props.onChangeText('roman'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    const result = nameNodes(tree, 'Romanian Deadlift');
    expect(result.length).toBeGreaterThan(0);
    result.forEach(expectName);
  });
});
