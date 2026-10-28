import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import BackPill from '../../shared/components/BackPill';
import { getGeneratorProfile, previewGeneratedPlan, saveGeneratorProfile, searchExercises } from './api/generatorApi';
import PlanGeneratorPreviewScreen from './screens/PlanGeneratorPreviewScreen';
import PlanGeneratorScreen, { stepBarPlacement } from './screens/PlanGeneratorScreen';

// v2 Phase 4 §3 Generator (UX J): look of the questionnaire, review and
// preview on phone (390) and tablet (834); every state and action; §9 large
// text at fontScale 1 / 2 / 3.1. Behaviour stays v1 (other suites).

let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

// T-65 (declared mock change): canGoBack, so step 1's ✕ goes back in history (backOrReplace).
const mockNavigation = { push: jest.fn(), replace: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), addListener: jest.fn(() => () => {}) };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'PlanGenerator-1', name: 'PlanGenerator', params: mockParams }),
  CommonActions: { reset: jest.fn() },
}));
// The page's dock room is checked as the prop ShellPage gets (ShellPage.test
// pins that it becomes the contentContainer's paddingBottom).
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children, dockHeight }) => (
    <View testID="shell-page" dockHeight={dockHeight}>
      {children}
    </View>
  );
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('./generatorRoutes', () => ({
  generatorRoutes: { PlanGenerator: 'PlanGenerator', PlanGeneratorPreview: 'PlanGeneratorPreview' },
}));
jest.mock('../../shared/components/ConfirmDialog', () => () => null);
jest.mock('../../shared/components/Select', () => {
  const { View } = require('react-native');
  return (props) => <View testID="mock-select" {...props} />;
});
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

const ReactNative = require('react-native');
const { AccessibilityInfo } = ReactNative;
const { colors, gradients, muscle, textScale } = require('../../shared/theme/tokens');
const { default: PillButton } = require('../../shared/components/PillButton');
const { default: GradientFill } = require('../../shared/components/GradientFill');
const { default: ExerciseImage } = require('../../shared/components/ExerciseImage');
const { default: IconButton } = require('../../shared/components/IconButton');
const { default: FeedbackIcon } = require('../../shared/components/FeedbackIcon');

const OPTIONS = {
  goals: ['BUILD_MUSCLE', 'GET_STRONGER', 'GENERAL_FITNESS'],
  experience_bands: ['UNDER_6_MONTHS', '2_PLUS_YEARS'],
  days_per_week: [3, 4],
  session_minutes: [45, 60],
  presets: [
    { code: 'FULL_GYM', enabled: true, equipment: [{ id: 3 }] },
    { code: 'KETTLEBELL', enabled: false, equipment: [] },
  ],
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [{ id: 21, name: 'Chest' }],
  max_focus_muscles: 2,
  exclusion_reasons: ['DISLIKE', 'DISCOMFORT'],
  go_easy_areas: [{ id: 1, code: 'KNEES', name: 'Knees', focus_muscle_ids: [] }],
  go_easy_notice: '',
};
const PROFILE = {
  goal: 'BUILD_MUSCLE',
  experience_band: '2_PLUS_YEARS',
  days_per_week: 4,
  session_minutes: 60,
  equipment_preset: 'FULL_GYM',
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [{ id: 21, name: 'Chest' }],
  preferred_split: null,
  exclusions: [{ exercise: { id: 9, name: 'Burpee' }, reason: 'DISLIKE' }],
  go_easy_area_ids: [1],
};
const exercise = (id, name, code, extra = {}) => ({
  exercise: { id, name, primary_muscle_group: { name: code === 'CHEST' ? 'Chest' : 'Back', code }, thumbnail: { url: `https://x.test/${id}.jpg` } },
  sets: 3,
  reps_min: 6,
  reps_max: 10,
  rest_seconds: 120,
  ...extra,
});
const FEASIBLE = {
  feasible: true,
  plan_name: 'Build Muscle · 4 Days',
  split: { code: 'UL', name: 'Upper / Lower' },
  split_options: [
    { code: 'UL', name: 'Upper / Lower' },
    { code: 'FB', name: 'Full body' },
  ],
  notes: [{ code: 'GO_EASY_AREAS', text: 'Going easy on knees.' }],
  warnings: [{ code: 'W', text: 'Short sessions.' }],
  active_enrollment: { plan_name: 'Old plan', trainer_locked: false },
  days: [
    {
      day_number: 1,
      title: 'Upper A',
      estimated_minutes: 55,
      exercises: [
        exercise(5, 'Bench Press', 'CHEST', { why: 'a heavy press.', effort: 'Leave 2 reps.' }),
        exercise(6, 'Barbell Row', 'BACK', { why: 'pull to balance.' }),
      ],
      skipped: [{ text: 'No cable for flyes.' }],
    },
  ],
  weekly_volume: [
    { muscle: { id: 1, name: 'Chest' }, sets: 10 },
    { muscle: { id: 2, name: 'Back' }, sets: 5 },
  ],
};

const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string');
const one = (tree, id) => byTestId(tree, id)[0];
const has = (tree, id) => tree.root.findAll((node) => node.props.testID === id).length > 0;
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const textOf = (tree, value) => tree.root.findAll((node) => node.type === Text && node.props.children === value)[0];
const press = (tree, id) => act(async () => one(tree, id).props.onPress());
const pressableStyle = (tree, id, pressed = false) => {
  const node = tree.root.findAll((n) => n.props.testID === id && typeof n.props.children === 'function')[0];
  const style = node.props.style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style);
};

const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

async function openStep(step, { profile = PROFILE, options = OPTIONS } = {}) {
  getGeneratorProfile.mockResolvedValue({ available: true, profile, options });
  mockParams = step > 1 ? { step: step - 1 } : {};
  return render(<PlanGeneratorScreen />);
}

async function openReview(setup) {
  const tree = await openStep(6, setup);
  await press(tree, 'generator-next');
  return tree;
}

async function openPreview(preview = FEASIBLE) {
  previewGeneratedPlan.mockResolvedValue(preview);
  return render(<PlanGeneratorPreviewScreen />);
}

const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 };
const TABLET = { width: 834, height: 1194, scale: 2, fontScale: 1 };

let focusSpy;
let handleSpy;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockParams = {};
  mockWindow = { ...PHONE };
  focusSpy = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  handleSpy = jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue((ref) => (ref ? ref.props?.testID ?? 7 : null));
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  focusSpy.mockRestore();
  handleSpy.mockRestore();
  jest.useRealTimers();
});

describe('Questionnaire, phone (PlanGenerator board)', () => {
  it('top row: 44 glass icon button "Cancel" (✕) on step 1, "Build me a plan" 14/600 secondary centred, a 44 spacer', async () => {
    const tree = await openStep(1);
    const button = tree.root.find((node) => node.type === IconButton);
    expect(button.props.accessibilityLabel).toBe('Cancel');
    expect(byTestId(tree, 'icon-close').length).toBeGreaterThan(0);
    expect(flat(textOf(tree, 'Build me a plan'))).toMatchObject({ fontSize: 14, color: colors.textSecondary, textAlign: 'center' });
    await act(async () => button.props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('top icon on steps 2–6 is "Back" (‹) → the previous step', async () => {
    const tree = await openStep(3);
    const button = tree.root.find((node) => node.type === IconButton);
    expect(button.props.accessibilityLabel).toBe('Back');
    expect(byTestId(tree, 'icon-chevron-left').length).toBeGreaterThan(0);
    await act(async () => button.props.onPress());
    expect(textOf(tree, 'Step 2 of 6')).toBeDefined();
  });

  it('progress segments (Step n of 6), gold eyebrow 14/600, h1 46/44 (step 6: 42/42), ghost numeral "n/6" in gold-line, decorative', async () => {
    const tree = await openStep(2);
    expect(host(tree, 'generator-progress').props.accessibilityLabel).toBe('Step 2 of 6');
    expect(flat(host(tree, 'generator-step-eyebrow'))).toMatchObject({ fontSize: 14, color: colors.gold });
    expect(flat(host(tree, 'generator-step-title'))).toMatchObject({ fontSize: 46, lineHeight: 44 });
    const ghost = host(tree, 'generator-ghost-numeral');
    expect(ghost.props.children).toBe('2/6');
    expect(ghost.props.accessibilityElementsHidden).toBe(true);
    expect(flat(ghost)).toMatchObject({ fontSize: 64, color: colors.goldLine, fontVariant: ['tabular-nums'] });
    const six = await openStep(6);
    expect(flat(host(six, 'generator-step-title'))).toMatchObject({ fontSize: 42, lineHeight: 42 });
    expect(textOf(six, 'Optional.')).toBeDefined();
  });

  it('step 1: a "Main goal" radio group of icon cards (teal tile on General fitness) and the approved hint (N6)', async () => {
    const tree = await openStep(1, { profile: null });
    expect(host(tree, 'generator-goals').props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Main goal' });
    expect(tree.root.findAll((node) => node.props.testID === 'choice-icon-tile' && typeof node.type === 'string')).toHaveLength(3);
    expect(one(tree, 'generator-goal-GENERAL_FITNESS').props.iconTone).toBe('teal');
    expect(textOf(tree, "Next: how long you've been lifting, days a week, session length, where you train, and anything to focus on or avoid.")).toBeDefined();
    expect(flat(host(tree, 'generator-step1-hint'))).toMatchObject({ fontSize: 13, color: colors.textMuted });
  });

  it('step 1 nothing selected: Next disabled; selecting checks the radio and enables Next; re-tap keeps it', async () => {
    const tree = await openStep(1, { profile: null });
    expect(one(tree, 'generator-next').props.disabled).toBe(true);
    await press(tree, 'generator-goal-GET_STRONGER');
    expect(one(tree, 'generator-goal-GET_STRONGER').props.selected).toBe(true);
    await press(tree, 'generator-goal-GET_STRONGER');
    expect(one(tree, 'generator-goal-GET_STRONGER').props.selected).toBe(true);
    expect(one(tree, 'generator-next').props.disabled).toBe(false);
  });

  // DECLARED (UX native final audit 27 Oct 2026, ruling 1, B236): was the bar at { left: 16, right: 16,
  // bottom: 102 } (clearance + 16) and the column's paddingBottom = bar + 16 (76 for a 60 bar). Now the shared
  // dock: edge to edge to the bottom, the pair 12 above the tab bar (body paddingBottom 86 + 12, sides 16), and
  // the scroll room = the dock's measured height (ShellPage dockHeight).
  it('steps 1–5: the pinned dock above the tab bar (12 gap), 60 CTA buttons in a row, primary with the arrow; scroll room = the measured dock', async () => {
    const tree = await openStep(2);
    const bar = host(tree, 'generator-step-bar');
    expect(flat(bar)).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0 });
    expect(flat(host(tree, 'generator-step-bar-body'))).toMatchObject({ paddingHorizontal: 16, paddingBottom: 98 });
    const buttons = one(tree, 'generator-buttons').findAll((node) => node.type === PillButton);
    expect(buttons.map((node) => [node.props.testID, node.props.size])).toEqual([
      ['generator-back', 'cta'],
      ['generator-next', 'cta'],
    ]);
    expect(typeof buttons[1].props.icon).toBe('function');
    await act(async () => bar.props.onLayout({ nativeEvent: { layout: { height: 190 } } }));
    expect(host(tree, 'shell-page').props.dockHeight).toBe(190);
  });

  // DECLARED (UX native final audit 27 Oct 2026, ruling 1, B237): was "step 6: buttons in the flow (default 52)"
  // with no step bar; step 6 is now pinned in the same dock, 60 CTA like steps 1–5.
  it('step 6: buttons pinned in the dock (60 CTA), "Skip" while nothing is chosen', async () => {
    const tree = await openStep(6, { profile: { ...PROFILE, focus_muscles: [], exclusions: [], go_easy_area_ids: [] } });
    expect(has(tree, 'generator-step-bar')).toBe(true);
    expect(one(tree, 'generator-next').props).toMatchObject({ size: 'cta', title: 'Skip' });
  });

  it('steps 2–4 controls: experience radio cards (72, no icon); day / minute pills = large radios in a named group', async () => {
    const two = await openStep(2);
    expect(host(two, 'generator-bands').props.accessibilityLabel).toBe('Lifting experience');
    expect(pressableStyle(two, 'generator-band-2_PLUS_YEARS').minHeight).toBe(72);
    const three = await openStep(3);
    expect(host(three, 'generator-days').props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Days a week' });
    expect(one(three, 'generator-days-4').props).toMatchObject({ size: 'large', accessibilityRole: 'radio', selected: true });
    await press(three, 'generator-days-3');
    expect(one(three, 'generator-days-3').props.selected).toBe(true);
    const four = await openStep(4);
    expect(host(four, 'generator-minutes').props.accessibilityLabel).toBe('Session length');
    expect(one(four, 'generator-minutes-60').props.accessibilityRole).toBe('radio');
  });

  it('step 5: a "Where you train" radio group; the disabled preset is dashed + "Not available yet" and not pressable', async () => {
    const tree = await openStep(5);
    expect(host(tree, 'generator-presets').props.accessibilityLabel).toBe('Where you train');
    expect(one(tree, 'generator-preset-KETTLEBELL').props).toMatchObject({ disabled: true, hint: 'Not available yet' });
    expect(pressableStyle(tree, 'generator-preset-KETTLEBELL')).toMatchObject({ borderStyle: 'dashed', opacity: 0.5 });
  });

  it('step 5 edit equipment: the list toggles; a checkbox row toggles its id', async () => {
    const tree = await openStep(5);
    await press(tree, 'generator-edit-equipment');
    expect(has(tree, 'generator-equipment-list')).toBe(true);
    await press(tree, 'generator-equipment-3');
    const row = tree.root.find((node) => node.props.testID === 'generator-equipment-3' && node.props.accessibilityState);
    expect(row.props.accessibilityState).toEqual({ checked: false });
    await press(tree, 'generator-edit-equipment');
    expect(has(tree, 'generator-equipment-list')).toBe(false);
  });

  it('a step change moves the accessibility focus to the new heading', async () => {
    const tree = await openStep(2);
    focusSpy.mockClear();
    await press(tree, 'generator-next');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(focusSpy).toHaveBeenCalledWith('generator-step-title');
  });

  it('step 6 phone: bare sections (label 20/700), focus pills 46, search 48 with the icon, avoided rows stacked with a 48 tile and the 38 remove disc (44 hit)', async () => {
    const tree = await openStep(6);
    expect(flat(textOf(tree, 'Focus muscles'))).toMatchObject({ fontSize: 20, fontFamily: 'Geist-Bold' });
    expect(one(tree, 'generator-focus-21').props).toMatchObject({ size: 'focus', accessibilityRole: 'togglebutton' });
    expect(one(tree, 'generator-go-easy-1').props.size).toBe('focus');
    expect(tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === 'generator-avoid-photo-9')[0].props).toMatchObject({ size: 48, url: null });
    expect(one(tree, 'generator-avoid-9-DISLIKE').props.size).toBe('reason');
    const remove = tree.root.findAll((node) => node.props.testID === 'generator-avoid-remove-9' && typeof node.props.children === 'function')[0];
    expect(flat(remove)).toMatchObject({ width: 38, height: 38, borderRadius: 999, backgroundColor: colors.fillGlass });
    expect(remove.props.hitSlop.top * 2 + 38).toBe(44);
    await press(tree, 'generator-avoid-remove-9');
    expect(has(tree, 'generator-avoid-9')).toBe(false);
  });

  it('avoid search: "Searching…" (polite) while waiting; results with a 40 thumbnail; choosing adds the row WITH the loaded photo (N4)', async () => {
    searchExercises.mockResolvedValue([{ id: 12, name: 'Deadlift', thumbnail: { url: 'https://x.test/12.jpg' }, primary_muscle_group: { code: 'BACK' } }]);
    const tree = await openStep(6);
    await act(async () => one(tree, 'generator-avoid-search').props.onChangeText('dead'));
    expect(host(tree, 'generator-avoid-live').props.accessibilityLiveRegion).toBe('polite');
    expect(has(tree, 'generator-avoid-searching')).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(searchExercises).toHaveBeenCalledWith('dead');
    const thumb = tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === 'generator-avoid-result-photo-12')[0];
    expect(thumb.props).toMatchObject({ size: 40, url: 'https://x.test/12.jpg' });
    await press(tree, 'generator-avoid-result-12');
    expect(has(tree, 'generator-avoid-12')).toBe(true);
    const photo = tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === 'generator-avoid-photo-12')[0];
    expect(photo.props.url).toBe('https://x.test/12.jpg');
    expect(one(tree, 'generator-avoid-search').props.value).toBe('');
  });

  it('a reason pill switches the pressed reason (exactly one)', async () => {
    const tree = await openStep(6);
    await press(tree, 'generator-avoid-9-DISCOMFORT');
    expect(one(tree, 'generator-avoid-9-DISCOMFORT').props.selected).toBe(true);
    expect(one(tree, 'generator-avoid-9-DISLIKE').props.selected).toBe(false);
  });
});

describe('Questionnaire, tablet (TabletGenerator board)', () => {
  beforeEach(() => {
    mockWindow = { ...TABLET };
  });

  it('no top icon button, no ghost numeral; progress 5 tall; eyebrow 15; h1 60/60; buttons in the flow, right-aligned, 52', async () => {
    const tree = await openStep(2);
    expect(has(tree, 'generator-top-row')).toBe(false);
    expect(has(tree, 'generator-ghost-numeral')).toBe(false);
    expect(has(tree, 'generator-step-bar')).toBe(false);
    expect(flat(host(tree, 'generator-step-eyebrow')).fontSize).toBe(15);
    expect(flat(host(tree, 'generator-step-title'))).toMatchObject({ fontSize: 60, lineHeight: 60 });
    expect(flat(host(tree, 'generator-buttons'))).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    expect(one(tree, 'generator-next').props.size).toBe('default');
    expect(has(tree, 'generator-step1-hint')).toBe(false);
  });

  it('step 6: the three sections are gradient cards (Focus → Go easy → Avoid), label 17/600, pills 44, search 52 on surface-well, avoided photo 64 r16', async () => {
    const tree = await openStep(6);
    const ids = ['generator-focus-section', 'generator-go-easy', 'generator-avoid-section'];
    ids.forEach((id) => {
      const card = host(tree, id);
      expect(flat(card)).toMatchObject({ borderRadius: 28, padding: 24, borderColor: colors.choiceBorder, overflow: 'hidden' });
      expect(card.findAllByType(GradientFill)[0].props.colors).toEqual(gradients.card.colors);
    });
    const order = tree.root.findAll((node) => ids.includes(node.props.testID) && typeof node.type === 'string').map((node) => node.props.testID);
    expect(order).toEqual(ids);
    expect(flat(textOf(tree, 'Focus muscles'))).toMatchObject({ fontSize: 17, fontFamily: 'Geist-SemiBold' });
    expect(one(tree, 'generator-focus-21').props.size).toBe('focusTablet');
    const photo = tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === 'generator-avoid-photo-9')[0];
    expect(photo.props.size).toBe(64);
    expect(flat(photo).borderRadius).toBe(16);
  });
});

describe('Check your answers (GeneratorReview board)', () => {
  it('the gold GRADIENT hero (N3) with the decorative ink ring; grid cards in question order; days/minutes numerals + units', async () => {
    const tree = await openReview();
    const hero = host(tree, 'generator-review-1');
    const fill = hero.findAllByType(GradientFill)[0];
    expect(fill.props).toMatchObject({ colors: gradients.gold.colors, stops: gradients.gold.stops });
    expect(flat(host(tree, 'generator-review-hero-ring'))).toMatchObject({ width: 180, height: 180, borderWidth: 24, borderColor: colors.inkFaint });
    expect(tree.root.findAll((node) => node.type === PillButton && node.props.variant !== 'secondary')).toHaveLength(1);
    const days = host(tree, 'generator-review-3');
    expect(days.findAll((node) => node.type === Text).map((node) => [].concat(node.props.children).filter((c) => typeof c === 'string').join(''))).toEqual(
      expect.arrayContaining(['4', '\u00a0days a week'])
    );
    const number = days.findAll((node) => node.type === Text && [].concat(node.props.children).includes('4'))[0];
    expect(flat(number)).toMatchObject({ fontSize: 44, fontVariant: ['tabular-nums'] });
    expect(number.props.maxFontSizeMultiplier).toBe(textScale.display);
    expect(textOf(tree, '\u00a0min')).toBeDefined();
  });

  it('each card reads as ONE string (question: code summary); row 5 = preset + chips (Bodyweight first); row 6 lines with coloured labels', async () => {
    const tree = await openReview();
    const label = (step) =>
      host(tree, `generator-review-${step}`)
        .findAll((node) => node.props.accessible && typeof node.props.accessibilityLabel === 'string')
        .map((node) => node.props.accessibilityLabel)[0];
    expect(label(1)).toBe("What's your main goal?: Build muscle");
    expect(label(5)).toBe('Where do you train?: Full gym · Bodyweight, Barbell');
    expect(label(6)).toBe('Anything to focus on or avoid?: Focus: Chest · Go easy on: Knees · Avoid: Burpee');
    expect(textOf(tree, 'Bodyweight')).toBeDefined();
    expect(textOf(tree, 'Barbell')).toBeDefined();
    expect(flat(textOf(tree, 'Focus: '))).toMatchObject({ color: colors.gold });
    expect(flat(textOf(tree, 'Go easy on: '))).toMatchObject({ color: colors.warning });
    expect(flat(textOf(tree, 'Avoid: '))).toMatchObject({ color: muscle.core });
  });

  it('empty parts read "No focus", "Nothing to go easy on", "Nothing to avoid" (no label colour)', async () => {
    const tree = await openReview({ profile: { ...PROFILE, focus_muscles: [], exclusions: [], go_easy_area_ids: [] } });
    ['No focus', 'Nothing to go easy on', 'Nothing to avoid'].forEach((value) => {
      expect(host(tree, 'generator-review-6').findAll((node) => node.type === Text && [].concat(node.props.children).includes(value)).length).toBeGreaterThan(0);
    });
  });

  it('row 6 photo: none for a profile exclusion (not loaded, N4); the photo + name chip once the exercise was loaded by a search', async () => {
    const plain = await openReview();
    expect(has(plain, 'generator-review-avoid-photo')).toBe(false);
    searchExercises.mockResolvedValue([{ id: 12, name: 'Deadlift', thumbnail: { url: 'https://x.test/12.jpg' } }]);
    const tree = await openStep(6, { profile: { ...PROFILE, exclusions: [] } });
    await act(async () => one(tree, 'generator-avoid-search').props.onChangeText('dead'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await press(tree, 'generator-avoid-result-12');
    await press(tree, 'generator-next');
    const photo = host(tree, 'generator-review-avoid-photo');
    expect(photo.props.accessibilityElementsHidden).toBe(true);
    expect(photo.findByType(ExerciseImage).props).toMatchObject({ url: 'https://x.test/12.jpg', size: 128 });
    expect(photo.findAll((node) => node.type === Text && node.props.children === 'Deadlift').length).toBe(1);
  });

  it('"Change" on each card → that step; the hero Change is the dark pill with gold text', async () => {
    const tree = await openReview();
    const heroLabel = host(tree, 'generator-review-change-1').findAll((node) => node.type === Text)[0];
    expect(flat(heroLabel).color).toBe(colors.gold);
    expect(one(tree, 'generator-review-change-1').props.accessibilityLabel).toBe("Change: What's your main goal?");
    await press(tree, 'generator-review-change-4');
    expect(textOf(tree, 'Step 4 of 6')).toBeDefined();
    expect(one(tree, 'generator-review-change-1')).toBeUndefined();
  });

  it('saving: "See my plan" loading + Back disabled; save failed: the InlineError and both active again', async () => {
    let reject;
    saveGeneratorProfile.mockImplementation(() => new Promise((_, r) => (reject = r)));
    const tree = await openReview();
    await act(async () => {
      one(tree, 'generator-see-plan').props.onPress();
    });
    expect(one(tree, 'generator-see-plan').props.loading).toBe(true);
    expect(one(tree, 'generator-back').props.disabled).toBe(true);
    await act(async () => reject({ response: { status: 500, data: { message: 'Down.' } } }));
    expect(has(tree, 'generator-save-error')).toBe(true);
    expect(one(tree, 'generator-see-plan').props.loading).toBe(false);
    expect(one(tree, 'generator-back').props.disabled).toBe(false);
  });

  it('a 422 puts the server message under its card in danger-text 14/20', async () => {
    saveGeneratorProfile.mockRejectedValue({ response: { status: 422, data: { message: 'Invalid.', errors: { days_per_week: ['Pick 3–5.'] } } } });
    const tree = await openReview();
    await press(tree, 'generator-see-plan');
    expect(flat(host(tree, 'generator-review-error-3'))).toMatchObject({ color: colors.dangerText, fontSize: 14, lineHeight: 20 });
  });

  it('the disclaimer is a note; Back → step 6', async () => {
    const tree = await openReview();
    const disclaimer = tree.root.findAll((node) => node.type === Text).find((node) => String(node.props.children).startsWith('Gymido can')).parent;
    expect(disclaimer.props.role).toBe('note');
    await press(tree, 'generator-back');
    expect(textOf(tree, 'Step 6 of 6')).toBeDefined();
  });

  it.each([
    [1, 'row', ['generator-back', 'generator-see-plan']],
    [2, 'column', ['generator-see-plan', 'generator-back']],
    [3.1, 'column', ['generator-see-plan', 'generator-back']],
  ])('fontScale %s: small cards %s, buttons %j', async (fontScale, direction, order) => {
    mockWindow = { ...PHONE, fontScale };
    const tree = await openReview();
    const pair = host(tree, 'generator-review-pair');
    expect(flat(pair).flexDirection).toBe(direction);
    expect(one(tree, 'generator-buttons').findAll((node) => node.type === PillButton).map((node) => node.props.testID)).toEqual(order);
  });
});

describe('Preview, phone (GeneratorPreview board)', () => {
  it('back icon button "Back to your answers" → a fresh questionnaire (review M1); eyebrow gold; plan name ONE string 44/42 primary (N1); split sub-line; pill select', async () => {
    const tree = await openPreview();
    const back = tree.root.find((node) => node.type === IconButton);
    expect(back.props.accessibilityLabel).toBe('Back to your answers');
    await act(async () => back.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanGenerator');
    expect(flat(host(tree, 'generator-preview-eyebrow'))).toMatchObject({ color: colors.gold, fontSize: 14 });
    const name = host(tree, 'generator-plan-name');
    expect(name.props.children).toBe('Build Muscle · 4 Days');
    expect(flat(name)).toMatchObject({ fontSize: 44, lineHeight: 42, color: colors.textPrimary });
    expect(textOf(tree, 'Upper / Lower')).toBeDefined();
    expect(one(tree, 'generator-split').props).toMatchObject({ variant: 'pill', label: 'Change split' });
  });

  it('callouts: notes (info + icon, GO_EASY_AREAS role note), warnings (warning + icon), the active notice (info, role note)', async () => {
    const tree = await openPreview();
    expect(host(tree, 'generator-note-0').props.role).toBe('note');
    expect(flat(host(tree, 'generator-note-0')).backgroundColor).toBe(colors.infoFaint);
    expect(flat(host(tree, 'generator-warning-0')).backgroundColor).toBe(colors.warningTint);
    expect(host(tree, 'generator-active').props.role).toBe('note');
    expect(tree.root.findAll((node) => node.type === FeedbackIcon).map((node) => node.props.name)).toEqual(['info', 'warning', 'info']);
  });

  it('day card: title-sm, "~55 min" chip; the first exercise is the featured 150 photo row, the rest compact 72 × 60 rows; skipped line italic', async () => {
    const tree = await openPreview();
    expect(flat(host(tree, 'generator-day-minutes-chip'))).toMatchObject({ minHeight: 26, borderRadius: 999, backgroundColor: colors.fillGlass });
    const featured = host(tree, 'generator-featured-row');
    const hero = featured.findByType(ExerciseImage);
    expect(hero.props).toMatchObject({ hero: true, url: 'https://x.test/5.jpg' });
    expect(flat(hero)).toMatchObject({ height: 150, borderRadius: 20 });
    const compact = host(tree, 'generator-compact-row').findByType(ExerciseImage);
    expect(flat(compact)).toMatchObject({ width: 72, height: 60 });
    expect(flat(textOf(tree, 'No cable for flyes.'))).toMatchObject({ fontStyle: 'italic', color: colors.textMuted });
    expect(textOf(tree, 'Leave 2 reps.')).toBeDefined();
  });

  it('rows are links named "{name}, {muscle}, {prescription}" that open Exercise detail; muscle = muted label with a muscle dot', async () => {
    const tree = await openPreview();
    const link = tree.root.findAll((node) => node.props.testID === 'generator-exercise-6' && node.props.accessibilityRole === 'link')[0];
    expect(link.props.accessibilityLabel).toBe('Barbell Row, Back, 3 sets × 6–10 reps · rest 2:00');
    await act(async () => link.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: '6' });
    const dots = tree.root.findAll((node) => node.props.testID === 'muscle-dot' && typeof node.type === 'string');
    expect(dots.map((node) => flat(node).backgroundColor)).toEqual([muscle.chest, muscle.back]);
  });

  it('a video thumbnail (media_type) or no URL → the §8.1 tile (url null)', async () => {
    const video = {
      ...FEASIBLE,
      days: [{ ...FEASIBLE.days[0], exercises: [exercise(5, 'Bench', 'CHEST', {}), { ...exercise(7, 'Fly', 'CHEST') }] }],
    };
    video.days[0].exercises[0].exercise.thumbnail = { url: 'https://x.test/v.mp4', media_type: 'video/mp4' };
    video.days[0].exercises[1].exercise.thumbnail = null;
    const tree = await openPreview(video);
    const urls = tree.root.findAll((node) => node.type === ExerciseImage).map((node) => node.props.url);
    expect(urls).toEqual([null, null]);
  });

  it('weekly sets: surface card, title 20/700, rows 15 tabular, decorative bars by share of the most sets', async () => {
    const tree = await openPreview();
    expect(flat(host(tree, 'generator-weekly'))).toMatchObject({ backgroundColor: colors.surface, borderRadius: 24, padding: 20 });
    expect(flat(textOf(tree, 'Weekly sets'))).toMatchObject({ fontSize: 20, fontFamily: 'Geist-Bold' });
    const bars = tree.root.findAll((node) => node.props.testID === 'generator-weekly-bar' && typeof node.type === 'string');
    expect(bars.map((node) => flat(node).width)).toEqual(['100%', '50%']);
    expect(flat(textOf(tree, '10 sets')).fontVariant).toEqual(['tabular-nums']);
  });

  // DECLARED change (UX verdict M2-1, 8b3f143): the phone bar was a row of two
  // 60 CTAs (was: [['generator-bar-change', 'cta'], ['generator-start', 'cta']]),
  // and "Start this / plan" wrapped. Web stacks below 432: Start (gold) over
  // Change (glass), both full width, 52, gap 10 (UX ruling: web's value), the
  // kit fade above an opaque band behind the buttons.
  it('sticky bar (phone < 432): Start this plan over Change my answers, full width, 52, gap 10, opaque behind the buttons; locked → no Start, the warning callout', async () => {
    const tree = await openPreview();
    const buttons = host(tree, 'generator-sticky-row').findAll((node) => node.type === PillButton);
    expect(buttons.map((node) => [node.props.testID, node.props.size, node.props.fullWidth])).toEqual([
      ['generator-start', 'default', true],
      ['generator-bar-change', 'default', true],
    ]);
    // DECLARED (UX native final audit 27 Oct 2026, ruling 1, B245): was the row's backgroundColor ground and the
    // bar at bottom 86 (on the tab bar's top). Now the dock body is the ground and the dock runs to the screen
    // edge (bottom 0), the stack 12 above the tab bar (body paddingBottom 86 + 12).
    expect(flat(host(tree, 'generator-sticky-row'))).toMatchObject({ flexDirection: 'column', alignItems: 'stretch', gap: 10 });
    expect(flat(host(tree, 'generator-sticky-bar'))).toMatchObject({ position: 'absolute', bottom: 0 });
    expect(flat(host(tree, 'generator-sticky-bar-body'))).toMatchObject({ backgroundColor: colors.ground, paddingBottom: 98 });
    const locked = await openPreview({ ...FEASIBLE, active_enrollment: { plan_name: 'Coach plan', trainer_locked: true } });
    expect(has(locked, 'generator-start')).toBe(false);
    expect(has(locked, 'generator-locked')).toBe(true);
    expect(has(locked, 'generator-bar-change')).toBe(true);
  });

  it('large text (fontScale 2 / 3.1): the bar scrolls with the page (not absolute), stacked primary first; 1: pinned', async () => {
    for (const fontScale of [2, 3.1]) {
      mockWindow = { ...PHONE, fontScale };
      const tree = await openPreview();
      expect(flat(host(tree, 'generator-sticky-bar')).position).toBeUndefined();
      expect(host(tree, 'generator-feasible').findAll((node) => node.props.testID === 'generator-sticky-bar').length).toBeGreaterThan(0);
      expect(host(tree, 'generator-sticky-row').findAll((node) => node.type === PillButton).map((node) => node.props.fullWidth)).toEqual([true, true]);
    }
  });
});

describe('Preview, tablet (TabletGeneratorPreview board)', () => {
  beforeEach(() => {
    mockWindow = { ...TABLET };
  });

  it('no back icon; eyebrow muted; plan name 60/60; the split card with "Split" + name and a raised select', async () => {
    const tree = await openPreview();
    expect(has(tree, 'generator-preview-top-row')).toBe(false);
    expect(flat(host(tree, 'generator-preview-eyebrow')).color).toBe(colors.textMuted);
    expect(flat(host(tree, 'generator-plan-name'))).toMatchObject({ fontSize: 60, lineHeight: 60 });
    const card = host(tree, 'generator-split-card');
    expect(flat(card)).toMatchObject({ borderRadius: 24, flexDirection: 'row' });
    expect(card.findAll((node) => node.type === Text && node.props.children === 'Split')).toHaveLength(1);
    expect(one(tree, 'generator-split').props.variant).toBe('raised');
  });

  it('rows: 120 × 92 photos, plain "~55 min", muscle label 13, tablet Why line outside the link; the 52 bar row right-aligned', async () => {
    const tree = await openPreview();
    const photos = tree.root.findAll((node) => node.type === ExerciseImage);
    expect(photos.map((node) => [flat(node).width, flat(node).height])).toEqual([
      [120, 92],
      [120, 92],
    ]);
    expect(flat(host(tree, 'generator-day-minutes'))).toMatchObject({ fontSize: 14, color: colors.textMuted });
    expect(has(tree, 'generator-featured-row')).toBe(false);
    const buttons = host(tree, 'generator-sticky-row').findAll((node) => node.type === PillButton);
    expect(buttons.map((node) => node.props.size)).toEqual(['default', 'default']);
    // UX R2-6 (web round 2): gap 10 at every width (was 12 on tablet).
    expect(flat(host(tree, 'generator-sticky-row'))).toMatchObject({ justifyContent: 'flex-end', gap: 10 });
  });
});

describe('Pure helpers', () => {
  // DECLARED (UX native final audit 27 Oct 2026, ruling 1, B237): step 6 was 'flow'; it is 'pinned' now.
  it('stepBarPlacement: pinned on phone steps 1–6 at ≤1.3× only', () => {
    expect(stepBarPlacement({ step: 1, tablet: false, reflow: false })).toBe('pinned');
    expect(stepBarPlacement({ step: 5, tablet: false, reflow: false })).toBe('pinned');
    expect(stepBarPlacement({ step: 6, tablet: false, reflow: false })).toBe('pinned');
    expect(stepBarPlacement({ step: 2, tablet: true, reflow: false })).toBe('flow');
    expect(stepBarPlacement({ step: 2, tablet: false, reflow: true })).toBe('flow');
  });

  it('imageUrlOf: thumbnail/image url; a non-image media_type or no url → null', () => {
    const { imageUrlOf } = require('./generatorLogic');
    expect(imageUrlOf({ thumbnail: { url: 'a.jpg' } })).toBe('a.jpg');
    expect(imageUrlOf({ thumbnail: { url: 'a.jpg', media_type: 'image/jpeg' } })).toBe('a.jpg');
    expect(imageUrlOf({ thumbnail: { url: 'a.mp4', media_type: 'video/mp4' } })).toBeNull();
    expect(imageUrlOf({ image: 'b.png' })).toBe('b.png');
    expect(imageUrlOf({ thumbnail: null })).toBeNull();
    expect(imageUrlOf(undefined)).toBeNull();
  });

  it('rememberExercises keeps every loaded item by id (newest wins), ignores items without an id', () => {
    const { rememberExercises } = require('./generatorLogic');
    const known = rememberExercises({ 1: { id: 1, name: 'Old' } }, [{ id: 1, name: 'New' }, { id: 2, name: 'B' }, { name: 'x' }, null]);
    expect(known).toEqual({ 1: { id: 1, name: 'New' }, 2: { id: 2, name: 'B' } });
  });

  it('reviewDetails splits the §G1.3 summaries for layout (same words, same order)', () => {
    const { answersFromProfile, reviewDetails } = require('./generatorLogic');
    const details = reviewDetails(answersFromProfile(PROFILE), OPTIONS);
    expect(details).toMatchObject({
      goal: 'Build muscle',
      band: '2+ years',
      days: '4',
      minutes: '60',
      preset: 'Full gym',
      equipment: ['Bodyweight', 'Barbell'],
      focus: { label: 'Focus:', text: 'Chest' },
      goEasy: { label: 'Go easy on:', text: 'Knees' },
      avoid: { label: 'Avoid:', text: 'Burpee' },
      firstAvoided: { id: 9, name: 'Burpee' },
    });
    const none = reviewDetails(answersFromProfile({ ...PROFILE, focus_muscles: [], exclusions: [], go_easy_area_ids: [] }), { ...OPTIONS, go_easy_areas: [] });
    expect(none).toMatchObject({ focus: { label: null, text: 'No focus' }, goEasy: null, avoid: { label: null, text: 'Nothing to avoid' }, firstAvoided: null });
  });

  it('copy: radio group names, the step fraction, the row label', () => {
    const { RADIO_GROUP_LABELS, stepFraction, exerciseRowLabel, COPY } = require('./generatorCopy');
    expect(Object.values(RADIO_GROUP_LABELS)).toEqual(['Main goal', 'Lifting experience', 'Days a week', 'Session length', 'Where you train']);
    expect(stepFraction(3)).toBe('3/6');
    expect(exerciseRowLabel('Row', undefined, '3 sets')).toBe('Row, 3 sets');
    expect(COPY.backToAnswers).toBe('Back to your answers');
  });
});

// Review 26fc4a8 M1: "Back to your answers" opens the questionnaire FRESH (as
// web navigates to /plans/generate, which remounts and refetches), never the
// stale instance below, so the next "See my plan" keeps the split change.
describe('review fix M1: Back to your answers after Change split', () => {
  it('back pushes a fresh questionnaire (no goBack to the stale one)', async () => {
    const tree = await openPreview();
    await act(async () => one(tree, 'generator-preview-back').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanGenerator');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('Change split → back → See my plan PUTs the NEW split (the fresh questionnaire refetches)', async () => {
    let saved = { ...PROFILE, preferred_split: 'UL' };
    getGeneratorProfile.mockImplementation(() => Promise.resolve({ available: true, profile: saved, options: OPTIONS }));
    saveGeneratorProfile.mockImplementation((body) => {
      saved = { ...saved, preferred_split: body.preferred_split };
      return Promise.resolve({});
    });
    const preview = await openPreview();
    await act(async () => one(preview, 'generator-split').props.onChange('FB'));
    expect(saveGeneratorProfile).toHaveBeenLastCalledWith(expect.objectContaining({ preferred_split: 'FB' }));
    await act(async () => one(preview, 'generator-preview-back').props.onPress());
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    // The pushed screen is a new questionnaire instance: it loads the profile now.
    mockParams = { step: 5 };
    const answers = await render(<PlanGeneratorScreen />);
    await press(answers, 'generator-next');
    await press(answers, 'generator-see-plan');
    expect(saveGeneratorProfile).toHaveBeenLastCalledWith(expect.objectContaining({ preferred_split: 'FB' }));
  });
});

// Review 26fc4a8 M4 / M5 (RN-SPEC-v2-phase4 dated change 27 Oct, image
// fallback chain): the generator's photos use the v2 chain; a video is no image.
describe('review fix M4/M5: generator images', () => {
  const ID = 'G1d';
  const UC = `https://drive.google.com/uc?export=download&id=${ID}`;
  const tail = [`https://drive.google.com/thumbnail?id=${ID}&sz=w1600`, `https://lh3.googleusercontent.com/d/${ID}=w1600`, `https://lh3.googleusercontent.com/d/${ID}=s1600`];
  const withThumb = (thumbnail) => ({
    ...FEASIBLE,
    days: [{ ...FEASIBLE.days[0], exercises: FEASIBLE.days[0].exercises.map((row) => ({ ...row, exercise: { ...row.exercise, thumbnail } })) }],
  });

  it.each([
    ['phone', PHONE],
    ['tablet', TABLET],
  ])('%s preview rows: a uc link is never tried (its id drives the chain)', async (_, window) => {
    mockWindow = { ...window };
    const tree = await openPreview(withThumb({ url: UC, media_type: 'image' }));
    const photos = tree.root.findAllByType(ExerciseImage);
    expect(photos.length).toBeGreaterThan(0);
    photos.forEach((photo) => {
      expect(photo.props.sources.some((url) => /\/uc\?/.test(url))).toBe(false);
      expect(photo.props.sources.slice(-3)).toEqual(tail);
    });
  });

  it('a uc link with no id or a video → the tile (url null, nothing loaded)', async () => {
    for (const thumbnail of [{ url: 'https://drive.google.com/uc?export=view' }, { url: 'https://x.test/a.mp4', media_type: 'video' }]) {
      const tree = await openPreview(withThumb(thumbnail));
      tree.root.findAllByType(ExerciseImage).forEach((photo) => expect(photo.props.url).toBeNull());
    }
  });
});

describe('review fix M4: avoid photos use the v2 chain', () => {
  it('search result, avoid row and review row-6 photos: the w400 thumbnail first, never the uc link', async () => {
    const ID = 'Av0';
    const chain = [
      `https://drive.google.com/thumbnail?id=${ID}&sz=w400`,
      `https://drive.google.com/thumbnail?id=${ID}&sz=w1600`,
      `https://lh3.googleusercontent.com/d/${ID}=w1600`,
      `https://lh3.googleusercontent.com/d/${ID}=s1600`,
    ];
    searchExercises.mockResolvedValue([{ id: 12, name: 'Deadlift', thumbnail: { url: `https://drive.google.com/uc?export=view&id=${ID}` } }]);
    const tree = await openStep(6, { profile: { ...PROFILE, exclusions: [] } });
    await act(async () => one(tree, 'generator-avoid-search').props.onChangeText('dead'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const photoOf = (id) => tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === id)[0];
    expect(photoOf('generator-avoid-result-photo-12').props.sources).toEqual(chain);
    await press(tree, 'generator-avoid-result-12');
    expect(photoOf('generator-avoid-photo-12').props.sources).toEqual(chain);
    await press(tree, 'generator-next');
    expect(host(tree, 'generator-review-avoid-photo').findByType(ExerciseImage).props.sources).toEqual(chain);
  });
});

// UX native final audit 27 Oct 2026, ruling 1 (+ GENERATOR-FADE): every pinned
// generator footer sits in the ONE shared dock (PinnedDock): a 32 fade (clear
// ground → ground), then solid ground to the screen edge, the lowest button 12
// above the tab bar's top on a phone (86 + 12, insets 0 here), and the page's
// scroll room = the dock's measured height. Rows B236, B237, B242, B245.
describe('Generator pinned dock (UX native final audit 27 Oct 2026, ruling 1)', () => {
  const { default: PinnedDock } = require('../../shared/components/PinnedDock');
  const expectDock = (tree, id) => {
    const dock = tree.root.find((node) => node.type === PinnedDock && node.props.testID === id);
    expect(flat(host(tree, id))).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0 });
    const fade = host(tree, `${id}-fade`);
    expect(flat(fade).height).toBe(32);
    expect(fade.findByType(GradientFill).props.colors).toEqual(['rgba(10, 11, 15, 0)', '#0A0B0F']);
    expect(fade.findByType(GradientFill).props.stops).toEqual([0, 1]);
    expect(flat(host(tree, `${id}-body`))).toMatchObject({ backgroundColor: colors.ground, paddingBottom: 86 + 12 });
    return dock;
  };
  const expectRoom = async (tree, id) => {
    await act(async () => host(tree, id).props.onLayout({ nativeEvent: { layout: { height: 214 } } }));
    expect(host(tree, 'shell-page').props.dockHeight).toBe(214);
  };

  it('B236: steps 1–5 Back/Next sit in the dock (fade 32, solid, 12 above the tab bar), scroll room = dock height', async () => {
    const tree = await openStep(2);
    const dock = expectDock(tree, 'generator-step-bar');
    expect(dock.findAll((node) => node.props.testID === 'generator-next').length).toBeGreaterThan(0);
    expect(dock.findAll((node) => node.props.testID === 'generator-back').length).toBeGreaterThan(0);
    await expectRoom(tree, 'generator-step-bar');
  });

  it('B237: step 6 Back/Next is pinned in the same dock (not in the flow under the tab bar)', async () => {
    const tree = await openStep(6);
    const dock = expectDock(tree, 'generator-step-bar');
    expect(dock.findAll((node) => node.props.testID === 'generator-next').length).toBeGreaterThan(0);
    await expectRoom(tree, 'generator-step-bar');
  });

  it('B242: the Review’s Back / See my plan sit in the dock, scroll room = dock height', async () => {
    const tree = await openReview();
    const dock = expectDock(tree, 'generator-review-bar');
    expect(dock.findAll((node) => node.props.testID === 'generator-see-plan').length).toBeGreaterThan(0);
    expect(dock.findAll((node) => node.props.testID === 'generator-back').length).toBeGreaterThan(0);
    await expectRoom(tree, 'generator-review-bar');
  });

  it('B245: the preview Start / Change pair sits in the dock (fade, solid to the edge), scroll room = dock height', async () => {
    const tree = await openPreview();
    const dock = expectDock(tree, 'generator-sticky-bar');
    expect(dock.findAll((node) => node.props.testID === 'generator-start').length).toBeGreaterThan(0);
    await expectRoom(tree, 'generator-sticky-bar');
  });

  it('below 21rem (320) the steps pair stacks: gold Next (52) over glass Back (52), full width', async () => {
    mockWindow = { ...PHONE, width: 320 };
    const tree = await openStep(2);
    const buttons = one(tree, 'generator-buttons').findAll((node) => node.type === PillButton);
    expect(buttons.map((node) => [node.props.testID, node.props.size, node.props.fullWidth])).toEqual([
      ['generator-next', 'default', true],
      ['generator-back', 'default', true],
    ]);
    expect(flat(host(tree, 'generator-buttons'))).toMatchObject({ flexDirection: 'column', gap: 10 });
  });

  it('tablet: the steps and the review stay in the flow (no dock); the preview dock keeps its 16 above the safe area', async () => {
    mockWindow = { ...TABLET };
    expect(has(await openStep(2), 'generator-step-bar')).toBe(false);
    expect(has(await openReview(), 'generator-review-bar')).toBe(false);
    const preview = await openPreview();
    expect(flat(host(preview, 'generator-sticky-bar-body')).paddingBottom).toBe(16);
  });

  it('large text (2×): no dock anywhere (§9 addendum un-pins it), the pairs scroll with the page', async () => {
    mockWindow = { ...PHONE, fontScale: 2 };
    expect(has(await openStep(2), 'generator-step-bar')).toBe(false);
    expect(has(await openReview(), 'generator-review-bar')).toBe(false);
    expect(has(await openPreview(), 'generator-sticky-bar-fade')).toBe(false);
  });
});

// T-65 (PHONE-NAV spec §3 + the PM correction, 27 Oct 2026): no extra
// "‹ Plans" pill on the generator; step 1's ✕ Cancel (top row and dock) is
// the page's one back control: back in history, else REPLACE to Plans.
describe('T-65 generator exit (step 1 ✕ Cancel)', () => {
  afterEach(() => {
    mockNavigation.canGoBack.mockImplementation(() => true);
    delete mockNavigation.getState;
  });

  it('no back pill is added; the ✕ goes back with history and REPLACES to Plans with none', async () => {
    mockNavigation.getState = jest.fn(() => ({ routeNames: ['PlansLibrary', 'MyPlans', 'PlanGenerator'] }));
    const tree = await openStep(1);
    expect(tree.root.findAll((node) => node.type === BackPill)).toHaveLength(0);
    const close = tree.root.find((node) => node.type === IconButton);
    mockNavigation.goBack.mockClear();
    await act(async () => close.props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    mockNavigation.canGoBack.mockImplementation(() => false);
    await act(async () => close.props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith('PlansLibrary');
  });

  it('the dock Cancel is the same exit', async () => {
    mockNavigation.getState = jest.fn(() => ({ routeNames: ['PlansLibrary', 'PlanGenerator'] }));
    mockNavigation.canGoBack.mockImplementation(() => false);
    const tree = await openStep(1);
    const cancel = tree.root.findAll((node) => node.props.testID === 'generator-cancel' && typeof node.props.onPress === 'function')[0];
    await act(async () => cancel.props.onPress());
    expect(mockNavigation.replace).toHaveBeenCalledWith('PlansLibrary');
  });
});

// G1 (final pass 5f53f3d, PM + UX 28 Oct 2026): "Back to your answers" pushes
// a fresh questionnaire ABOVE the preview; going back from it would land on
// the preview and loop (no tab bar on phone). Above the preview, Cancel and
// Android back reset the Plans stack to Plans alone; the preview's top back
// does the same with no screen below or a looping questionnaire below.
describe('G1 generator exit above the preview (no step ↔ preview loop)', () => {
  let stack;
  let backHandlers;
  let backSpy;
  beforeEach(() => {
    stack = ['PlansLibrary', 'PlanGenerator', 'PlanGeneratorPreview'];
    backHandlers = [];
    backSpy = jest.spyOn(ReactNative.BackHandler, 'addEventListener').mockImplementation((name, handler) => {
      backHandlers.push(handler);
      return { remove: () => (backHandlers = backHandlers.filter((item) => item !== handler)) };
    });
    mockNavigation.getState = jest.fn(() => ({ index: stack.length - 1, routes: stack.map((name) => ({ name })) }));
    mockNavigation.canGoBack.mockImplementation(() => stack.length > 1);
    mockNavigation.push.mockImplementation((name) => (stack = [...stack, name]));
    mockNavigation.goBack.mockImplementation(() => (stack = stack.slice(0, -1)));
    mockNavigation.reset = jest.fn(({ routes }) => (stack = routes.map((route) => route.name)));
  });
  afterEach(() => {
    backSpy.mockRestore();
    mockNavigation.canGoBack.mockImplementation(() => true);
    mockNavigation.push.mockImplementation(() => {});
    mockNavigation.goBack.mockImplementation(() => {});
    delete mockNavigation.getState;
    delete mockNavigation.reset;
  });

  const cancelOf = (tree) =>
    tree.root.findAll((node) => node.props.testID === 'generator-cancel' && typeof node.props.onPress === 'function')[0];
  const ONLY_PLANS = { index: 0, routes: [{ name: 'PlansLibrary' }] };

  it('preview → Back to your answers → Cancel lands on Plans; back from Plans never returns to the generator', async () => {
    const preview = await openPreview();
    await act(async () => one(preview, 'generator-preview-back').props.onPress());
    expect(stack).toEqual(['PlansLibrary', 'PlanGenerator', 'PlanGeneratorPreview', 'PlanGenerator']);
    const answers = await openStep(1);
    await act(async () => cancelOf(answers).props.onPress());
    expect(mockNavigation.reset).toHaveBeenCalledWith(ONLY_PLANS);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(stack).toEqual(['PlansLibrary']);
    expect(mockNavigation.canGoBack()).toBe(false);
  });

  it('the step 1 ✕ and Android back on a later step leave the same way above the preview', async () => {
    stack = [...stack, 'PlanGenerator'];
    const answers = await openStep(1);
    const close = answers.root.find((node) => node.type === IconButton);
    await act(async () => close.props.onPress());
    expect(stack).toEqual(['PlansLibrary']);
    act(() => answers.unmount());
    mounted.splice(mounted.indexOf(answers), 1);
    stack = ['PlansLibrary', 'PlanGenerator', 'PlanGeneratorPreview', 'PlanGenerator'];
    await openStep(3);
    expect(backHandlers).toHaveLength(1);
    let handled;
    act(() => {
      handled = backHandlers[0]();
    });
    expect(handled).toBe(true);
    expect(stack).toEqual(['PlansLibrary']);
  });

  it('opened from Plans (no preview below), Cancel keeps the T-65 exit and Android back keeps its default pop', async () => {
    stack = ['PlansLibrary', 'PlanGenerator'];
    const answers = await openStep(1);
    expect(backHandlers.map((handler) => handler())).toEqual([false]);
    await act(async () => cancelOf(answers).props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('the preview top back stays "Back to your answers" (a push) above a first questionnaire', async () => {
    const preview = await openPreview();
    expect(backHandlers).toHaveLength(0);
    await act(async () => one(preview, 'generator-preview-back').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanGenerator');
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('the preview top back and Android back leave to Plans above a looping questionnaire', async () => {
    stack = ['PlansLibrary', 'PlanGenerator', 'PlanGeneratorPreview', 'PlanGenerator', 'PlanGeneratorPreview'];
    const preview = await openPreview();
    expect(backHandlers).toHaveLength(1);
    await act(async () => one(preview, 'generator-preview-back').props.onPress());
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ONLY_PLANS);
    expect(stack).toEqual(['PlansLibrary']);
  });

  it('the preview top back and Android back leave to Plans with no screen below', async () => {
    stack = ['PlanGeneratorPreview'];
    const preview = await openPreview();
    let handled;
    act(() => {
      handled = backHandlers[0]();
    });
    expect(handled).toBe(true);
    expect(stack).toEqual(['PlansLibrary']);
    stack = ['PlanGeneratorPreview'];
    await act(async () => one(preview, 'generator-preview-back').props.onPress());
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(stack).toEqual(['PlansLibrary']);
  });

  // Reviewer carry (native-final-pass-f85daeb, 1): canGoBack() is TRUE (tab
  // history) while the preview is alone in its stack: the getState "no
  // screen below" branch still leaves to Plans.
  it('canGoBack true (tab history) with the preview alone in the stack → the top back and Android back leave to Plans', async () => {
    stack = ['PlanGeneratorPreview'];
    mockNavigation.canGoBack.mockImplementation(() => true);
    const preview = await openPreview();
    expect(backHandlers).toHaveLength(1);
    await act(async () => one(preview, 'generator-preview-back').props.onPress());
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(mockNavigation.reset).toHaveBeenCalledWith(ONLY_PLANS);
    expect(stack).toEqual(['PlansLibrary']);
    stack = ['PlanGeneratorPreview'];
    let handled;
    act(() => {
      handled = backHandlers[0]();
    });
    expect(handled).toBe(true);
    expect(mockNavigation.reset).toHaveBeenCalledTimes(2);
    expect(stack).toEqual(['PlansLibrary']);
  });

  // T-74 carry: a top back that LEAVES reads "Plans" (the labelled back
  // pill), never the icon named "Back to your answers".
  it.each([
    ['no screen below', ['PlanGeneratorPreview']],
    ['a looping questionnaire below', ['PlansLibrary', 'PlanGenerator', 'PlanGeneratorPreview', 'PlanGenerator', 'PlanGeneratorPreview']],
  ])('leaving (%s): the top back is the "‹ Plans" pill, no "Back to your answers" icon', async (_label, below) => {
    stack = below;
    const preview = await openPreview();
    const pill = preview.root.findByType(BackPill);
    expect(pill.props).toMatchObject({ testID: 'generator-preview-back', label: 'Plans' });
    const link = host(preview, 'generator-preview-back');
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityLabel).toBe('Plans');
    expect(preview.root.findAll((node) => node.type === IconButton && node.props.testID === 'generator-preview-back')).toHaveLength(0);
    expect(preview.root.findAll((node) => node.props.accessibilityLabel === 'Back to your answers')).toHaveLength(0);
  });

  it('not leaving (a first questionnaire below): the top back stays the icon "Back to your answers", no Plans pill', async () => {
    const preview = await openPreview();
    const back = preview.root.find((node) => node.type === IconButton && node.props.testID === 'generator-preview-back');
    expect(back.props.accessibilityLabel).toBe('Back to your answers');
    expect(preview.root.findAll((node) => node.type === BackPill && node.props.testID === 'generator-preview-back')).toHaveLength(0);
  });
});
