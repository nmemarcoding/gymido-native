import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { getGeneratorProfile, previewGeneratedPlan, saveGeneratorProfile } from './api/generatorApi';
import PlanGeneratorPreviewScreen from './screens/PlanGeneratorPreviewScreen';
import PlanGeneratorScreen from './screens/PlanGeneratorScreen';

// T-18 go-easy areas on the G1/G2 screens (RN-SPEC-PLAN-GENERATOR, dated
// change 25 Oct 2026; T-40 named groups).

const mockNavigation = { push: jest.fn(), replace: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockParams = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'PlanGenerator-1', name: 'PlanGenerator', params: mockParams }),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('./generatorRoutes', () => ({
  generatorRoutes: { PlanGenerator: 'PlanGenerator', PlanGeneratorPreview: 'PlanGeneratorPreview' },
}));
jest.mock('./useTabBarClearance', () => ({ useTabBarClearance: () => 0 }));
jest.mock('../../shared/components/BlurLayer', () => () => null);
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

const AREAS = [
  { id: 1, code: 'KNEES', name: 'Knees', focus_muscle_ids: [21] },
  { id: 2, code: 'LOWER_BACK', name: 'Lower back', focus_muscle_ids: [23] },
  { id: 3, code: 'SHOULDERS', name: '', focus_muscle_ids: [24] },
];
const BASE_OPTIONS = {
  goals: ['BUILD_MUSCLE'],
  experience_bands: ['2_PLUS_YEARS'],
  days_per_week: [3, 4],
  session_minutes: [45, 60],
  presets: [{ code: 'FULL_GYM', enabled: true, equipment: [{ id: 3 }] }],
  equipment: [{ id: 3, name: 'Barbell' }],
  focus_muscles: [
    { id: 21, name: 'Quads' },
    { id: 23, name: 'Lower back' },
    { id: 24, name: 'Shoulders' },
  ],
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
  exclusions: [],
  go_easy_area_ids: [],
};

const httpError = (status, data = {}) => ({ isAxiosError: true, response: { status, data } });
const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string');
const one = (tree, id) => byTestId(tree, id)[0];
const has = (tree, id) => byTestId(tree, id).length > 0;
// The hint's Text (BlockHint carries the same testID).
const hintText = (tree, id) => byTestId(tree, id).find((node) => typeof node.props.children === 'string')?.props.children;
const hasHint = (tree, id) => hintText(tree, id) !== undefined;

async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

async function press(tree, id) {
  await act(async () => {
    one(tree, id).props.onPress();
  });
}

async function flushFocus() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

function mockProfile({ options = {}, profile = {} } = {}) {
  getGeneratorProfile.mockResolvedValue({
    available: true,
    profile: { ...PROFILE, ...profile },
    options: { ...BASE_OPTIONS, ...options },
  });
}

// Opens step 6 through the T-18 deep link (step: 5).
async function renderStep6(setup) {
  mockProfile(setup);
  mockParams = { step: 5 };
  return render(<PlanGeneratorScreen />);
}

// The module object itself (an `import *` namespace is a copy), so spies
// on its getters reach the screens.
const ReactNative = require('react-native');

const { AccessibilityInfo, Platform } = ReactNative;
let focusSpy;
let announceSpy;
let handleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockParams = {};
  focusSpy = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  // The test renderer has no native views; give refs a handle.
  handleSpy = jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue((ref) => (ref ? 7 : null));
});

afterEach(() => {
  jest.useRealTimers();
  focusSpy.mockRestore();
  announceSpy.mockRestore();
  handleSpy.mockRestore();
});

describe('T-18 G1.2 step 6 go-easy section', () => {
  it('section hidden with no areas: step 6 exactly as before, Skip, no hints', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: [], go_easy_notice: 'Ignored.' } });
    const shown = texts(tree);
    expect(shown).toContain('Anything to focus on or avoid?');
    expect(shown).not.toContain('Anything to go easy on?');
    expect(has(tree, 'generator-go-easy')).toBe(false);
    expect(hasHint(tree, 'generator-focus-block-hint')).toBe(false);
    expect(one(tree, 'generator-next').props.title).toBe('Skip');
  });

  it('step 6 sections are 24 apart, areas or not (§G1.2, FE ac21d959)', async () => {
    const gap = (tree) => StyleSheet.flatten(tree.root.find((node) => node.props.testID === 'generator-step6' && typeof node.type === 'string').props.style).gap;
    expect(gap(await renderStep6({ options: { go_easy_areas: [] } }))).toBe(24);
    expect(gap(await renderStep6({ options: { go_easy_areas: AREAS } }))).toBe(24);
  });

  it('shows label, the server notice and one pill per area in server order (name, else humanizeCode)', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: 'Tell us what hurts.' } });
    const shown = texts(tree);
    expect(shown).toContain('Anything to go easy on?');
    expect(shown).toContain('Tell us what hurts.');
    const pills = tree.root.findAll(
      (node) => typeof node.props.testID === 'string' && /^generator-go-easy-\d+$/.test(node.props.testID) && node.props.label !== undefined
    );
    expect(pills.map((pill) => pill.props.label)).toEqual(['Knees', 'Lower back', 'Shoulders']);
    // Sections in order: Focus muscles → go-easy → Exercises to avoid.
    const order = ['Focus muscles', 'Anything to go easy on?', 'Exercises to avoid'].map((label) => shown.indexOf(label));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('notice fallback when go_easy_notice is ""', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    expect(texts(tree)).toContain("We'll avoid exercises that put heavy load on the areas you pick.");
  });

  it('native a11y: go-easy pills are togglebuttons with {selected, disabled}; T-40 hints = section labels', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    const pressable = (id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
    const area = pressable('generator-go-easy-1');
    expect(area.props.accessibilityRole).toBe('togglebutton');
    expect(area.props.accessibilityState).toEqual({ selected: false, disabled: false });
    expect(area.props.accessibilityHint).toBe('Anything to go easy on?');
    expect(pressable('generator-focus-21').props.accessibilityHint).toBe('Focus muscles');
    expect(pressable('generator-avoid-search').props.accessibilityLabel).toBe('Search exercises to avoid');
  });

  it('pair block from go-easy: a selected area disables its Focus pill, with the one-area hint; unpicking re-enables', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    await press(tree, 'generator-go-easy-2');
    expect(one(tree, 'generator-go-easy-2').props.selected).toBe(true);
    expect(one(tree, 'generator-focus-23').props.disabled).toBe(true);
    expect(one(tree, 'generator-focus-21').props.disabled).toBe(false);
    const hint = "You're going easy on your lower back, so it can't be a focus.";
    expect(hintText(tree, 'generator-focus-block-hint')).toBe(hint);
    // The blocked pill's description references the hint.
    expect(one(tree, 'generator-focus-23').props.accessibilityHint).toBe(`Focus muscles. ${hint}`);
    expect(one(tree, 'generator-focus-21').props.accessibilityHint).toBe('Focus muscles');
    await press(tree, 'generator-go-easy-2');
    expect(one(tree, 'generator-focus-23').props.disabled).toBe(false);
    expect(hasHint(tree, 'generator-focus-block-hint')).toBe(false);
  });

  it('pair block from Focus: a selected focus muscle disables its areas, with the several-areas hint', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    await press(tree, 'generator-focus-24');
    await press(tree, 'generator-focus-21');
    expect(one(tree, 'generator-go-easy-1').props.disabled).toBe(true);
    expect(one(tree, 'generator-go-easy-3').props.disabled).toBe(true);
    expect(one(tree, 'generator-go-easy-2').props.disabled).toBe(false);
    const hint = 'Knees and shoulders are your focus muscles. Remove them there to go easy on them.';
    expect(hintText(tree, 'generator-go-easy-block-hint')).toBe(hint);
    expect(one(tree, 'generator-go-easy-1').props.accessibilityHint).toBe(`Anything to go easy on?. ${hint}`);
    // The cap (max 2) disables Lower back with no hint under Focus.
    expect(one(tree, 'generator-focus-23').props.disabled).toBe(true);
    expect(hasHint(tree, 'generator-focus-block-hint')).toBe(false);
  });

  it('pair block one-area go-easy hint', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    await press(tree, 'generator-focus-21');
    expect(hintText(tree, 'generator-go-easy-block-hint')).toBe(
      'Knees is one of your focus muscles. Remove it there to go easy on it.'
    );
  });

  it('hints are a polite live region; iOS announces on change', async () => {
    const os = Platform.OS;
    Platform.OS = 'ios';
    try {
      const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
      expect(
        tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite').length
      ).toBeGreaterThanOrEqual(2);
      await press(tree, 'generator-go-easy-1');
      expect(announceSpy).toHaveBeenCalledWith("You're going easy on your knees, so it can't be a focus.");
    } finally {
      Platform.OS = os;
    }
  });

  it('Skip only when focus, go-easy and avoid are all empty', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    expect(one(tree, 'generator-next').props.title).toBe('Skip');
    await press(tree, 'generator-go-easy-1');
    expect(one(tree, 'generator-next').props.title).toBe('Next');
  });
});

describe('T-18 deep link (route param step)', () => {
  it('step 5 opens step 6 after the load and moves focus to its heading', async () => {
    const tree = await renderStep6({ options: { go_easy_areas: AREAS } });
    expect(texts(tree)).toContain('Step 6 of 6');
    expect(focusSpy).not.toHaveBeenCalled();
    await flushFocus();
    expect(focusSpy).toHaveBeenCalledWith(7);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('step 4 opens step 5', async () => {
    mockProfile();
    mockParams = { step: 4 };
    const tree = await render(<PlanGeneratorScreen />);
    expect(texts(tree)).toContain('Where do you train?');
  });

  it('anything else → step 1 as before, no focus move', async () => {
    mockProfile();
    mockParams = { step: '5' };
    const tree = await render(<PlanGeneratorScreen />);
    expect(texts(tree)).toContain("What's your main goal?");
    await flushFocus();
    expect(focusSpy).not.toHaveBeenCalled();
  });
});

const rowSixLabel = (tree) =>
  tree.root
    .find((node) => node.props.testID === 'generator-review-6' && typeof node.type === 'string')
    .findAll((node) => typeof node.props.accessibilityLabel === 'string')
    .map((node) => node.props.accessibilityLabel)
    .join('\n');

describe('T-18 G1.3 review and G1.4 / G1.5 save', () => {
  async function toReview(setup) {
    const tree = await renderStep6(setup);
    return tree;
  }

  it('review row 6 has the go-easy part; PUT always sends the filtered ids', async () => {
    const tree = await toReview({ options: { go_easy_areas: AREAS, go_easy_notice: '' }, profile: { go_easy_area_ids: [99] } });
    await press(tree, 'generator-go-easy-1');
    await press(tree, 'generator-next');
    // v2 J: the card splits the summary into lines; readers get the one string.
    expect(rowSixLabel(tree)).toContain('No focus · Go easy on: Knees · Nothing to avoid');
    // Review LOW: the VISIBLE go-easy line also drops the stale id (only Knees).
    const goEasyLine = tree.root.find((node) => node.props.testID === 'generator-review-go-easy' && typeof node.type === 'string');
    expect(texts({ root: goEasyLine }).filter(Boolean).sort()).toEqual(['Go easy on: ', 'Knees']);
    saveGeneratorProfile.mockResolvedValue({});
    await press(tree, 'generator-see-plan');
    // The stale id 99 is dropped.
    expect(saveGeneratorProfile.mock.calls[0][0].go_easy_area_ids).toEqual([1]);
  });

  it('PUT omits go_easy_area_ids when no areas are offered', async () => {
    const tree = await toReview({ options: { go_easy_areas: [] }, profile: { go_easy_area_ids: [1] } });
    await press(tree, 'generator-next');
    expect(rowSixLabel(tree)).toContain('No focus · Nothing to avoid');
    saveGeneratorProfile.mockResolvedValue({});
    await press(tree, 'generator-see-plan');
    expect(saveGeneratorProfile.mock.calls[0][0]).not.toHaveProperty('go_easy_area_ids');
  });

  it('422 errors.go_easy_area_ids → review row 6 and the step-6 error', async () => {
    const tree = await toReview({ options: { go_easy_areas: AREAS, go_easy_notice: '' } });
    await press(tree, 'generator-next');
    saveGeneratorProfile.mockRejectedValue(
      httpError(422, { message: 'Invalid.', errors: { go_easy_area_ids: ['Pick areas that are not focus muscles.'] } })
    );
    await press(tree, 'generator-see-plan');
    expect(texts(tree)).toContain('Pick areas that are not focus muscles.');
    await press(tree, 'generator-review-change-6');
    expect(has(tree, 'generator-step-error')).toBe(true);
    expect(one(tree, 'generator-step-error').props.title).toBe('Please check this answer');
    expect(one(tree, 'generator-step-error').props.message).toBe('Pick areas that are not focus muscles.');
  });
});

describe('T-18 G2 preview', () => {
  const REFUSAL = {
    feasible: false,
    reason: {
      code: 'GO_EASY_TOO_RESTRICTIVE',
      message: 'Too few exercises fit.',
      what_to_change: 'Go easy on fewer areas.',
    },
  };

  it('G2.1: a 422 errors.go_easy_area_ids replaces the preview with step 6 (step: 5); no error screen', async () => {
    previewGeneratedPlan.mockRejectedValue(httpError(422, { errors: { go_easy_area_ids: ['GO_EASY_FOCUS_CONFLICT'] } }));
    const tree = await render(<PlanGeneratorPreviewScreen />);
    // PM parity (26 Oct): the field error goes along to be shown and focused.
    expect(mockNavigation.replace).toHaveBeenCalledWith('PlanGenerator', { step: 5, stepErrors: { 6: 'GO_EASY_FOCUS_CONFLICT' } });
    expect(texts(tree)).not.toContain('Could not build your plan');
    expect(texts(tree)).not.toContain('Retry');
  });

  it('G2.1: a 422 errors.profile still replaces with the questionnaire, no step', async () => {
    previewGeneratedPlan.mockRejectedValue(httpError(422, { errors: { profile: ['Missing.'] } }));
    await render(<PlanGeneratorPreviewScreen />);
    expect(mockNavigation.replace).toHaveBeenCalledWith('PlanGenerator');
  });

  it('G2.2: the GO_EASY_AREAS note gets role="note"; GO_EASY_REDUCED is an ordinary info note', async () => {
    previewGeneratedPlan.mockResolvedValue({
      feasible: true,
      plan_name: 'Plan',
      notes: [
        { code: 'GO_EASY_AREAS', text: 'Going easy on your knees.' },
        { code: 'GO_EASY_REDUCED', text: 'Fewer sets.' },
      ],
      days: [],
    });
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(one(tree, 'generator-note-0').props.role).toBe('note');
    expect(one(tree, 'generator-note-1').props.role).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Going easy on your knees.', 'Fewer sets.']));
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('G2.3: GO_EASY_TOO_RESTRICTIVE with equipment_fix → both buttons and deep links; focus moves to the title', async () => {
    previewGeneratedPlan.mockResolvedValue({ ...REFUSAL, reason: { ...REFUSAL.reason, equipment_fix: true } });
    const tree = await render(<PlanGeneratorPreviewScreen />);
    const shown = texts(tree);
    expect(shown).toEqual(
      expect.arrayContaining(["We couldn't build a plan with these answers", 'Too few exercises fit.', 'Go easy on fewer areas.'])
    );
    expect(has(tree, 'generator-change-answers')).toBe(false);
    await press(tree, 'generator-edit-go-easy');
    expect(mockNavigation.push).toHaveBeenLastCalledWith('PlanGenerator', { step: 5 });
    await press(tree, 'generator-change-equipment');
    expect(mockNavigation.push).toHaveBeenLastCalledWith('PlanGenerator', { step: 4 });
    await flushFocus();
    expect(focusSpy).toHaveBeenCalledWith(7);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  const actionButtons = (tree) =>
    one(tree, 'generator-go-easy-actions').findAll((node) => node.props.title !== undefined && node.props.testID !== undefined);

  function atWidth(width) {
    return jest
      .spyOn(ReactNative, 'useWindowDimensions', 'get')
      .mockReturnValue(() => ({ width, height: 800, scale: 2, fontScale: 1 }));
  }

  it('G2.3: below 640 stacked full width, primary first', async () => {
    const spy = atWidth(390);
    try {
      previewGeneratedPlan.mockResolvedValue({ ...REFUSAL, reason: { ...REFUSAL.reason, equipment_fix: true } });
      const tree = await render(<PlanGeneratorPreviewScreen />);
      const buttons = actionButtons(tree);
      expect(buttons.map((b) => b.props.testID)).toEqual(['generator-edit-go-easy', 'generator-change-equipment']);
      expect(buttons.every((b) => b.props.fullWidth)).toBe(true);
      expect(buttons[1].props.variant).toBe('secondary');
    } finally {
      spy.mockRestore();
    }
  });

  it('G2.3: from 640 a right-aligned row, primary on the right', async () => {
    const spy = atWidth(640);
    try {
      previewGeneratedPlan.mockResolvedValue({ ...REFUSAL, reason: { ...REFUSAL.reason, equipment_fix: true } });
      const tree = await render(<PlanGeneratorPreviewScreen />);
      const buttons = actionButtons(tree);
      expect(buttons.map((b) => b.props.testID)).toEqual(['generator-change-equipment', 'generator-edit-go-easy']);
      expect(buttons.some((b) => b.props.fullWidth)).toBe(false);
      const row = ReactNative.StyleSheet.flatten(one(tree, 'generator-go-easy-actions').props.style);
      expect(row).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    } finally {
      spy.mockRestore();
    }
  });

  it('G2.3: equipment_fix missing → only "Edit go-easy areas"', async () => {
    previewGeneratedPlan.mockResolvedValue(REFUSAL);
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(one(tree, 'generator-edit-go-easy').props.title).toBe('Edit go-easy areas');
    expect(has(tree, 'generator-change-equipment')).toBe(false);
  });

  it('G2.3: every other reason keeps "Change my answers" and moves no focus', async () => {
    previewGeneratedPlan.mockResolvedValue({ feasible: false, reason: { code: 'OTHER', message: 'No.', equipment_fix: true } });
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(one(tree, 'generator-change-answers').props.title).toBe('Change my answers');
    expect(has(tree, 'generator-edit-go-easy')).toBe(false);
    await press(tree, 'generator-change-answers');
    expect(mockNavigation.push).toHaveBeenLastCalledWith('PlanGenerator');
    await flushFocus();
    expect(focusSpy).not.toHaveBeenCalled();
  });
});
