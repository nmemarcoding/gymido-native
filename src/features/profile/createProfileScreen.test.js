jest.mock('../auth/authService', () => ({ logout: jest.fn(), signOutDeletedAccount: jest.fn() }));
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), createProfile: jest.fn(), deleteAccount: jest.fn() }));
// T-53: P4's save asks the generator whether the bridge offers "Build my plan".
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn(() => Promise.resolve({ available: true })) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
// T-53: P2–P4's glass top Back blurs on Android (expo-blur warns without the app's blur target).
jest.mock('../../shared/components/BlurLayer', () => () => null);
const mockNavigation = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), reset: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

import { AccessibilityInfo, Platform, StyleSheet, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useAuthStore } from '../auth/authStore';
import { colors, spacing, typography } from '../../shared/theme/tokens';
import CreateProfileScreen, { HEIGHT_UNITS, PROFILE_PLACEHOLDERS, WEIGHT_UNITS } from './CreateProfileScreen';
import { createProfile, getProfile } from './api/profileApi';
import { resetProfileStore, useProfileStore } from './profileStore';

const { getGeneratorProfile } = require('../planGenerator/api/generatorApi');

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
const flat = (style) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mounted = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  resetProfileStore();
  useAuthStore.setState({ user: { email: 'member@example.com', roles: [] }, claims: { sub: 'auth0|member' }, workspace: null });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

function render() {
  let tree;
  act(() => {
    tree = create(<CreateProfileScreen />);
  });
  mounted.push(tree);
  return tree;
}
const type = (tree, id, value) => act(() => textInput(tree.root, id).props.onChangeText(value));
// Not awaited: an async onPress must not turn this into an async act.
const press = (tree, id) =>
  act(() => {
    pressable(tree.root, id).props.onPress();
  });
const selected = (tree, id) => pressable(tree.root, id).props.accessibilityState.selected;

// T-53 (setup): Create profile is four steps (P1 names, P2 height, P3
// weights, P4 date of birth + sex); these walk to a step with valid answers.
const next = (tree) => press(tree, 'profile-next');
const stepTitle = (tree) => textOf(host(tree.root, 'profile-step-title'));
function toHeight(tree) {
  type(tree, 'profile-first_name', ' Asad ');
  type(tree, 'profile-last_name', 'Khan');
  next(tree);
}
// Was (one form): names + 5 ft 9 in typed; now it also lands on P3.
function fillValid(tree) {
  toHeight(tree);
  type(tree, 'profile-height_feet', '5');
  type(tree, 'profile-height_inches', '9');
  next(tree);
}
// P3 → P4 (P3's primary is "Skip" or "Next").
const toAbout = (tree) => next(tree);
const submit = (tree) => act(async () => pressable(tree.root, 'profile-submit').props.onPress());
// The shared TextInput focus mock (one prototype mock): which inputs it focused.
const focusedTextIds = () => TextInput.prototype.focus.mock.contexts.map((input) => input?.props?.testID).filter(Boolean);

describe('B1 height unit: a three-segment switch (ND1, PM 26 Oct)', () => {
  it('reads ft/in · cm · in (board order) and opens on ft/in', () => {
    expect(HEIGHT_UNITS.map((unit) => unit.label)).toEqual(['ft/in', 'cm', 'in']);
    expect(HEIGHT_UNITS.map((unit) => unit.value)).toEqual(['ft_in', 'cm', 'in']);
    const tree = render();
    toHeight(tree);
    expect(host(tree.root, 'profile-height-unit').props.accessibilityLabel).toBe('Height unit');
    expect(selected(tree, 'profile-height-unit-ft_in')).toBe(true);
    expect(selected(tree, 'profile-height-unit-cm')).toBe(false);
    expect(selected(tree, 'profile-height-unit-in')).toBe(false);
    expect(texts(tree.root)).toEqual(
      expect.arrayContaining([
        'Height unit',
        'Feet and inches are shown first. Switch to cm or inches if that is how you measure height.',
        'Feet',
        'Whole feet only.',
        'Inches',
        'Use 0 to 11 inches. Leave blank if there are no extra inches.',
      ])
    );
  });

  it('every segment keeps a 44 hit area', () => {
    const tree = render();
    toHeight(tree);
    HEIGHT_UNITS.forEach(({ testID }) => {
      const segment = pressable(tree.root, testID);
      expect(flat(segment.props.style).minHeight + segment.props.hitSlop.top + segment.props.hitSlop.bottom).toBeGreaterThanOrEqual(44);
    });
  });

  it('ft/in → cm converts as v1 (5 ft 9 in → 175.26), with the cm label, helper and placeholder', () => {
    const tree = render();
    toHeight(tree);
    type(tree, 'profile-height_feet', '5');
    type(tree, 'profile-height_inches', '9');
    press(tree, 'profile-height-unit-cm');
    expect(selected(tree, 'profile-height-unit-cm')).toBe(true);
    const field = textInput(tree.root, 'profile-height_value');
    expect(field.props.value).toBe('175.26');
    expect(field.props.placeholder).toBe('180');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Height', 'Enter your height in centimeters.']));
    expect(queryHost(tree.root, 'profile-height_feet')).toHaveLength(0);
    expect(host(tree.root, 'profile-height_value-unit')).toBeTruthy();
  });

  it('cm → in keeps the value unconverted (⚠P3) and shows the inches copy', () => {
    const tree = render();
    toHeight(tree);
    press(tree, 'profile-height-unit-cm');
    type(tree, 'profile-height_value', '180');
    press(tree, 'profile-height-unit-in');
    const field = textInput(tree.root, 'profile-height_value');
    expect(field.props.value).toBe('180');
    expect(field.props.placeholder).toBe('71');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Height (inches)', 'Enter your height in inches.']));
  });

  it('in → ft/in converts back (71 → 5 ft 11 in)', () => {
    const tree = render();
    toHeight(tree);
    press(tree, 'profile-height-unit-in');
    type(tree, 'profile-height_value', '71');
    press(tree, 'profile-height-unit-ft_in');
    expect(textInput(tree.root, 'profile-height_feet').props.value).toBe('5');
    expect(textInput(tree.root, 'profile-height_inches').props.value).toBe('11');
  });

  it('pressing the selected segment changes nothing', () => {
    const tree = render();
    toHeight(tree);
    type(tree, 'profile-height_feet', '6');
    press(tree, 'profile-height-unit-ft_in');
    expect(textInput(tree.root, 'profile-height_feet').props.value).toBe('6');
  });
});

describe('B1 weight unit: lb · kg switch with the "In {unit}." helper', () => {
  it('opens on lb; the helper and the unit suffix follow the switch', () => {
    expect(WEIGHT_UNITS.map((unit) => unit.value)).toEqual(['lb', 'kg']);
    const tree = render();
    fillValid(tree);
    expect(host(tree.root, 'profile-weight-unit').props.accessibilityLabel).toBe('Weight unit');
    expect(selected(tree, 'profile-weight-unit-lb')).toBe(true);
    // T-53 Q5 (UX 29 Oct, PM OK). Was: toHaveLength(2) — the steps drop the "In lb." helper (Edit profile keeps it).
    expect(texts(tree.root).filter((line) => line === 'In lb.')).toHaveLength(0);
    expect(textOf(host(tree.root, 'profile-current_weight_value-unit').findByType('Text'))).toBe('lb');
    press(tree, 'profile-weight-unit-kg');
    expect(selected(tree, 'profile-weight-unit-kg')).toBe(true);
    // T-53 Q5 (UX 29 Oct, PM OK). Was: toHaveLength(2) — the steps drop the "In kg." helper (Edit profile keeps it).
    expect(texts(tree.root).filter((line) => line === 'In kg.')).toHaveLength(0);
    expect(textOf(host(tree.root, 'profile-goal_weight_value-unit').findByType('Text'))).toBe('kg');
  });

  it('sends the chosen unit beside a filled weight only (O5)', async () => {
    createProfile.mockResolvedValueOnce({ first_name: 'Asad' });
    const tree = render();
    fillValid(tree);
    press(tree, 'profile-weight-unit-kg');
    type(tree, 'profile-current_weight_value', '83,5');
    toAbout(tree);
    await submit(tree);
    expect(createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Asad',
        height_unit: 'ft_in',
        height_value: 69,
        current_weight_value: 83.5,
        current_weight_unit: 'kg',
        goal_weight_value: null,
        goal_weight_unit: null,
      })
    );
  });
});

describe('B1 phone layout (ND2, ND6)', () => {
  // T-53 item 1 (onboarding ruling §3 P1). Was: accessibilityLabel "Create
  // Profile", text "Create\nProfile" with the second word gold.
  it('the title reads "What should we call you?" on P1 (one h1, no gold word)', () => {
    const tree = render();
    const title = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(textOf(title)).toBe('What should we call you?');
    expect(title.findAll((node) => node.type === 'Text' && node !== title)).toHaveLength(0);
  });

  // T-53 item 2 (§2 bar, §3 P1). Was: "Create profile" (profile-submit) in the
  // bar, paddingBottom 34 + 30, Delete account under it in the bar.
  it('pins "Next" (60, cta) in the bottom bar (16 + the safe area), Delete account not in it; the scroll leaves room for it', () => {
    const tree = render();
    const bar = host(tree.root, 'profile-cta-bar');
    expect(flat(bar.props.style)).toMatchObject({ position: 'absolute', bottom: 0, paddingBottom: 34 + 16 });
    expect(queryHost(bar, 'profile-next')).toHaveLength(1);
    expect(textOf(host(bar, 'profile-next').findAll((node) => node.type === 'Text')[0])).toBe('Next');
    expect(flat(host(bar, 'profile-next').props.style).minHeight).toBe(60);
    expect(queryHost(bar, 'delete-account-action')).toHaveLength(0);
    act(() => bar.props.onLayout({ nativeEvent: { layout: { width: 390, height: 170 } } }));
    expect(host(tree.root, 'create-profile-screen').props.contentContainerStyle.paddingBottom).toBe(170 + 16);
  });

  it('numbers are 64 tall (62 + the 1 px border) at 32/700 tabular', () => {
    const tree = render();
    // Names keep the kit size.
    expect(flat(textInput(tree.root, 'profile-first_name').props.style).minHeight).toBe(50);
    const check = (ids) => {
      // C2 (verdict b7a7867): the value style shows once there is a value.
      ids.forEach((id) => type(tree, id, '7'));
      ids.forEach((id) => {
        const style = flat(textInput(tree.root, id).props.style);
        expect(style).toMatchObject({ minHeight: 62, fontSize: 32, fontFamily: 'Geist-Bold', fontVariant: ['tabular-nums'] });
        expect(style.fontWeight).toBeUndefined();
      });
    };
    toHeight(tree);
    check(['profile-height_feet', 'profile-height_inches']);
    next(tree);
    check(['profile-current_weight_value', 'profile-goal_weight_value']);
  });

  it('the height switch stretches across its card; weight unit is compact 64-wide segments', () => {
    const tree = render();
    toHeight(tree);
    expect(flat(host(tree.root, 'profile-height-unit').props.style).alignSelf).toBe('stretch');
    type(tree, 'profile-height_feet', '5');
    next(tree);
    const lb = flat(pressable(tree.root, 'profile-weight-unit-lb').props.style);
    expect(lb).toMatchObject({ minHeight: 34, minWidth: 64 });
  });

  // T-53 item 3. Was: one render with at least 6 text inputs; now 2 per step
  // on P1–P3 (6 in all).
  it('every text input has the gold caret and selection', () => {
    const tree = render();
    const seen = [];
    const check = () => {
      const inputs = tree.root.findAll((node) => node.type === 'TextInput');
      expect(inputs).toHaveLength(2);
      inputs.forEach((node) => {
        seen.push(node.props.testID);
        expect(node.props.selectionColor).toBe(colors.gold);
        expect(node.props.cursorColor).toBe(colors.gold);
      });
    };
    check();
    toHeight(tree);
    check();
    type(tree, 'profile-height_feet', '5');
    next(tree);
    check();
    expect(seen.length).toBeGreaterThanOrEqual(6);
  });
});

// C2 (UX verdict b7a7867): an empty number field draws in the placeholder
// look (text-faint, 400, the kit's 16) so "5" / "82.5" never read as values;
// the big 32/700 value style starts with the first character.
const PHONE_NUMBERS = ['profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'];
describe('C2 placeholders never wear the value style', () => {
  it('phone: empty numbers are text-faint 400 at the kit body size, not 32/700; still 62 min tall', () => {
    const tree = render();
    const check = (id) => {
      const node = textInput(tree.root, id);
      const style = flat(node.props.style);
      expect(node.props.value).toBe('');
      expect(node.props.placeholderTextColor).toBe(colors.textFaint);
      expect(style).toMatchObject({ fontFamily: 'Geist-Regular', fontSize: typography.bodyLg.fontSize, color: colors.textFaint, minHeight: 62 });
      expect(style.fontSize).not.toBe(32);
      expect(style.fontVariant).toBeUndefined();
      expect(style.letterSpacing).toBeUndefined();
      expect(style.fontWeight).toBeUndefined();
    };
    toHeight(tree);
    PHONE_NUMBERS.slice(0, 2).forEach(check);
    type(tree, 'profile-height_feet', '5');
    next(tree);
    PHONE_NUMBERS.slice(2).forEach(check);
  });

  it('phone: a typed value switches to the 32/700 value style; clearing it switches back', () => {
    const tree = render();
    fillValid(tree);
    type(tree, 'profile-current_weight_value', '82.5');
    expect(flat(textInput(tree.root, 'profile-current_weight_value').props.style)).toMatchObject({
      fontFamily: 'Geist-Bold',
      fontSize: 32,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    });
    type(tree, 'profile-current_weight_value', '');
    expect(flat(textInput(tree.root, 'profile-current_weight_value').props.style)).toMatchObject({
      fontFamily: 'Geist-Regular',
      fontSize: typography.bodyLg.fontSize,
      color: colors.textFaint,
    });
  });

  it('phone: cm / in height follows the same rule', () => {
    const tree = render();
    toHeight(tree);
    press(tree, 'profile-height-unit-cm');
    expect(flat(textInput(tree.root, 'profile-height_value').props.style)).toMatchObject({ fontFamily: 'Geist-Regular', color: colors.textFaint });
    type(tree, 'profile-height_value', '180');
    expect(flat(textInput(tree.root, 'profile-height_value').props.style)).toMatchObject({ fontFamily: 'Geist-Bold', fontSize: 32 });
  });

  it('names (kit style) and tablet numbers (kit style) already draw placeholders at 400 text-faint, size 16', () => {
    const phone = render();
    ['profile-first_name', 'profile-last_name'].forEach((id) => {
      const node = textInput(phone.root, id);
      expect(node.props.placeholderTextColor).toBe(colors.textFaint);
      expect(flat(node.props.style)).toMatchObject({ fontFamily: 'Geist-Regular', fontSize: typography.bodyLg.fontSize });
    });
    mockWidth = 834;
    const tablet = render();
    const check = (id) => {
      const node = textInput(tablet.root, id);
      expect(node.props.placeholderTextColor).toBe(colors.textFaint);
      const style = flat(node.props.style);
      expect(style).toMatchObject({ fontFamily: 'Geist-Regular', fontSize: typography.bodyLg.fontSize, minHeight: 50 });
      expect(style.fontSize).not.toBe(32);
    };
    toHeight(tablet);
    PHONE_NUMBERS.slice(0, 2).forEach(check);
    type(tablet, 'profile-height_feet', '5');
    expect(flat(textInput(tablet.root, 'profile-height_feet').props.style).fontSize).toBe(typography.bodyLg.fontSize);
    next(tablet);
    PHONE_NUMBERS.slice(2).forEach(check);
  });

  it('only the single Height field has a placeholder, as on web (180 cm / 71 in)', () => {
    const tree = render();
    const none = (ids) => ids.forEach((id) => expect(textInput(tree.root, `profile-${id}`).props.placeholder).toBeUndefined());
    none(['first_name', 'last_name']);
    toHeight(tree);
    none(['height_feet', 'height_inches']);
    press(tree, 'profile-height-unit-cm');
    expect(textInput(tree.root, 'profile-height_value').props.placeholder).toBe('180');
    expect(PROFILE_PLACEHOLDERS.height_cm).toBe('180');
    press(tree, 'profile-height-unit-in');
    expect(textInput(tree.root, 'profile-height_value').props.placeholder).toBe('71');
    type(tree, 'profile-height_value', '71');
    next(tree);
    none(['current_weight_value', 'goal_weight_value']);
  });
});

describe('B1 tablet layout (≥ 768)', () => {
  beforeEach(() => {
    mockWidth = 834;
  });

  // T-53 item 4 (§2 tablet). Was: a 640 column of two cards
  // (profile-card-body, profile-card-weight), the title "Create Profile".
  it('one 560 column, the brand row, no sticky bar, no cards; one unit switch per step', () => {
    const tree = render();
    expect(flat(host(tree.root, 'create-profile-form').props.style)).toMatchObject({ maxWidth: 560, alignSelf: 'center' });
    expect(queryHost(tree.root, 'profile-cta-bar')).toHaveLength(0);
    expect(queryHost(tree.root, 'profile-card-body')).toHaveLength(0);
    expect(queryHost(tree.root, 'profile-card-weight')).toHaveLength(0);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Gymido', 'What should we call you?']));
    toHeight(tree);
    expect(queryHost(tree.root, 'profile-height-unit')).toHaveLength(1);
    type(tree, 'profile-height_feet', '5');
    next(tree);
    expect(queryHost(tree.root, 'profile-weight-unit')).toHaveLength(1);
    toAbout(tree);
    expect(queryHost(tree.root, 'profile-sex')).toHaveLength(1);
  });

  // T-53 item 5 (§3 P1, §2 tablet). Was: Delete account 40 below the inline
  // "Create profile" CTA.
  it('P1: Delete account 40 below the content, before the in-flow "Next"', () => {
    const tree = render();
    const action = host(tree.root, 'delete-account-action');
    expect([].concat(action.props.style)).toEqual(expect.arrayContaining([{ marginTop: 40 }]));
    const shown = texts(tree.root);
    expect(shown.indexOf('Delete account')).toBeGreaterThan(-1);
    expect(shown.indexOf('Delete account')).toBeLessThan(shown.indexOf('Next'));
  });

  it('switch segments are 96 (height) and 72 (weight) wide; numbers keep the kit 52', () => {
    const tree = render();
    toHeight(tree);
    expect(flat(pressable(tree.root, 'profile-height-unit-cm').props.style).minWidth).toBe(96);
    expect(flat(textInput(tree.root, 'profile-height_feet').props.style).minHeight).toBe(50);
    type(tree, 'profile-height_feet', '5');
    next(tree);
    expect(flat(pressable(tree.root, 'profile-weight-unit-kg').props.style)).toMatchObject({ minWidth: 72, minHeight: 40 });
  });
});

describe('B1 behaviour unchanged (v1)', () => {
  // T-53 item 6 (§4, the rules per step). Was: one submit showed First +
  // Last + "Feet is required" together.
  it('validates per step on its primary only, with v1 messages, and sends nothing', () => {
    const tree = render();
    expect(texts(tree.root)).not.toContain('First name is required');
    next(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['First name is required', 'Last name is required']));
    expect(texts(tree.root)).not.toContain('Feet is required');
    expect(createProfile).not.toHaveBeenCalled();
    expect(textInput(tree.root, 'profile-first_name').props.accessibilityState).toEqual({ invalid: true });
    toHeight(tree);
    next(tree);
    expect(texts(tree.root)).toContain('Feet is required');
    expect(createProfile).not.toHaveBeenCalled();
  });

  // T-53 item 7. Was: both errors from one submit; now P2 refuses the inches
  // (and stays), then P3 the zero weight.
  it('inches past 11 and a zero weight are refused', () => {
    const tree = render();
    toHeight(tree);
    type(tree, 'profile-height_feet', '5');
    type(tree, 'profile-height_inches', '12');
    next(tree);
    expect(texts(tree.root)).toContain('Inches must be between 0 and 11');
    expect(stepTitle(tree)).toBe('How tall are you?');
    type(tree, 'profile-height_inches', '9');
    next(tree);
    type(tree, 'profile-goal_weight_value', '0');
    next(tree);
    expect(texts(tree.root)).toContain('Goal weight must be greater than zero');
  });

  it('cm: an empty height is refused with "Height is required"', () => {
    const tree = render();
    toHeight(tree);
    type(tree, 'profile-height_feet', '5');
    type(tree, 'profile-height_inches', '9');
    press(tree, 'profile-height-unit-cm');
    type(tree, 'profile-height_value', '');
    next(tree);
    expect(texts(tree.root)).toContain('Height is required');
  });

  // T-53 item 8 (§3 P4 saving). Was: "Delete account disabled" (it is on P1
  // only now); P4's Back + the top Back icon are disabled instead.
  it('submitting: the CTA is busy ("Saving…") and both Backs disabled; one request', async () => {
    const pending = deferred();
    createProfile.mockReturnValueOnce(pending.promise);
    const tree = render();
    fillValid(tree);
    toAbout(tree);
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalledTimes(1);
    const button = tree.root.find((node) => node.props.testID === 'profile-submit' && node.props.accessibilityState);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(texts(tree.root)).toContain('Saving…');
    expect(tree.root.find((node) => node.props.testID === 'profile-back' && node.props.accessibilityState).props.accessibilityState.disabled).toBe(true);
    expect(tree.root.find((node) => node.props.testID === 'profile-top-back' && node.props.accessibilityState).props.accessibilityState.disabled).toBe(true);
    expect(queryHost(tree.root, 'delete-account-action')).toHaveLength(0);
    await act(async () => pending.reject({ response: { status: 500, data: { message: 'Server down' } } }));
  });

  // T-53 item 9 (§0, §3 B). Was: the 201 stored the profile and reset into
  // the app at once; now the bridge shows, and the store commit + the reset
  // happen when a bridge button is pressed.
  it('success: the bridge, then a bridge button stores the profile and resets into the app', async () => {
    createProfile.mockResolvedValueOnce({ first_name: 'Asad' });
    const tree = render();
    fillValid(tree);
    toAbout(tree);
    await submit(tree);
    expect(getGeneratorProfile).toHaveBeenCalledTimes(1);
    expect(stepTitle(tree)).toBe('Want us to build your first plan?');
    expect(useProfileStore.getState().profile).toBeNull();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    press(tree, 'bridge-not-now');
    expect(useProfileStore.getState().profile).toEqual({ first_name: 'Asad' });
    expect(mockNavigation.reset).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
  });

  // Declared 27 Oct 2026: a 409 now reloads the profile first (⚠P7 retired);
  // the message is only the reload-failed fallback.
  it('409 and the reload fails: "A profile already exists for this account."', async () => {
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const tree = render();
    fillValid(tree);
    toAbout(tree);
    await submit(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Something went wrong', 'A profile already exists for this account.']));
  });

  // T-53 item 10 (§4 422). Was: "Too long" + "Bad height" shown together and
  // the CTA enabled; now the save lands on P1 (the first error key's step)
  // under "Please check this answer", and P2 shows its own message.
  it("422: lands on the step of the first error key; each step shows its own server message", async () => {
    createProfile.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Validation failed', errors: { first_name: ['Too long'], height_value: 'Bad height' } } },
    });
    const tree = render();
    fillValid(tree);
    toAbout(tree);
    await submit(tree);
    expect(stepTitle(tree)).toBe('What should we call you?');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Please check this answer', 'Validation failed', 'Too long']));
    expect(texts(tree.root)).not.toContain('Bad height');
    expect(tree.root.find((node) => node.props.testID === 'profile-next' && node.props.accessibilityState).props.accessibilityState.disabled).toBe(false);
    next(tree);
    expect(texts(tree.root)).toContain('Bad height');
  });
});

// Phase 2 "exact match + large text" pass (UX §8.3 colours, §9).
const labelText = (root, label) => root.findAll((node) => node.type === 'Text' && textOf(node) === label)[0];

describe('Phase 2 tokens: exact colours', () => {
  it.each([
    ['phone', 390],
    ['tablet', 834],
  ])('%s: every field label is text-strong-2, as drawn', (_, width) => {
    mockWidth = width;
    const tree = render();
    const check = (labels) => labels.forEach((label) => expect(flat(labelText(tree.root, label).props.style).color).toBe(colors.textStrong2));
    check(['First Name', 'Last Name']);
    toHeight(tree);
    check(['Height unit', 'Feet', 'Inches']);
    type(tree, 'profile-height_feet', '5');
    next(tree);
    check(['Weight unit']);
    toAbout(tree);
    // Date of Birth and Sex carry the "(optional)" suffix inside the label.
    ['Date of Birth', 'Sex'].forEach((label) => {
      const node = tree.root.findAll((n) => n.type === 'Text' && textOf(n).startsWith(label))[0];
      expect(flat(node.props.style).color).toBe(colors.textStrong2);
    });
  });

  it('tablet: both segmented tracks are surface-well (UX §8.3); phone keeps the surface track', () => {
    const phone = render();
    toHeight(phone);
    expect(flat(host(phone.root, 'profile-height-unit').props.style).backgroundColor).toBe(colors.surface);
    mockWidth = 834;
    const tablet = render();
    toHeight(tablet);
    expect(flat(host(tablet.root, 'profile-height-unit').props.style).backgroundColor).toBe(colors.surfaceWell);
    type(tablet, 'profile-height_feet', '5');
    next(tablet);
    expect(flat(host(tablet.root, 'profile-weight-unit').props.style).backgroundColor).toBe(colors.surfaceWell);
  });
});

describe('§9 large text', () => {
  const title = (tree) => tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');

  // T-53 item 11 (Q1, §5). Was: the title in 3 lines, and the subtitle "A
  // quick setup so we can tailor your workout plan." at 2.0 (retired; P3's
  // helper is checked instead).
  it.each([
    ['phone', 390],
    ['tablet', 834],
  ])('%s caps: the title 1.3 (2 lines, wraps by word, shrinks a long word), helper and inputs 2.0', (_, width) => {
    mockWidth = width;
    const tree = render();
    expect(title(tree).props).toMatchObject({ maxFontSizeMultiplier: 1.3, numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.7, textBreakStrategy: 'simple' });
    expect(textInput(tree.root, 'profile-first_name').props.maxFontSizeMultiplier).toBe(2);
    toHeight(tree);
    expect(textInput(tree.root, 'profile-height_feet').props.maxFontSizeMultiplier).toBe(2);
    type(tree, 'profile-height_feet', '5');
    next(tree);
    expect(labelText(tree.root, 'Optional. It helps you track progress.').props.maxFontSizeMultiplier).toBe(2);
    expect(labelText(tree.root, 'Weight unit').props.maxFontSizeMultiplier).toBe(2);
    expect(textInput(tree.root, 'profile-current_weight_value').props.maxFontSizeMultiplier).toBe(2);
  });

  it('tablet: the G in its fixed tile caps at 1.2', () => {
    mockWidth = 834;
    const tree = render();
    expect(labelText(tree.root, 'G').props.maxFontSizeMultiplier).toBe(1.2);
  });

  it('phone numbers grow from min 62 (never a fixed height that clips scaled digits)', () => {
    mockFontScale = 2;
    const tree = render();
    toHeight(tree);
    const style = flat(textInput(tree.root, 'profile-height_feet').props.style);
    expect(style.minHeight).toBe(62);
    expect(style.height).toBeUndefined();
  });

  it.each([
    ['phone', 390, 'profile-section-names'],
    ['tablet', 834, 'profile-names-pair'],
  ])('%s at fontScale 1: the 2-column pairs and the unit row sit side by side; the names stack', (_, width, names) => {
    mockWidth = width;
    const tree = render();
    // DECLARED (T-53 UX, PM OK 29 Oct) Was: toBe('row'); First / Last name full width at every width (as web).
    expect(flat(host(tree.root, names).props.style).flexDirection).toBe('column');
    fillValid(tree);
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('row');
    expect(flat(host(tree.root, 'profile-weight-unit-row').props.style).flexDirection).toBe('row');
  });

  it.each([
    ['phone', 390, 2, 'profile-section-names'],
    ['tablet', 834, 2, 'profile-names-pair'],
    ['phone AX5', 390, 3.1, 'profile-section-names'],
  ])('%s at fontScale %s: one column, the unit switch below its label, nothing lost', (_, width, scale, names) => {
    mockWidth = width;
    mockFontScale = scale;
    const tree = render();
    expect(flat(host(tree.root, names).props.style).flexDirection).toBe('column');
    // Every field and both actions are still there.
    ['profile-first_name', 'profile-last_name'].forEach((id) => expect(textInput(tree.root, id)).toBeTruthy());
    // T-53 item 13. Was: "Create profile" + "Delete account" in one render;
    // P1 holds "Next" + "Delete account".
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Next', 'Delete account']));
    toHeight(tree);
    expect(flat(host(tree.root, 'profile-height-pair').props.style).flexDirection).toBe('column');
    ['profile-height_feet', 'profile-height_inches'].forEach((id) => expect(textInput(tree.root, id)).toBeTruthy());
    type(tree, 'profile-height_feet', '5');
    next(tree);
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('column');
    expect(flat(host(tree.root, 'profile-weight-unit-row').props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    ['profile-current_weight_value', 'profile-goal_weight_value'].forEach((id) => expect(textInput(tree.root, id)).toBeTruthy());
  });

  it('re-lays out live when the font scale changes (no relaunch)', () => {
    const tree = render();
    fillValid(tree);
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('row');
    mockFontScale = 2;
    act(() => tree.update(<CreateProfileScreen />));
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('column');
  });
});

describe('Board geometry (phase2-open-items §3 B): the title', () => {
  const titleOf = (tree) => tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');

  // T-53 item 14 (Q1: the generator's step title). Was: phone 48/46 −0.055em
  // (CreateProfile board), tablet 60/60 −0.055em.
  it('phone: 46/44 700 −0.05em (the generator step title)', () => {
    const style = flat(titleOf(render()).props.style);
    expect(style).toMatchObject({ fontSize: 46, lineHeight: 44, letterSpacing: -2.3, fontFamily: 'Geist-Bold' });
    expect(style.fontWeight).toBeUndefined();
  });

  it('tablet: 60/60 700 −0.055em (TabletGenerator board)', () => {
    mockWidth = 834;
    const style = flat(titleOf(render()).props.style);
    expect(style).toMatchObject({ fontSize: 60, lineHeight: 60, letterSpacing: -3.3, fontFamily: 'Geist-Bold' });
    expect(style.fontWeight).toBeUndefined();
  });

  // T-53 item 15 (Q1, §5 "titles wrap, never truncate"). Was: 3 lines.
  it.each([
    ['phone', 390, 1],
    ['phone', 390, 3.1],
    ['tablet', 834, 1],
    ['tablet', 834, 3.1],
  ])('%s at fontScale %s: capped 1.3, 2 lines, wraps by word, shrinks a long word; no fixed height', (_, width, scale) => {
    mockWidth = width;
    mockFontScale = scale;
    const title = titleOf(render());
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: 1.3, numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.7, textBreakStrategy: 'simple' });
    expect(flat(title.props.style).height).toBeUndefined();
  });
});

// Dated changes 27 Oct 2026 (RN-SPEC-profile-create @ bdc7f348): D2 + S4
// pills (⚠P5), 409 continues (⚠P7), focus the first error (⚠P8), lock while
// submitting (⚠P9), editing clears its error (⚠P12), DOB/Sex errors (⚠P4).
const SHARED_SEX_OPTIONS = require('./createProfileForm').SEX_OPTIONS;
const Select = require('../../shared/components/Select').default;
// The pill's Pressable (it carries the accessibility state and onPress).
const isPill = (node) => node.props.accessibilityRole === 'radio' && node.props.accessibilityState && typeof node.props.onPress === 'function';
const sexPill = (tree, value) => tree.root.find((node) => node.props.testID === `profile-sex-${value}` && isPill(node));
const tapSex = (tree, value) => act(() => sexPill(tree, value).props.onPress());
const sexGroup = (tree) => tree.root.findAll((node) => node.props.accessibilityRole === 'radiogroup' && node.props.accessibilityLabel === 'Sex' && typeof node.type === 'string');
const sentBody = () => createProfile.mock.calls[0][0];
const composite = (root, id) => root.find((node) => node.props.testID === id && node.type === TextInput);
function spyFocus(tree, ids) {
  // The mocked TextInput's focus is one shared prototype mock: give each instance its own.
  return Object.fromEntries(
    ids.map((id) => {
      const spy = jest.fn();
      composite(tree.root, id).instance.focus = spy;
      return [id, spy];
    })
  );
}
const a11yFocusTargets = (spy) => spy.mock.calls.filter(([, event]) => event === 'focus').map(([node]) => node?.props?.testID);
// P4 with valid answers before it.
function toAboutStep(tree) {
  fillValid(tree);
  toAbout(tree);
}

// T-53 items 16–20 (onboarding ruling §3 P4, §5, D1): Create profile's Sex
// is a radiogroup of four pills (Male · Female · Other · Prefer not to say);
// nothing selected = "Not set" (null). Retires the ruling 7 Select tests
// (declared). Edit profile keeps its Select (profileV2.test.js).
describe('Sex is a radiogroup of four pills (T-53 §3 P4)', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  // T-53 item 16. Was: one Select labelled "Sex", no radio pills / radiogroup.
  it.each([
    ['ios', 390],
    ['android', 390],
    ['ios', 834],
    ['android', 834],
  ])('%s at %s: one radiogroup labelled "Sex" of radio pills, no Select', (os, width) => {
    Platform.OS = os;
    mockWidth = width;
    const tree = render();
    toAboutStep(tree);
    expect(sexGroup(tree)).toHaveLength(1);
    expect(sexGroup(tree)[0].findAll(isPill)).toHaveLength(4);
    expect(tree.root.findAll((node) => node.type === Select)).toHaveLength(0);
  });

  // T-53 item 17. Was: the Select options with "Not set" first, value '',
  // accessibilityValue "Not set".
  it('pills: Male · Female · Other · Prefer not to say (the shared list without "Not set"); none checked', () => {
    const tree = render();
    toAboutStep(tree);
    const pills = sexGroup(tree)[0].findAll(isPill);
    expect(pills.map((pill) => pill.props.accessibilityLabel)).toEqual(['Male', 'Female', 'Other', 'Prefer not to say']);
    expect(SHARED_SEX_OPTIONS.filter((option) => option.value !== '').map((option) => option.label)).toEqual(['Male', 'Female', 'Other', 'Prefer not to say']);
    pills.forEach((pill) => expect(pill.props.accessibilityState.checked).toBe(false));
  });

  // T-53 item 18: removed ("C2: the Sex Select has no placeholder"; there is no Select).

  // T-53 item 19. Was: Select onChange('prefer_not_to_say') / onChange('');
  // the payload is unchanged.
  it('payload unchanged: a pill is sent as its value; tapping the checked pill again = Not set (null)', async () => {
    createProfile.mockResolvedValue({ first_name: 'Asad' });
    const tree = render();
    toAboutStep(tree);
    tapSex(tree, 'prefer_not_to_say');
    expect(sexPill(tree, 'prefer_not_to_say').props.accessibilityState.checked).toBe(true);
    await submit(tree);
    expect(sentBody().sex).toBe('prefer_not_to_say');

    const notSet = render();
    toAboutStep(notSet);
    tapSex(notSet, 'female');
    tapSex(notSet, 'female');
    expect(sexPill(notSet, 'female').props.accessibilityState.checked).toBe(false);
    await submit(notSet);
    expect(createProfile.mock.calls[1][0].sex).toBeNull();
  });

  // T-53 item 20: removed ("tablet: the Select sits in the weight card"; no cards).
});

describe('409: continue to the app (⚠P7 retired)', () => {
  // T-53 item 21 (§0). Was: reset into the app right after the reload; now
  // the bridge, and the store commit (profileMissing false) at its press.
  it('reloads the profile (GET /profile), shows the bridge, and continues like a create', async () => {
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockResolvedValueOnce({ profile: { first_name: 'Existing' } });
    useAuthStore.setState({ profileMissing: true });
    const tree = render();
    toAboutStep(tree);
    await submit(tree);
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(useProfileStore.getState().profile).toEqual({ first_name: 'Existing' });
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(stepTitle(tree)).toBe('Want us to build your first plan?');
    press(tree, 'bridge-not-now');
    expect(useAuthStore.getState().profileMissing).toBe(false);
    expect(mockNavigation.reset).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
    expect(texts(tree.root)).not.toContain('A profile already exists for this account.');
  });

  it('a reload with no profile shows the message and stays, unlocked', async () => {
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockResolvedValueOnce({ profile: null });
    const tree = render();
    toAboutStep(tree);
    await submit(tree);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Something went wrong', 'A profile already exists for this account.']));
    // T-53 (setup): back to P1, where First Name lives.
    press(tree, 'profile-back');
    press(tree, 'profile-back');
    press(tree, 'profile-back');
    expect(textInput(tree.root, 'profile-first_name').props.editable).toBe(true);
  });

  // T-53 item 22. Was: First Name read-only during the reload and one reset
  // after it; P4 locks (the Date of Birth field) and the bridge follows.
  it('stays locked while the reload is in flight', async () => {
    const reload = deferred();
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockReturnValueOnce(reload.promise);
    const tree = render();
    toAboutStep(tree);
    await act(async () => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(host(tree.root, 'profile-date-of-birth-field').props.pointerEvents).toBe('none');
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalledTimes(1);
    await act(async () => reload.resolve({ profile: { first_name: 'Existing' } }));
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(stepTitle(tree)).toBe('Want us to build your first plan?');
  });
});

describe('editing a field clears its own error (⚠P12 retired)', () => {
  // T-53 item 23. Was: "Feet is required" also still shown (one form).
  it('first name clears only "First name is required"', () => {
    const tree = render();
    next(tree);
    type(tree, 'profile-first_name', 'A');
    const shown = texts(tree.root);
    expect(shown).not.toContain('First name is required');
    expect(shown).toContain('Last name is required');
    expect(textInput(tree.root, 'profile-first_name').props.accessibilityState).toEqual({ invalid: false });
    expect(textInput(tree.root, 'profile-last_name').props.accessibilityState).toEqual({ invalid: true });
  });

  it('any height input clears every height error; the unit switch too', () => {
    const tree = render();
    type(tree, 'profile-first_name', 'A');
    type(tree, 'profile-last_name', 'B');
    next(tree);
    type(tree, 'profile-height_inches', '12');
    next(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Feet is required', 'Inches must be between 0 and 11']));
    type(tree, 'profile-height_inches', '3');
    expect(texts(tree.root)).not.toEqual(expect.arrayContaining(['Feet is required']));
    expect(texts(tree.root)).not.toContain('Inches must be between 0 and 11');

    type(tree, 'profile-height_inches', '');
    press(tree, 'profile-height-unit-cm');
    next(tree);
    expect(texts(tree.root)).toContain('Height is required');
    press(tree, 'profile-height-unit-in');
    expect(texts(tree.root)).not.toContain('Height is required');
  });

  it('a weight clears its own error, not the other weight', () => {
    const tree = render();
    fillValid(tree);
    type(tree, 'profile-current_weight_value', '0');
    type(tree, 'profile-goal_weight_value', '0');
    next(tree);
    type(tree, 'profile-current_weight_value', '80');
    expect(texts(tree.root)).not.toContain('Current weight must be greater than zero');
    expect(texts(tree.root)).toContain('Goal weight must be greater than zero');
  });

  // T-53 item 24 (§4 422). Was: every message on one form; now the save
  // lands on P1 ("Too long"), and P4 shows "Bad date" / "Bad sex", each
  // clearing on its own change (a pill tap for Sex).
  it('server errors: Sex and Date of birth clear on their own change', async () => {
    createProfile.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Validation failed', errors: { date_of_birth: ['Bad date'], sex: ['Bad sex'], last_name: ['Too long'] } } },
    });
    const tree = render();
    toAboutStep(tree);
    await submit(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Too long', 'Validation failed']));
    next(tree);
    next(tree);
    next(tree);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Bad date', 'Bad sex']));
    tapSex(tree, 'male');
    expect(texts(tree.root)).not.toContain('Bad sex');
    expect(texts(tree.root)).toContain('Bad date');
    act(() => tree.root.find((node) => node.props.testID === 'profile-date-of-birth' && node.props.onChange).props.onChange('1990-09-21'));
    expect(texts(tree.root)).not.toContain('Bad date');
  });
});

describe('focus moves to the first field in error (⚠P8 retired)', () => {
  const P1_INPUTS = ['profile-first_name', 'profile-last_name'];
  const P2_INPUTS = ['profile-height_feet', 'profile-height_inches'];
  const focusedIds = (spies) => Object.keys(spies).filter((id) => spies[id].mock.calls.length > 0);

  // T-53 item 25 (§2 focus). Was: the 2nd submit focused Feet; now a valid
  // P1 moves to P2 with no field focused (the title takes the focus), and
  // Feet is focused by P2's failed Next.
  it('client errors: the first in step order, once per press, never while typing', () => {
    const tree = render();
    const spies = spyFocus(tree, P1_INPUTS);
    next(tree);
    expect(focusedIds(spies)).toEqual(['profile-first_name']);
    expect(spies['profile-first_name']).toHaveBeenCalledTimes(1);
    type(tree, 'profile-first_name', 'A');
    type(tree, 'profile-last_name', 'B');
    expect(spies['profile-first_name']).toHaveBeenCalledTimes(1);
    next(tree);
    expect(focusedIds(spies)).toEqual(['profile-first_name']);
    const p2 = spyFocus(tree, P2_INPUTS);
    expect(focusedIds(p2)).toEqual([]);
    next(tree);
    expect(p2['profile-height_feet']).toHaveBeenCalledTimes(1);
  });

  it('a feet error focuses Feet; an inches-only error focuses Inches', () => {
    const tree = render();
    toHeight(tree);
    type(tree, 'profile-height_feet', '5');
    type(tree, 'profile-height_inches', '12');
    const spies = spyFocus(tree, P2_INPUTS);
    next(tree);
    expect(focusedIds(spies)).toEqual(['profile-height_inches']);
  });

  it('cm: a height error focuses the Height input', () => {
    const tree = render();
    toHeight(tree);
    type(tree, 'profile-height_feet', '5');
    type(tree, 'profile-height_inches', '9');
    press(tree, 'profile-height-unit-cm');
    type(tree, 'profile-height_value', '');
    const spy = spyFocus(tree, ['profile-height_value'])['profile-height_value'];
    next(tree);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // T-53 item 26 (§4 422). Was: the same targets on the one form; now the
  // save lands on the owning step first (the shared focus mock records it).
  it.each([
    [{ height_unit: ['Height unit is required'] }, 'profile-height_feet', 'How tall are you?'],
    [{ height_value: ['The height value must be between 36 and 108 inches'] }, 'profile-height_feet', 'How tall are you?'],
    [{ goal_weight_value: ['Too heavy'], current_weight_value: ['Too light'] }, 'profile-current_weight_value', 'What do you weigh?'],
  ])('422 %j focuses %s on its step', async (errors, id, title) => {
    createProfile.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Validation failed', errors } } });
    const tree = render();
    toAboutStep(tree);
    const before = focusedTextIds().length;
    await submit(tree);
    expect(stepTitle(tree)).toBe(title);
    expect(focusedTextIds().slice(before)).toEqual([id]);
  });

  // T-53 item 27. Was: the same ids on the one form; the Weight unit label
  // is on P3 now, the date of birth + the pill group's wrapper on P4.
  it.each([
    [{ goal_weight_unit: ['Bad unit'], goal_weight_value: ['x'] }, 'profile-weight-unit-label'],
    [{ date_of_birth: ['Bad date'], sex: ['Bad sex'] }, 'profile-date-of-birth-field'],
    [{ sex: ['Bad sex'] }, 'profile-sex-field'],
  ])('422 %j moves accessibility focus to %s', async (errors, id) => {
    const a11y = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    createProfile.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Validation failed', errors } } });
    const tree = render();
    toAboutStep(tree);
    const before = focusedTextIds().length;
    await submit(tree);
    expect(a11yFocusTargets(a11y)).toEqual([id]);
    expect(focusedTextIds().slice(before)).toEqual([]);
    a11y.mockRestore();
  });

  it('brings the field into view (measured against the form, scrolled to it)', () => {
    const tree = render();
    toHeight(tree);
    const feet = composite(tree.root, 'profile-height_feet').instance;
    // Own mock: the prototype's measureLayout is shared by every instance.
    const measure = jest.fn((_relative, onSuccess) => onSuccess(0, 500));
    feet.measureLayout = measure;
    const scroll = tree.root.find((node) => node.props.testID === 'create-profile-screen' && node.instance && node.type !== 'RCTScrollView');
    const scrollTo = jest.fn();
    scroll.instance.scrollTo = scrollTo;
    next(tree);
    expect(measure).toHaveBeenCalledTimes(1);
    // 500 into the form + the phone top padding (47 inset + 24) − 16 above it.
    expect(scrollTo).toHaveBeenCalledWith({ y: 500 + 47 + spacing[6] - spacing[4], animated: false });
  });
});

describe('everything locks while submitting (⚠P9 retired)', () => {
  // T-53 item 29 (§3 P4 saving). Was: every field of the one form read-only,
  // the Sex Select and both unit switches locked; P4 holds the Date of
  // Birth + the Sex pills, and its Backs.
  it('P4: the date of birth, the pills, both Backs and the CTA are disabled; nothing edits; one request; all unlock on failure', async () => {
    const pending = deferred();
    createProfile.mockReturnValueOnce(pending.promise);
    const tree = render();
    toAboutStep(tree);
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(sexPill(tree, 'male').props.accessibilityState.disabled).toBe(true);
    expect(sexPill(tree, 'male').props.disabled).toBe(true);
    ['profile-date-of-birth-field', 'profile-sex-field'].forEach((id) => {
      expect(host(tree.root, id).props.pointerEvents).toBe('none');
      expect(flat(host(tree.root, id).props.style).opacity).toBe(0.5);
    });
    expect(tree.root.find((node) => node.props.testID === 'profile-back' && node.props.accessibilityState).props.accessibilityState.disabled).toBe(true);

    // Nothing edits, even if a handler fires.
    act(() => sexPill(tree, 'female').props.onPress());
    act(() => tree.root.find((node) => node.props.testID === 'profile-date-of-birth' && node.props.onChange).props.onChange('1990-09-21'));
    expect(sexPill(tree, 'female').props.accessibilityState.checked).toBe(false);
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalledTimes(1);

    await act(async () => pending.reject({ response: { status: 500, data: { message: 'Server down' } } }));
    expect(sexPill(tree, 'male').props.disabled).toBe(false);
    ['profile-date-of-birth-field', 'profile-sex-field'].forEach((id) => {
      expect(host(tree.root, id).props.pointerEvents).toBe('auto');
      expect(flat(host(tree.root, id).props.style)?.opacity).toBeUndefined();
    });
    tapSex(tree, 'female');
    expect(sexPill(tree, 'female').props.accessibilityState.checked).toBe(true);
  });

  // T-53 item 30. Was: the Sex check on the first render; the pills are on P4.
  it('a validation failure never locks', () => {
    const tree = render();
    next(tree);
    expect(textInput(tree.root, 'profile-first_name').props.editable).toBe(true);
    toAboutStep(tree);
    expect(sexPill(tree, 'male').props.disabled).toBe(false);
  });
});

describe('DOB and Sex server errors under their fields (⚠P4 narrowed)', () => {
  // T-53 item 31. Was: the Sex Select's box drew the error border; the error
  // now shows under the pill group (an alert), the banner titled "Please
  // check this answer".
  it('shows each first message under its own control; the banner says "Validation failed"', async () => {
    createProfile.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Validation failed', errors: { date_of_birth: ['Date of birth is invalid', 'second'], sex: ['Sex is invalid'] } } },
    });
    const tree = render();
    toAboutStep(tree);
    await submit(tree);
    const dob = host(tree.root, 'profile-date-of-birth-field');
    const sexField = host(tree.root, 'profile-sex-field');
    expect(dob.findAll((node) => node.type === 'Text').map(textOf)).toContain('Date of birth is invalid');
    expect(texts(tree.root)).not.toContain('second');
    expect(sexField.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'alert').map(textOf)).toEqual(['Sex is invalid']);
    expect(flat(pressable(tree.root, 'profile-date-of-birth').props.style).borderColor).toBe(colors.dangerText);
    const banner = host(tree.root, 'profile-error').findAll((node) => node.type === 'Text').map(textOf);
    expect(banner).toEqual(expect.arrayContaining(['Please check this answer', 'Validation failed']));
    expect(banner).not.toContain('Sex is invalid');
  });

  // T-53 item 32. Was: the Select box had no error border.
  it('no error: no message under either control', () => {
    const tree = render();
    toAboutStep(tree);
    expect(host(tree.root, 'profile-sex-field').findAll((node) => node.props.accessibilityRole === 'alert')).toHaveLength(0);
    expect(host(tree.root, 'profile-date-of-birth-field').findAll((node) => node.props.accessibilityRole === 'alert')).toHaveLength(0);
  });
});

// UX native final audit 27 Oct 2026, ruling 2 (row A101): the form scrolls
// under the status bar (no ShellPage), so the screen draws the backdrop.
describe('status-bar backdrop (UX native final audit 27 Oct 2026, ruling 2, A101)', () => {
  it.each([390, 834])('width %i: one backdrop, the top inset tall, fixed at the top, no touches', (width) => {
    mockWidth = width;
    const tree = render();
    const found = queryHost(tree.root, 'status-bar-backdrop');
    expect(found).toHaveLength(1);
    expect(flat(found[0].props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, height: 47 });
    expect(found[0].props.pointerEvents).toBe('none');
  });

  it('is drawn over the form scroll (after it in the screen root)', () => {
    const { ScrollView } = require('react-native');
    const StatusBarBackdrop = require('../shell/StatusBarBackdrop').default;
    const children = [].concat(host(render().root, 'create-profile-root').props.children).filter(Boolean);
    const scrollAt = children.findIndex((child) => child.type === ScrollView);
    expect(scrollAt).toBeGreaterThan(-1);
    expect(children.findIndex((child) => child.type === StatusBarBackdrop)).toBeGreaterThan(scrollAt);
  });
});

// UX native final audit 27 Oct 2026, batch k (PM, the batch g bug class): on
// an edge-to-edge Android window the raw keyboard height leaves out the nav
// bar under the IME, so the lift fell 48 short. The lift is what the keyboard
// COVERS (useKeyboardOverlap). Real geometry: Android phone, 48 nav bar,
// window 915 tall, the IME's top at 915 − 336 − 48 = 531 (overlap 384) while
// RN reports height 336.
describe('Android keyboard: the scroll padding clears the keyboard top (useKeyboardOverlap)', () => {
  const { Dimensions, Keyboard, Platform } = require('react-native');
  const ANDROID_WINDOW = { width: 412, height: 915, scale: 2.625, fontScale: 1 };
  const FRAME = { height: 336, screenY: 915 - 336 - 48 };
  const realOS = Platform.OS;
  let listeners;
  beforeEach(() => {
    Platform.OS = 'android';
    listeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
      listeners[name] = cb;
      return { remove: () => delete listeners[name] };
    });
    jest.spyOn(Dimensions, 'get').mockImplementation(() => ANDROID_WINDOW);
    jest.spyOn(Dimensions, 'addEventListener').mockImplementation(() => ({ remove: () => {} }));
  });
  afterEach(() => {
    Platform.OS = realOS;
    jest.restoreAllMocks();
  });

  // T-53 item 33 (§2 "the bar stays above the keyboard", Q4: the PM's
  // useKeyboardOverlap). Was: only the scroll padding; the bar also rides on
  // the keyboard now.
  // DECLARED (T-53 UX, PM OK 29 Oct) Was: "(padding = the 384 covered, not the raw 336)"; the padding now also clears the bar + 16.
  it('keyboard up: the content ends at or above the keyboard top (padding = the 384 covered + the bar + 16, not the raw 336); the bar sits on it', () => {
    mockWidth = ANDROID_WINDOW.width;
    const tree = render();
    act(() => listeners.keyboardDidShow({ endCoordinates: FRAME }));
    const padding = host(tree.root, 'create-profile-screen').props.contentContainerStyle.paddingBottom;
    expect(ANDROID_WINDOW.height - padding).toBeLessThanOrEqual(FRAME.screenY);
    // DECLARED (T-53 UX, PM OK 29 Oct) Was: toBe(384); 384 covered + the bar (0, unmeasured) + 16.
    expect(padding).toBe(400);
    expect(flat(host(tree.root, 'profile-cta-bar').props.style).bottom).toBe(384);
    act(() => listeners.keyboardDidHide());
    expect(host(tree.root, 'create-profile-screen').props.contentContainerStyle.paddingBottom).not.toBe(384);
    expect(flat(host(tree.root, 'profile-cta-bar').props.style).bottom).toBe(0);
  });
});

// UX ruling f1 (UX native final audit 27 Oct 2026, batch k): the labels wrap
// only at a word boundary (simple line breaking, never shrunk or cut to one
// line). T-53 Q3 (UX 29 Oct): Date of birth above the Sex pills at every width.
describe('f1: the Date of Birth + Sex pair stacks (T-53 Q3: at every width)', () => {
  const order = (pair) =>
    pair.findAll((node) => typeof node.type === 'string' && ['profile-date-of-birth-field', 'profile-sex'].includes(node.props.testID)).map((node) => node.props.testID);

  it('320: one column, both full width, DOB above Sex', () => {
    mockWidth = 320;
    const tree = render();
    toAboutStep(tree);
    const pair = host(tree.root, 'profile-dob-sex-pair');
    expect(flat(pair.props.style).flexDirection).toBe('column');
    pair.children.forEach((cell) => {
      const style = flat(cell.props.style) ?? {};
      expect(style.flex).toBeUndefined();
      expect(style.alignSelf ?? 'stretch').toBe('stretch');
    });
    expect(order(pair)[0]).toBe('profile-date-of-birth-field');
    expect(order(pair)).toContain('profile-sex');
  });

  // T-53 item 34 (Q3). Was: from 336 the side-by-side pair (row, flex 1).
  it.each([336, 390, 834])('%i: one column too, DOB above Sex', (width) => {
    mockWidth = width;
    const tree = render();
    toAboutStep(tree);
    const pair = host(tree.root, 'profile-dob-sex-pair');
    expect(flat(pair.props.style).flexDirection).toBe('column');
    pair.children.forEach((cell) => expect((flat(cell.props.style) ?? {}).flex).toBeUndefined());
    expect(order(pair)[0]).toBe('profile-date-of-birth-field');
  });

  it('the Date of Birth label breaks only between words', () => {
    mockWidth = 320;
    const tree = render();
    toAboutStep(tree);
    const label = tree.root.findAll((n) => n.type === 'Text' && textOf(n).startsWith('Date of Birth'))[0];
    expect(label.props.textBreakStrategy).toBe('simple');
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.adjustsFontSizeToFit).toBeUndefined();
  });
});

// PM FIX (27 Oct 2026, T-65 batch; Edit profile showed "78" for 178 lb at
// 320): Create profile's weight pair, the same check. Side by side at 320 ×
// 1.3 its 32/700 inputs had less room than 178 needs; where the pair has no
// room for a whole weight it stacks full width (390 keeps the pair).
describe('Create profile weights: the full value always shows (320, 1×/1.3×)', () => {
  const DIGIT_EM = 0.62;
  function textRoom(tree, width) {
    const pairStyle = flat(host(tree.root, 'profile-weights-pair').props.style);
    const column = width - 2 * 16;
    const stacked = pairStyle.flexDirection === 'column';
    const cellWidth = stacked ? column : (column - pairStyle.gap) / 2;
    const input = flat(textInput(tree.root, 'profile-current_weight_value').props.style);
    return { stacked, room: cellWidth - 2 - input.paddingLeft - input.paddingRight, fontSize: input.fontSize };
  }

  it.each([
    [320, 1],
    [320, 1.3],
    [390, 1],
    [390, 1.3],
  ])('%i at %s×: 178 / 170 have the room for every digit', (width, scale) => {
    mockWidth = width;
    mockFontScale = scale;
    const tree = render();
    fillValid(tree);
    type(tree, 'profile-current_weight_value', '178');
    type(tree, 'profile-goal_weight_value', '170');
    expect(textInput(tree.root, 'profile-current_weight_value').props.value).toBe('178');
    expect(textInput(tree.root, 'profile-goal_weight_value').props.value).toBe('170');
    const { room, fontSize } = textRoom(tree, width);
    expect(room).toBeGreaterThanOrEqual('178'.length * DIGIT_EM * fontSize * scale);
    expect(flat(textInput(tree.root, 'profile-current_weight_value').props.style).textAlign).not.toBe('right');
  });

  // 178 itself fit here (81 of room for 77); a decimal kept as typed (T-16), 178.5, did not. Same rule as Edit profile.
  it('320 at 1.3×: the pair stacks, room for 4 digits (178.5); 390 at 1×: side by side (unchanged)', () => {
    mockWidth = 320;
    mockFontScale = 1.3;
    const narrow = render();
    fillValid(narrow);
    type(narrow, 'profile-current_weight_value', '178.5');
    const { stacked, room, fontSize } = textRoom(narrow, 320);
    expect(stacked).toBe(true);
    expect(room).toBeGreaterThanOrEqual(4 * DIGIT_EM * fontSize * 1.3);
    mockWidth = 390;
    mockFontScale = 1;
    const wide = render();
    fillValid(wide);
    expect(textRoom(wide, 390).stacked).toBe(false);
  });
});

// T-53 UX (29 Oct 2026, as web): no cards around the P1/P2 groups; with the
// keyboard up the focused field scrolls above the pinned bar; the selected
// Sex pill is outlined (dark + gold border + ✓), not gold-filled.
describe('T-53 UX: no field cards, the keyboard clears the bar, the outlined Sex pill', () => {
  it('P1 names and P2 unit switch sit on the page (no border, no fill); Feet / Inches stay 2 columns', () => {
    const tree = render();
    const names = flat(host(tree.root, 'profile-section-names').props.style);
    expect(names.borderWidth).toBeUndefined();
    expect(names.backgroundColor).toBeUndefined();
    toHeight(tree);
    expect(flat(host(tree.root, 'profile-section-height-unit').props.style) ?? {}).toEqual({});
    expect(flat(host(tree.root, 'profile-height-pair').props.style).flexDirection).toBe('row');
  });

  describe('keyboard', () => {
    const { Keyboard } = require('react-native');
    let listeners;
    beforeEach(() => {
      listeners = {};
      jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
        listeners[name] = cb;
        return { remove: () => delete listeners[name] };
      });
    });
    afterEach(() => jest.restoreAllMocks());
    const ReactNative = require('react-native');

    it('the focused field scrolls above the keyboard + the bar + 16 (keyboard up, then a focus)', () => {
      jest.spyOn(ReactNative, 'findNodeHandle', 'get').mockReturnValue((ref) => (ref ? 99 : null));
      const tree = render();
      const scroll = tree.root.find((node) => node.props.testID === 'create-profile-screen' && node.instance && node.type !== 'RCTScrollView');
      const toKeyboard = jest.fn();
      scroll.instance.scrollResponderScrollNativeHandleToKeyboard = toKeyboard;
      act(() => host(tree.root, 'profile-cta-bar').props.onLayout({ nativeEvent: { layout: { width: 390, height: 110 } } }));
      act(() => textInput(tree.root, 'profile-first_name').props.onFocus());
      expect(toKeyboard).not.toHaveBeenCalled();
      act(() => listeners.keyboardWillShow({ endCoordinates: { height: 300, screenY: 544 } }));
      expect(toKeyboard).toHaveBeenLastCalledWith(99, 110 + 16, true);
      act(() => textInput(tree.root, 'profile-last_name').props.onFocus());
      expect(toKeyboard).toHaveBeenCalledTimes(2);
    });
  });

  it('the selected Sex pill: a dark fill, the gold border and a gold ✓ (not gold-filled); the rest unchanged', () => {
    const tree = render();
    toAboutStep(tree);
    tapSex(tree, 'female');
    const on = flat(sexPill(tree, 'female').props.style);
    expect(on).toMatchObject({ borderColor: colors.gold, borderWidth: 1.5, backgroundColor: colors.surfaceCard2 });
    expect(on.backgroundColor).not.toBe(colors.gold);
    const check = sexPill(tree, 'female').findAll((node) => node.props.testID === 'pill-check' && typeof node.type === 'string');
    expect(check).toHaveLength(1);
    expect(check[0].findAll((node) => node.props.stroke === colors.gold || node.props.color === colors.gold || node.props.fill === colors.gold).length).toBeGreaterThan(0);
    expect(flat(sexPill(tree, 'male').props.style).backgroundColor).not.toBe(colors.surfaceCard2);
  });
});
