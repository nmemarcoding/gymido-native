import { act, create } from 'react-test-renderer';

import { useAuthStore } from '../auth/authStore';
import { getGeneratorProfile } from '../planGenerator/api/generatorApi';
import { Workspace } from '../workspace/workspace';
import CreateProfileScreen from './CreateProfileScreen';
import { createProfile } from './api/profileApi';
import { resetProfileStore, useProfileStore } from './profileStore';

jest.mock('../auth/authService', () => ({ logout: jest.fn(), signOutDeletedAccount: jest.fn() }));
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), createProfile: jest.fn(), deleteAccount: jest.fn() }));
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../shared/components/BlurLayer', () => () => null);
const mockNavigation = { reset: jest.fn(), isFocused: () => true };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: 1 }),
}));

// T-53 (onboarding ruling, 29 Oct 2026): Create profile in four steps, then
// the bridge. The rules, messages and payload are the existing ones
// (createProfileScreen.test.js); this file covers the step flow.

// The module object itself (a namespace import is a copy the spies miss).
const ReactNative = require('react-native');

const { AccessibilityInfo, BackHandler, TextInput } = ReactNative;

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const queryHost = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const textInput = (root, id) => root.find((node) => node.props.testID === id && node.type === 'TextInput');
const label = (root, id) => textOf(host(root, id).findAll((node) => node.type === 'Text')[0]);
const stepTitle = (tree) => textOf(host(tree.root, 'profile-step-title'));

const mounted = [];
function render() {
  let tree;
  act(() => {
    tree = create(<CreateProfileScreen />);
  });
  mounted.push(tree);
  return tree;
}
const type = (tree, id, value) => act(() => textInput(tree.root, id).props.onChangeText(value));
const press = (tree, id) =>
  act(() => {
    pressable(tree.root, id).props.onPress();
  });
const next = (tree) => press(tree, 'profile-next');
function toWeights(tree) {
  type(tree, 'profile-first_name', 'Asad');
  type(tree, 'profile-last_name', 'Khan');
  next(tree);
  type(tree, 'profile-height_feet', '5');
  next(tree);
}
function toAbout(tree) {
  toWeights(tree);
  next(tree);
}
const save = (tree) => act(async () => pressable(tree.root, 'profile-submit').props.onPress());
const resetTo = () => mockNavigation.reset.mock.calls[0][0].routes[0].params;

let backHandlers;
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  resetProfileStore();
  useAuthStore.setState({ user: { email: 'member@example.com', roles: [] }, workspace: null, profileMissing: true });
  createProfile.mockResolvedValue({ first_name: 'Asad' });
  getGeneratorProfile.mockResolvedValue({ available: true });
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((name, handler) => {
    backHandlers.push(handler);
    return { remove: () => (backHandlers = backHandlers.filter((item) => item !== handler)) };
  });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.restoreAllMocks();
});
const androidBack = () => {
  let handled;
  act(() => {
    handled = backHandlers[backHandlers.length - 1]();
  });
  return handled;
};

describe('T-53 chrome: progress, eyebrow, top Back', () => {
  it('P1–P4: "Step n of 4" (4 segments, read once), the eyebrow, the step titles and helpers', () => {
    const tree = render();
    const check = (step, title, helper) => {
      const progress = host(tree.root, 'profile-progress');
      expect(progress.props.accessibilityLabel).toBe(`Step ${step} of 4`);
      expect(queryHost(progress, 'progress-segment-on')).toHaveLength(step);
      expect(queryHost(progress, 'progress-segment-off')).toHaveLength(4 - step);
      expect(textOf(host(tree.root, 'profile-step-eyebrow'))).toBe(`Step ${step} of 4`);
      expect(stepTitle(tree)).toBe(title);
      expect(queryHost(tree.root, 'profile-step-helper').map((node) => textOf(node))).toEqual(helper ? [helper] : []);
    };
    check(1, 'What should we call you?', null);
    type(tree, 'profile-first_name', 'Asad');
    type(tree, 'profile-last_name', 'Khan');
    next(tree);
    check(2, 'How tall are you?', null);
    type(tree, 'profile-height_feet', '5');
    next(tree);
    check(3, 'What do you weigh?', 'Optional. It helps you track progress.');
    next(tree);
    check(4, 'A bit about you', 'Optional. This stays private.');
  });

  it('phone: the 44 glass "Back" icon on P2–P4 only; tablet: none (Back is in the button row)', () => {
    const tree = render();
    expect(queryHost(tree.root, 'profile-top-back')).toHaveLength(0);
    expect(queryHost(tree.root, 'profile-back')).toHaveLength(0);
    toWeights(tree);
    expect(pressable(tree.root, 'profile-top-back').props.accessibilityLabel).toBe('Back');
    expect(queryHost(tree.root, 'profile-back')).toHaveLength(1);
    mockWidth = 834;
    const tablet = render();
    toWeights(tablet);
    expect(queryHost(tablet.root, 'profile-top-back')).toHaveLength(0);
    expect(queryHost(tablet.root, 'profile-back')).toHaveLength(1);
  });

  it('tablet: the in-flow button row is right-aligned, Back first and the primary last (52)', () => {
    mockWidth = 834;
    const tree = render();
    toWeights(tree);
    const row = host(tree.root, 'profile-buttons');
    expect(ReactNative.StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    const ids = row.findAll((node) => typeof node.type === 'string' && ['profile-back', 'profile-next'].includes(node.props.testID)).map((node) => node.props.testID);
    expect(ids).toEqual(['profile-back', 'profile-next']);
    expect(ReactNative.StyleSheet.flatten(host(tree.root, 'profile-next').props.style).minHeight).toBe(52);
  });
});

describe('T-53 steps', () => {
  it('Back keeps the answers (memory only)', () => {
    const tree = render();
    toWeights(tree);
    type(tree, 'profile-current_weight_value', '82');
    press(tree, 'profile-back');
    expect(textInput(tree.root, 'profile-height_feet').props.value).toBe('5');
    press(tree, 'profile-top-back');
    expect(textInput(tree.root, 'profile-first_name').props.value).toBe('Asad');
    next(tree);
    next(tree);
    expect(textInput(tree.root, 'profile-current_weight_value').props.value).toBe('82');
  });

  it('P3: "Skip" while both weights are empty after trim, "Next" once either has text; typed then cleared = Skip', () => {
    const tree = render();
    toWeights(tree);
    expect(label(tree.root, 'profile-next')).toBe('Skip');
    type(tree, 'profile-goal_weight_value', '70');
    expect(label(tree.root, 'profile-next')).toBe('Next');
    type(tree, 'profile-goal_weight_value', '  ');
    expect(label(tree.root, 'profile-next')).toBe('Skip');
  });

  it('P4: "Skip" saves without the date of birth or sex; a pill makes it "Create profile"', async () => {
    const tree = render();
    toAbout(tree);
    expect(label(tree.root, 'profile-submit')).toBe('Skip');
    act(() => tree.root.find((node) => node.props.testID === 'profile-sex-male' && node.props.accessibilityState && node.props.onPress).props.onPress());
    expect(label(tree.root, 'profile-submit')).toBe('Create profile');
    act(() => tree.root.find((node) => node.props.testID === 'profile-sex-male' && node.props.accessibilityState && node.props.onPress).props.onPress());
    expect(label(tree.root, 'profile-submit')).toBe('Skip');
    await save(tree);
    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({ date_of_birth: null, sex: null, current_weight_value: null }));
  });

  it('D1: each unit group is labelled, its segments are buttons with a selected state, exactly one selected', () => {
    const tree = render();
    type(tree, 'profile-first_name', 'Asad');
    type(tree, 'profile-last_name', 'Khan');
    next(tree);
    const segments = (id) => host(tree.root, id).findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityState && node.props.onPress);
    expect(host(tree.root, 'profile-height-unit').props.accessibilityLabel).toBe('Height unit');
    expect(segments('profile-height-unit').filter((node) => node.props.accessibilityState.selected)).toHaveLength(1);
    press(tree, 'profile-height-unit-cm');
    expect(segments('profile-height-unit').filter((node) => node.props.accessibilityState.selected).map((node) => node.props.testID)).toEqual(['profile-height-unit-cm']);
    type(tree, 'profile-height_value', '180');
    next(tree);
    expect(host(tree.root, 'profile-weight-unit').props.accessibilityLabel).toBe('Weight unit');
    expect(segments('profile-weight-unit').filter((node) => node.props.accessibilityState.selected)).toHaveLength(1);
  });

  it('Return in a step\'s first field moves to the next field; in its last field it is the primary', () => {
    const tree = render();
    const first = textInput(tree.root, 'profile-first_name');
    const last = textInput(tree.root, 'profile-last_name');
    expect(first.props.returnKeyType).toBe('next');
    expect(last.props.returnKeyType).toBe('go');
    type(tree, 'profile-first_name', 'Asad');
    type(tree, 'profile-last_name', 'Khan');
    act(() => textInput(tree.root, 'profile-last_name').props.onSubmitEditing());
    expect(stepTitle(tree)).toBe('How tall are you?');
    expect(textInput(tree.root, 'profile-height_feet').props.returnKeyType).toBe('next');
    expect(textInput(tree.root, 'profile-height_inches').props.returnKeyType).toBe('go');
  });

  it('a step change moves the accessibility focus to the title (no field is focused)', () => {
    jest.useFakeTimers();
    try {
      const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
      jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue((ref) => (ref ? ref.props?.testID ?? 7 : null));
      const tree = render();
      const before = TextInput.prototype.focus.mock.calls.length;
      type(tree, 'profile-first_name', 'Asad');
      type(tree, 'profile-last_name', 'Khan');
      next(tree);
      act(() => jest.runOnlyPendingTimers());
      expect(focus).toHaveBeenCalledTimes(1);
      expect(TextInput.prototype.focus.mock.calls.length).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Android back: P2–P4 = Back; P1 does nothing (handled, no exit)', () => {
    const tree = render();
    expect(androidBack()).toBe(true);
    expect(stepTitle(tree)).toBe('What should we call you?');
    toWeights(tree);
    expect(androidBack()).toBe(true);
    expect(stepTitle(tree)).toBe('How tall are you?');
  });
});

describe('T-53 §0 the destination after the save', () => {
  it('generator available → B with "Build my plan" (gold), "Browse plans" (glass), "Not now"; no progress, no Back', async () => {
    const tree = render();
    toAbout(tree);
    await save(tree);
    expect(textOf(host(tree.root, 'profile-step-eyebrow'))).toBe('Profile saved');
    expect(queryHost(tree.root, 'bridge-check')).toHaveLength(1);
    expect(stepTitle(tree)).toBe('Want us to build your first plan?');
    expect(texts(tree.root)).toContain(
      "Answer 6 quick questions and we'll put together a plan for your goal, schedule and equipment. You'll see it before anything starts."
    );
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Build my plan', 'Browse plans', 'Not now']));
    expect(queryHost(tree.root, 'profile-progress')).toHaveLength(0);
    expect(queryHost(tree.root, 'profile-top-back')).toHaveLength(0);
    expect(queryHost(tree.root, 'profile-back')).toHaveLength(0);
    expect(androidBack()).toBe(true);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it.each([
    ['200 available false', () => getGeneratorProfile.mockResolvedValue({ available: false })],
    ['a 500', () => getGeneratorProfile.mockRejectedValue({ response: { status: 500 } })],
  ])('%s → B without "Build my plan": "Find your first plan", Browse plans the gold primary', async (_name, setup) => {
    setup();
    const tree = render();
    toAbout(tree);
    await save(tree);
    expect(stepTitle(tree)).toBe('Find your first plan');
    expect(texts(tree.root)).toContain('Pick a ready-made plan to get your weekly schedule and guided workouts.');
    expect(queryHost(tree.root, 'bridge-build')).toHaveLength(0);
    expect(ReactNative.StyleSheet.flatten(host(tree.root, 'bridge-browse').props.style).backgroundColor).toBe(require('../../shared/theme/tokens').colors.gold);
  });

  it('403 (coached member) → no bridge, straight to Today (store committed)', async () => {
    getGeneratorProfile.mockRejectedValue({ response: { status: 403 } });
    const tree = render();
    toAbout(tree);
    await save(tree);
    expect(resetTo()).toEqual({ screen: 'TodayTab', params: { screen: 'Home', params: undefined } });
    expect(useProfileStore.getState().profile).toEqual({ first_name: 'Asad' });
    expect(useAuthStore.getState().profileMissing).toBe(false);
  });

  it('a trainer in the trainer workspace → today\'s landing (/trainer), no generator check, no bridge', async () => {
    useAuthStore.setState({ user: { email: 't@example.com', roles: ['trainer'] }, workspace: Workspace.trainer });
    const tree = render();
    toAbout(tree);
    await save(tree);
    expect(getGeneratorProfile).not.toHaveBeenCalled();
    expect(resetTo()).toMatchObject({ params: { screen: 'TrainerDashboard' } });
  });

  it('the primary keeps its spinner while the check runs', async () => {
    let resolve;
    getGeneratorProfile.mockReturnValue(new Promise((done) => (resolve = done)));
    const tree = render();
    toAbout(tree);
    await save(tree);
    expect(tree.root.find((node) => node.props.testID === 'profile-submit' && node.props.accessibilityState).props.accessibilityState.busy).toBe(true);
    await act(async () => resolve({ available: true }));
    expect(stepTitle(tree)).toBe('Want us to build your first plan?');
  });

  it.each([
    ['bridge-build', { screen: 'PlansTab', params: { screen: 'PlanGenerator', params: { from: 'onboarding' } } }],
    ['bridge-browse', { screen: 'PlansTab', params: { screen: 'PlansLibrary', params: undefined } }],
    ['bridge-not-now', { screen: 'TodayTab', params: { screen: 'Home', params: undefined } }],
  ])('%s commits the profile and resets into the app', async (id, target) => {
    const tree = render();
    toAbout(tree);
    await save(tree);
    expect(useAuthStore.getState().profileMissing).toBe(true);
    press(tree, id);
    expect(useAuthStore.getState().profileMissing).toBe(false);
    expect(mockNavigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'AppShell', params: target }] });
  });

  it('tablet B: one row, Not now · Browse plans · Build my plan', async () => {
    mockWidth = 834;
    const tree = render();
    toAbout(tree);
    await save(tree);
    const row = host(tree.root, 'profile-buttons');
    const ids = row.findAll((node) => typeof node.type === 'string' && String(node.props.testID).startsWith('bridge-')).map((node) => node.props.testID);
    expect(ids).toEqual(['bridge-not-now', 'bridge-browse', 'bridge-build']);
  });
});
