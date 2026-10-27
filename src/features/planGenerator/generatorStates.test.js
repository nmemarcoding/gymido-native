import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { getGeneratorProfile, previewGeneratedPlan, saveGeneratorProfile } from './api/generatorApi';
import PlanGeneratorPreviewScreen from './screens/PlanGeneratorPreviewScreen';
import PlanGeneratorScreen from './screens/PlanGeneratorScreen';

// RN-SPEC-v2-phase2 §D2 Generator states G1–G6 (UX D "Generator states")
// and the PM parity items (G3/G4 announced; preview 422 → step 6 focuses the error).

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
jest.mock('../../shared/components/toastStore', () => ({
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

const ReactNative = require('react-native');

const { AccessibilityInfo } = ReactNative;
const { openShellPath } = require('../shell/shellLinks');
const { RetryButton } = require('../../shared/components/ErrorAlert');
const { default: ErrorAlert } = require('../../shared/components/ErrorAlert');
const { default: PillButton } = require('../../shared/components/PillButton');
const { default: GradientFill } = require('../../shared/components/GradientFill');
const { colors, radii, shadows } = require('../../shared/theme/tokens');
const { initialStepErrors } = require('./screens/PlanGeneratorScreen');

let focusSpy;
let announceSpy;
let handleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockParams = {};
  focusSpy = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  // Each ref gets its own handle so the focus target is identifiable.
  handleSpy = jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue((ref) => (ref ? ref.props?.testID ?? 7 : null));
});

afterEach(() => {
  jest.useRealTimers();
  focusSpy.mockRestore();
  announceSpy.mockRestore();
  handleSpy.mockRestore();
});

const hostOf = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(node.props.style);
const mockProfile = () =>
  getGeneratorProfile.mockResolvedValue({ available: true, profile: PROFILE, options: BASE_OPTIONS });
const flushFocus = () =>
  act(async () => {
    jest.advanceTimersByTime(300);
  });

describe('G1 generator unavailable (page card)', () => {
  it.each([
    ['questionnaire (available false)', () => getGeneratorProfile.mockResolvedValue({ available: false }), PlanGeneratorScreen],
    ['preview (503)', () => previewGeneratedPlan.mockRejectedValue(httpError(503)), PlanGeneratorPreviewScreen],
  ])('%s: the code copy and a SECONDARY compact "Back to plans" to the library', async (_label, setup, Screen) => {
    setup();
    const tree = await render(<Screen />);
    expect(texts(tree)).toEqual(expect.arrayContaining(["The plan generator isn't available yet", 'Check back soon.', 'Back to plans']));
    const button = tree.root.find((node) => node.type === PillButton && node.props.testID === 'generator-back-to-plans');
    expect(button.props).toMatchObject({ variant: 'secondary', size: 'compact' });
    // No gold button on the state: the only gold is the icon tile.
    expect(tree.root.findAll((node) => node.type === PillButton && node.props.variant !== 'secondary')).toHaveLength(0);
    await act(async () => button.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/plans');
  });

  it('look: gradient card at max 640, gold 72 icon tile with the glow, title-lg title, body secondary', async () => {
    getGeneratorProfile.mockResolvedValue({ available: false });
    const tree = await render(<PlanGeneratorScreen />);
    expect(flat(hostOf(tree, 'generator-unavailable'))).toMatchObject({ maxWidth: 640, alignSelf: 'center', borderRadius: radii.xxl, overflow: 'hidden', paddingVertical: 36, paddingHorizontal: 22 });
    expect(hostOf(tree, 'generator-unavailable').props.accessibilityLiveRegion).toBe('polite');
    expect(flat(hostOf(tree, 'generator-unavailable-icon'))).toMatchObject({ width: 72, height: 72, borderRadius: radii.xl, backgroundColor: colors.gold, boxShadow: shadows.goldGlow });
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(2);
    const title = tree.root.find((node) => node.type === 'Text' && node.props.children === "The plan generator isn't available yet");
    expect(flat(title)).toMatchObject({ fontFamily: 'Geist-Bold', fontSize: 30, color: colors.textPrimary });
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('G1 loads its profile with { screen: true } (read only by the DEV-only stub, devMock.js)', async () => {
    getGeneratorProfile.mockResolvedValue({ available: false });
    await render(<PlanGeneratorScreen />);
    expect(getGeneratorProfile).toHaveBeenCalledWith({ screen: true });
  });
});

describe('G2 load failed / G5 build failed: generator ErrorAlert, Retry except on 403', () => {
  it('G2 500: server message + Retry that reloads', async () => {
    getGeneratorProfile.mockRejectedValueOnce(httpError(500, { message: 'Server down' }));
    const tree = await render(<PlanGeneratorScreen />);
    const alert = tree.root.find((node) => node.type === ErrorAlert);
    expect(alert.props).toMatchObject({ variant: 'generator', title: 'Could not load the plan generator', description: 'Server down' });
    expect(flat(hostOf(tree, 'generator-load-error'))).toMatchObject({ maxWidth: 640, alignSelf: 'center' });
    expect(announceSpy).toHaveBeenCalledWith('Could not load the plan generator. Server down');
    mockProfile();
    await act(async () => tree.root.findByType(RetryButton).props.onPress());
    expect(getGeneratorProfile).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('Step 1 of 6');
  });

  it('G2 403 (member with a trainer): the same card, NO Retry', async () => {
    getGeneratorProfile.mockRejectedValue(httpError(403, { message: 'Your trainer manages your plans.' }));
    const tree = await render(<PlanGeneratorScreen />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Could not load the plan generator', 'Your trainer manages your plans.']));
    expect(tree.root.findAllByType(RetryButton)).toHaveLength(0);
  });

  it('G5 500: "Could not build your plan" + Retry that previews again', async () => {
    previewGeneratedPlan.mockRejectedValueOnce(httpError(500, { message: 'Boom' }));
    const tree = await render(<PlanGeneratorPreviewScreen />);
    const alert = tree.root.find((node) => node.type === ErrorAlert);
    expect(alert.props).toMatchObject({ variant: 'generator', title: 'Could not build your plan', description: 'Boom', retryTestID: 'generator-preview-retry' });
    previewGeneratedPlan.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      tree.root.findByType(RetryButton).props.onPress();
    });
    expect(previewGeneratedPlan).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('Building your plan');
  });

  it('G5 403: no Retry', async () => {
    previewGeneratedPlan.mockRejectedValue(httpError(403, { message: 'Nope' }));
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(texts(tree)).toContain('Could not build your plan');
    expect(tree.root.findAllByType(RetryButton)).toHaveLength(0);
  });
});

describe('G3 step error / step eyebrow', () => {
  it('the step eyebrow is sentence case gold 14/600 (v2 eyebrow rule; PlanGenerator board 14)', async () => {
    mockProfile();
    const tree = await render(<PlanGeneratorScreen />);
    const eyebrow = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Step 1 of 6');
    const style = flat(eyebrow);
    expect(style).toMatchObject({ fontSize: 14, fontFamily: 'Geist-SemiBold', color: colors.gold });
    expect(style.textTransform).toBeUndefined();
    expect(style.letterSpacing).toBeUndefined();
    expect(style.fontWeight).toBeUndefined();
  });

  it('the review eyebrow follows the same rule', async () => {
    mockProfile();
    mockParams = { step: 5 };
    const tree = await render(<PlanGeneratorScreen />);
    await act(async () => one(tree, 'generator-next').props.onPress());
    const eyebrow = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Build me a plan');
    expect(flat(eyebrow)).toMatchObject({ fontSize: 14, color: colors.gold });
  });

  it('preview 422 → step 6: the error shows ABOVE the eyebrow, is announced, and gets the focus (PM parity)', async () => {
    mockProfile();
    mockParams = { step: 5, stepErrors: { 6: 'Pick an area that does not clash with your focus.' } };
    const tree = await render(<PlanGeneratorScreen />);
    const shown = texts(tree);
    expect(shown.indexOf('Please check this answer')).toBeGreaterThanOrEqual(0);
    expect(shown.indexOf('Please check this answer')).toBeLessThan(shown.indexOf('Step 6 of 6'));
    expect(announceSpy).toHaveBeenCalledWith('Please check this answer. Pick an area that does not clash with your focus.');
    await flushFocus();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith('generator-step-error');
  });

  it('a plain deep link (no error) still focuses the heading', async () => {
    mockProfile();
    mockParams = { step: 5 };
    const tree = await render(<PlanGeneratorScreen />);
    expect(has(tree, 'generator-step-error')).toBe(false);
    await flushFocus();
    expect(focusSpy).toHaveBeenCalledWith('generator-step-title');
  });

  it('G1.5 save 422: "Could not save your answers" announced; the step error shows on its step', async () => {
    mockProfile();
    mockParams = { step: 5 };
    saveGeneratorProfile.mockRejectedValue(httpError(422, { message: 'Validation failed', errors: { days_per_week: ['Too many days.'] } }));
    const tree = await render(<PlanGeneratorScreen />);
    await act(async () => one(tree, 'generator-next').props.onPress());
    await act(async () => one(tree, 'generator-see-plan').props.onPress());
    expect(texts(tree)).toEqual(expect.arrayContaining(['Could not save your answers', 'Validation failed', 'Too many days.']));
    expect(announceSpy).toHaveBeenCalledWith('Could not save your answers. Validation failed');
    const box = hostOf(tree, 'generator-save-error');
    expect(box.props).toMatchObject({ accessibilityRole: 'alert', accessibilityLiveRegion: 'assertive' });
    await act(async () => one(tree, 'generator-review-change-3').props.onPress());
    expect(texts(tree)).toContain('Too many days.');
    expect(announceSpy).toHaveBeenCalledWith('Please check this answer. Too many days.');
  });

  it('initialStepErrors keeps only step 1–6 string messages', () => {
    expect(initialStepErrors({ 6: 'x', 0: 'no', 7: 'no', 2: '', 3: 5 })).toEqual({ 6: 'x' });
    expect(initialStepErrors(undefined)).toEqual({});
    expect(initialStepErrors('6')).toEqual({});
  });

  it('the avoid search TextInput has a gold caret and selection', async () => {
    mockProfile();
    mockParams = { step: 5 };
    const tree = await render(<PlanGeneratorScreen />);
    const input = tree.root.find((node) => node.props.testID === 'generator-avoid-search' && typeof node.type !== 'string');
    expect(input.props).toMatchObject({ selectionColor: colors.gold, cursorColor: colors.gold });
  });
});

describe('G6 refusal', () => {
  const refusal = (reason) => previewGeneratedPlan.mockResolvedValue({ feasible: false, reason });

  it('title-sm title, reason, teal note callout, gold "Change my answers"', async () => {
    refusal({ code: 'OTHER', message: 'Not enough exercises.', what_to_change: 'Add equipment.' });
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(texts(tree)).toEqual(expect.arrayContaining(["We couldn't build a plan with these answers", 'Not enough exercises.', 'Add equipment.', 'Change my answers']));
    const title = hostOf(tree, 'generator-not-feasible-title');
    expect(flat(title)).toMatchObject({ fontSize: 22, lineHeight: 28, fontFamily: 'Geist-Bold' });
    const callout = one(tree, 'generator-refusal-callout');
    expect(callout.props).toMatchObject({ tone: 'teal', role: 'note' });
    expect(flat(hostOf(tree, 'generator-refusal-callout'))).toMatchObject({ backgroundColor: colors.tealFaint, borderColor: colors.tealLine, marginTop: 14 });
    expect(flat(hostOf(tree, 'generator-not-feasible'))).toMatchObject({ paddingVertical: 22, paddingHorizontal: 20, borderColor: colors.hairline, backgroundColor: colors.surface });
    const change = tree.root.find((node) => node.type === PillButton && node.props.testID === 'generator-change-answers');
    expect(change.props.variant).toBeUndefined();
    await act(async () => change.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanGenerator');
  });

  it('the go-easy variant: same title/message/callout, "Edit go-easy areas" + "Change my equipment", focus on the title', async () => {
    refusal({ code: 'GO_EASY_TOO_RESTRICTIVE', message: 'Too restrictive.', what_to_change: 'Pick fewer areas.', equipment_fix: true });
    const tree = await render(<PlanGeneratorPreviewScreen />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Too restrictive.', 'Pick fewer areas.', 'Edit go-easy areas', 'Change my equipment']));
    expect(has(tree, 'generator-change-answers')).toBe(false);
    await flushFocus();
    expect(focusSpy).toHaveBeenCalledWith('generator-not-feasible-title');
  });
});
