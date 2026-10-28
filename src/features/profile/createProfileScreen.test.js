jest.mock('../auth/authService', () => ({ logout: jest.fn(), signOutDeletedAccount: jest.fn() }));
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), createProfile: jest.fn(), deleteAccount: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
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

function fillValid(tree) {
  type(tree, 'profile-first_name', ' Asad ');
  type(tree, 'profile-last_name', 'Khan');
  type(tree, 'profile-height_feet', '5');
  type(tree, 'profile-height_inches', '9');
}

describe('B1 height unit: a three-segment switch (ND1, PM 26 Oct)', () => {
  it('reads ft/in · cm · in (board order) and opens on ft/in', () => {
    expect(HEIGHT_UNITS.map((unit) => unit.label)).toEqual(['ft/in', 'cm', 'in']);
    expect(HEIGHT_UNITS.map((unit) => unit.value)).toEqual(['ft_in', 'cm', 'in']);
    const tree = render();
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
    HEIGHT_UNITS.forEach(({ testID }) => {
      const segment = pressable(tree.root, testID);
      expect(flat(segment.props.style).minHeight + segment.props.hitSlop.top + segment.props.hitSlop.bottom).toBeGreaterThanOrEqual(44);
    });
  });

  it('ft/in → cm converts as v1 (5 ft 9 in → 175.26), with the cm label, helper and placeholder', () => {
    const tree = render();
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
    press(tree, 'profile-height-unit-in');
    type(tree, 'profile-height_value', '71');
    press(tree, 'profile-height-unit-ft_in');
    expect(textInput(tree.root, 'profile-height_feet').props.value).toBe('5');
    expect(textInput(tree.root, 'profile-height_inches').props.value).toBe('11');
  });

  it('pressing the selected segment changes nothing', () => {
    const tree = render();
    type(tree, 'profile-height_feet', '6');
    press(tree, 'profile-height-unit-ft_in');
    expect(textInput(tree.root, 'profile-height_feet').props.value).toBe('6');
  });
});

describe('B1 weight unit: lb · kg switch with the "In {unit}." helper', () => {
  it('opens on lb; the helper and the unit suffix follow the switch', () => {
    expect(WEIGHT_UNITS.map((unit) => unit.value)).toEqual(['lb', 'kg']);
    const tree = render();
    expect(host(tree.root, 'profile-weight-unit').props.accessibilityLabel).toBe('Weight unit');
    expect(selected(tree, 'profile-weight-unit-lb')).toBe(true);
    expect(texts(tree.root).filter((line) => line === 'In lb.')).toHaveLength(2);
    expect(textOf(host(tree.root, 'profile-current_weight_value-unit').findByType('Text'))).toBe('lb');
    press(tree, 'profile-weight-unit-kg');
    expect(selected(tree, 'profile-weight-unit-kg')).toBe(true);
    expect(texts(tree.root).filter((line) => line === 'In kg.')).toHaveLength(2);
    expect(textOf(host(tree.root, 'profile-goal_weight_value-unit').findByType('Text'))).toBe('kg');
  });

  it('sends the chosen unit beside a filled weight only (O5)', async () => {
    createProfile.mockResolvedValueOnce({ first_name: 'Asad' });
    const tree = render();
    fillValid(tree);
    press(tree, 'profile-weight-unit-kg');
    type(tree, 'profile-current_weight_value', '83,5');
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
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
  it('the title reads "Create Profile" (code copy), the second word gold', () => {
    const tree = render();
    const title = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(title.props.accessibilityLabel).toBe('Create Profile');
    expect(textOf(title)).toBe('Create\nProfile');
    const gold = title.find((node) => node.type === 'Text' && node !== title);
    expect(flat(gold.props.style).color).toBe(colors.gold);
  });

  it('pins "Create profile" (60, cta) and Delete account in the bottom bar; the scroll leaves room for it', () => {
    const tree = render();
    const bar = host(tree.root, 'profile-cta-bar');
    expect(flat(bar.props.style)).toMatchObject({ position: 'absolute', bottom: 0, paddingBottom: 34 + 30 });
    expect(queryHost(bar, 'profile-submit')).toHaveLength(1);
    expect(flat(host(bar, 'profile-submit').props.style).minHeight).toBe(60);
    act(() => bar.props.onLayout({ nativeEvent: { layout: { width: 390, height: 170 } } }));
    expect(host(tree.root, 'create-profile-screen').props.contentContainerStyle.paddingBottom).toBe(170 + 16);
  });

  it('numbers are 64 tall (62 + the 1 px border) at 32/700 tabular', () => {
    const tree = render();
    // C2 (verdict b7a7867): the value style shows once there is a value.
    ['profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'].forEach((id) => type(tree, id, '7'));
    ['profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'].forEach((id) => {
      const style = flat(textInput(tree.root, id).props.style);
      expect(style).toMatchObject({ minHeight: 62, fontSize: 32, fontFamily: 'Geist-Bold', fontVariant: ['tabular-nums'] });
      expect(style.fontWeight).toBeUndefined();
    });
    // Names keep the kit size.
    expect(flat(textInput(tree.root, 'profile-first_name').props.style).minHeight).toBe(50);
  });

  it('the height switch stretches across its card; weight unit is compact 64-wide segments', () => {
    const tree = render();
    expect(flat(host(tree.root, 'profile-height-unit').props.style).alignSelf).toBe('stretch');
    const lb = flat(pressable(tree.root, 'profile-weight-unit-lb').props.style);
    expect(lb).toMatchObject({ minHeight: 34, minWidth: 64 });
  });

  it('every text input has the gold caret and selection', () => {
    const tree = render();
    const inputs = tree.root.findAll((node) => node.type === 'TextInput');
    expect(inputs.length).toBeGreaterThanOrEqual(6);
    inputs.forEach((node) => {
      expect(node.props.selectionColor).toBe(colors.gold);
      expect(node.props.cursorColor).toBe(colors.gold);
    });
  });
});

// C2 (UX verdict b7a7867): an empty number field draws in the placeholder
// look (text-faint, 400, the kit's 16) so "5" / "82.5" never read as values;
// the big 32/700 value style starts with the first character.
const PHONE_NUMBERS = ['profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'];
describe('C2 placeholders never wear the value style', () => {
  it('phone: empty numbers are text-faint 400 at the kit body size, not 32/700; still 62 min tall', () => {
    const tree = render();
    PHONE_NUMBERS.forEach((id) => {
      const node = textInput(tree.root, id);
      const style = flat(node.props.style);
      expect(node.props.value).toBe('');
      expect(node.props.placeholderTextColor).toBe(colors.textFaint);
      expect(style).toMatchObject({ fontFamily: 'Geist-Regular', fontSize: typography.bodyLg.fontSize, color: colors.textFaint, minHeight: 62 });
      expect(style.fontSize).not.toBe(32);
      expect(style.fontVariant).toBeUndefined();
      expect(style.letterSpacing).toBeUndefined();
      expect(style.fontWeight).toBeUndefined();
    });
  });

  it('phone: a typed value switches to the 32/700 value style; clearing it switches back', () => {
    const tree = render();
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
    PHONE_NUMBERS.forEach((id) => {
      const node = textInput(tablet.root, id);
      expect(node.props.placeholderTextColor).toBe(colors.textFaint);
      const style = flat(node.props.style);
      expect(style).toMatchObject({ fontFamily: 'Geist-Regular', fontSize: typography.bodyLg.fontSize, minHeight: 50 });
      expect(style.fontSize).not.toBe(32);
    });
    type(tablet, 'profile-height_feet', '5');
    expect(flat(textInput(tablet.root, 'profile-height_feet').props.style).fontSize).toBe(typography.bodyLg.fontSize);
  });

  it('only the single Height field has a placeholder, as on web (180 cm / 71 in)', () => {
    const tree = render();
    for (const id of ['first_name', 'last_name', 'height_feet', 'height_inches', 'current_weight_value', 'goal_weight_value']) {
      expect(textInput(tree.root, `profile-${id}`).props.placeholder).toBeUndefined();
    }
    press(tree, 'profile-height-unit-cm');
    expect(textInput(tree.root, 'profile-height_value').props.placeholder).toBe('180');
    expect(PROFILE_PLACEHOLDERS.height_cm).toBe('180');
    press(tree, 'profile-height-unit-in');
    expect(textInput(tree.root, 'profile-height_value').props.placeholder).toBe('71');
  });
});

describe('B1 tablet layout (≥ 768)', () => {
  beforeEach(() => {
    mockWidth = 834;
  });

  it('two cards in a 640 column, the brand row, no sticky bar', () => {
    const tree = render();
    expect(flat(host(tree.root, 'create-profile-form').props.style)).toMatchObject({ maxWidth: 640, alignSelf: 'center' });
    expect(queryHost(tree.root, 'profile-cta-bar')).toHaveLength(0);
    const body = host(tree.root, 'profile-card-body');
    const weight = host(tree.root, 'profile-card-weight');
    expect(body.findAll((node) => node.props.testID === 'profile-height-unit' && typeof node.type === 'string')).toHaveLength(1);
    expect(weight.findAll((node) => node.props.testID === 'profile-weight-unit' && typeof node.type === 'string')).toHaveLength(1);
    expect(weight.findAll((node) => node.props.testID === 'profile-sex' && node.props.onChange)).toHaveLength(1);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Gymido', 'Create Profile']));
  });

  it('CTA inline at the end; Delete account 40 below it', () => {
    const tree = render();
    const action = host(tree.root, 'delete-account-action');
    expect([].concat(action.props.style)).toEqual(expect.arrayContaining([{ marginTop: 40 }]));
    const shown = texts(tree.root);
    expect(shown.indexOf('Delete account')).toBeGreaterThan(shown.indexOf('Create profile'));
  });

  it('switch segments are 96 (height) and 72 (weight) wide; numbers keep the kit 52', () => {
    const tree = render();
    expect(flat(pressable(tree.root, 'profile-height-unit-cm').props.style).minWidth).toBe(96);
    expect(flat(pressable(tree.root, 'profile-weight-unit-kg').props.style)).toMatchObject({ minWidth: 72, minHeight: 40 });
    expect(flat(textInput(tree.root, 'profile-height_feet').props.style).minHeight).toBe(50);
  });
});

describe('B1 behaviour unchanged (v1)', () => {
  it('validates on submit only, with v1 messages, and sends nothing', () => {
    const tree = render();
    expect(texts(tree.root)).not.toContain('First name is required');
    press(tree, 'profile-submit');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['First name is required', 'Last name is required', 'Feet is required']));
    expect(createProfile).not.toHaveBeenCalled();
    expect(textInput(tree.root, 'profile-first_name').props.accessibilityState).toEqual({ invalid: true });
  });

  it('inches past 11 and a zero weight are refused', () => {
    const tree = render();
    fillValid(tree);
    type(tree, 'profile-height_inches', '12');
    type(tree, 'profile-goal_weight_value', '0');
    press(tree, 'profile-submit');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Inches must be between 0 and 11', 'Goal weight must be greater than zero']));
  });

  it('cm: an empty height is refused with "Height is required"', () => {
    const tree = render();
    fillValid(tree);
    press(tree, 'profile-height-unit-cm');
    type(tree, 'profile-height_value', '');
    press(tree, 'profile-submit');
    expect(texts(tree.root)).toContain('Height is required');
  });

  it('submitting: the CTA is busy and Delete account disabled; one request', async () => {
    const pending = deferred();
    createProfile.mockReturnValueOnce(pending.promise);
    const tree = render();
    fillValid(tree);
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalledTimes(1);
    const button = tree.root.find((node) => node.props.testID === 'profile-submit' && node.props.accessibilityState);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(tree.root.find((node) => node.props.testID === 'delete-account-open' && node.props.onPress).props.disabled).toBe(true);
    await act(async () => pending.reject({ response: { status: 500, data: { message: 'Server down' } } }));
  });

  it('success: stores the profile and resets into the app', async () => {
    createProfile.mockResolvedValueOnce({ first_name: 'Asad' });
    const tree = render();
    fillValid(tree);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
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
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Something went wrong', 'A profile already exists for this account.']));
  });

  it("422: the server's field errors show under their fields", async () => {
    createProfile.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Validation failed', errors: { first_name: ['Too long'], height_value: 'Bad height' } } },
    });
    const tree = render();
    fillValid(tree);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Validation failed', 'Too long', 'Bad height']));
    expect(tree.root.find((node) => node.props.testID === 'profile-submit' && node.props.accessibilityState).props.accessibilityState.disabled).toBe(false);
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
    ['First Name', 'Last Name', 'Height unit', 'Feet', 'Inches', 'Weight unit'].forEach((label) => {
      expect(flat(labelText(tree.root, label).props.style).color).toBe(colors.textStrong2);
    });
    // Date of Birth and Sex carry the "(optional)" suffix inside the label.
    ['Date of Birth', 'Sex'].forEach((label) => {
      const node = tree.root.findAll((n) => n.type === 'Text' && textOf(n).startsWith(label))[0];
      expect(flat(node.props.style).color).toBe(colors.textStrong2);
    });
  });

  it('tablet: both segmented tracks are surface-well (UX §8.3); phone keeps the surface track', () => {
    const phone = render();
    expect(flat(host(phone.root, 'profile-height-unit').props.style).backgroundColor).toBe(colors.surface);
    mockWidth = 834;
    const tablet = render();
    expect(flat(host(tablet.root, 'profile-height-unit').props.style).backgroundColor).toBe(colors.surfaceWell);
    expect(flat(host(tablet.root, 'profile-weight-unit').props.style).backgroundColor).toBe(colors.surfaceWell);
  });
});

describe('§9 large text', () => {
  const title = (tree) => tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');

  it.each([
    ['phone', 390],
    ['tablet', 834],
  ])('%s caps: the title 1.3 (3 lines, shrinks a long word), subtitle and inputs 2.0', (_, width) => {
    mockWidth = width;
    const tree = render();
    expect(title(tree).props).toMatchObject({ maxFontSizeMultiplier: 1.3, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    expect(labelText(tree.root, 'A quick setup so we can tailor your workout plan.').props.maxFontSizeMultiplier).toBe(2);
    expect(labelText(tree.root, 'Weight unit').props.maxFontSizeMultiplier).toBe(2);
    ['profile-first_name', 'profile-height_feet', 'profile-current_weight_value'].forEach((id) => {
      expect(textInput(tree.root, id).props.maxFontSizeMultiplier).toBe(2);
    });
  });

  it('tablet: the G in its fixed tile caps at 1.2', () => {
    mockWidth = 834;
    const tree = render();
    expect(labelText(tree.root, 'G').props.maxFontSizeMultiplier).toBe(1.2);
  });

  it('phone numbers grow from min 62 (never a fixed height that clips scaled digits)', () => {
    mockFontScale = 2;
    const tree = render();
    const style = flat(textInput(tree.root, 'profile-height_feet').props.style);
    expect(style.minHeight).toBe(62);
    expect(style.height).toBeUndefined();
  });

  it.each([
    ['phone', 390, 'profile-section-names'],
    ['tablet', 834, 'profile-names-pair'],
  ])('%s at fontScale 1: the 2-column pairs and the unit row sit side by side', (_, width, names) => {
    mockWidth = width;
    const tree = render();
    expect(flat(host(tree.root, names).props.style).flexDirection).toBe('row');
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
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('column');
    expect(flat(host(tree.root, 'profile-height-pair').props.style).flexDirection).toBe('column');
    expect(flat(host(tree.root, 'profile-weight-unit-row').props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    // Every field and both actions are still there.
    ['profile-first_name', 'profile-last_name', 'profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'].forEach((id) =>
      expect(textInput(tree.root, id)).toBeTruthy()
    );
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Create profile', 'Delete account']));
  });

  it('re-lays out live when the font scale changes (no relaunch)', () => {
    const tree = render();
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('row');
    mockFontScale = 2;
    act(() => tree.update(<CreateProfileScreen />));
    expect(flat(host(tree.root, 'profile-weights-pair').props.style).flexDirection).toBe('column');
  });
});

describe('Board geometry (phase2-open-items §3 B): the title', () => {
  const titleOf = (tree) => tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');

  it('phone: 48/46 700 −0.055em (CreateProfile board)', () => {
    const style = flat(titleOf(render()).props.style);
    expect(style).toMatchObject({ fontSize: 48, lineHeight: 46, letterSpacing: -2.64, fontFamily: 'Geist-Bold' });
    expect(style.fontWeight).toBeUndefined();
  });

  it('tablet: 60/60 700 −0.055em (TabletCreateProfile board)', () => {
    mockWidth = 834;
    const style = flat(titleOf(render()).props.style);
    expect(style).toMatchObject({ fontSize: 60, lineHeight: 60, letterSpacing: -3.3, fontFamily: 'Geist-Bold' });
    expect(style.fontWeight).toBeUndefined();
  });

  it.each([
    ['phone', 390, 1],
    ['phone', 390, 3.1],
    ['tablet', 834, 1],
    ['tablet', 834, 3.1],
  ])('%s at fontScale %s: capped 1.3, 3 lines, shrinks a long word; no fixed height', (_, width, scale) => {
    mockWidth = width;
    mockFontScale = scale;
    const title = titleOf(render());
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: 1.3, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    expect(flat(title.props.style).height).toBeUndefined();
  });
});

// Dated changes 27 Oct 2026 (RN-SPEC-profile-create @ bdc7f348): D2 + S4
// pills (⚠P5), 409 continues (⚠P7), focus the first error (⚠P8), lock while
// submitting (⚠P9), editing clears its error (⚠P12), DOB/Sex errors (⚠P4).
// The Select's drawn box (the opener's only child View).
const sexBox = (tree) => pressable(tree.root, 'profile-sex').findAll((node) => node.type === 'View' && node.props.pointerEvents === 'none')[0];
// Ruling 7: the kit Select and the one shared Sex list (createProfileForm).
const Select = require('../../shared/components/Select').default;
const SHARED_SEX_OPTIONS = require('./createProfileForm').SEX_OPTIONS;
const sexSelect = (tree) => tree.root.find((node) => node.props.testID === 'profile-sex' && Array.isArray(node.props.options));
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

// UX native final audit 27 Oct 2026, ruling 7 (row A99): Create profile's Sex
// is a Select with "Not set" first, the same options Edit profile uses; no
// five-pill row on any device. Retires the S4 pills tests (declared).
describe('Sex is a Select with "Not set" first (UX final audit ruling 7)', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  it.each([
    ['ios', 390],
    ['android', 390],
    ['ios', 834],
    ['android', 834],
  ])('%s at %s: one Select labelled "Sex", no radio pills', (os, width) => {
    Platform.OS = os;
    mockWidth = width;
    const tree = render();
    expect(sexSelect(tree).type).toBe(Select);
    expect(sexSelect(tree).props.label).toBe('Sex');
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'radiogroup' && node.props.accessibilityLabel === 'Sex' && typeof node.type === 'string')).toHaveLength(0);
    expect(queryHost(tree.root, 'profile-sex-none')).toHaveLength(0);
  });

  it('options: Not set · Male · Female · Other · Prefer not to say, the shared list Edit profile uses too; Not set shown', () => {
    const tree = render();
    expect(sexSelect(tree).props.options).toBe(SHARED_SEX_OPTIONS);
    expect(sexSelect(tree).props.options.map((option) => [option.value, option.label])).toEqual([
      ['', 'Not set'],
      ['male', 'Male'],
      ['female', 'Female'],
      ['other', 'Other'],
      ['prefer_not_to_say', 'Prefer not to say'],
    ]);
    expect(sexSelect(tree).props.value).toBe('');
    expect(pressable(tree.root, 'profile-sex').props.accessibilityValue).toEqual({ text: 'Not set' });
  });

  it('C2: the Sex Select has no placeholder', () => {
    const tree = render();
    expect(sexSelect(tree).props.placeholder).toBeUndefined();
  });

  it('payload unchanged: a choice is sent as its value; Not set is sent as null (like Edit profile)', async () => {
    createProfile.mockResolvedValue({ first_name: 'Asad' });
    const tree = render();
    fillValid(tree);
    act(() => sexSelect(tree).props.onChange('prefer_not_to_say'));
    expect(pressable(tree.root, 'profile-sex').props.accessibilityValue).toEqual({ text: 'Prefer not to say' });
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(sentBody().sex).toBe('prefer_not_to_say');

    const notSet = render();
    fillValid(notSet);
    act(() => sexSelect(notSet).props.onChange('female'));
    act(() => sexSelect(notSet).props.onChange(''));
    await act(async () => pressable(notSet.root, 'profile-submit').props.onPress());
    expect(createProfile.mock.calls[1][0].sex).toBeNull();
  });

  it('tablet: the Select sits in the weight card', () => {
    mockWidth = 834;
    const tree = render();
    const card = host(tree.root, 'profile-card-weight');
    expect(card.findAll((node) => node.props.testID === 'profile-sex' && node.type === Select)).toHaveLength(1);
  });
});

describe('409: continue to the app (⚠P7 retired)', () => {
  it('reloads the profile (GET /profile) and resets into the app like a create', async () => {
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockResolvedValueOnce({ profile: { first_name: 'Existing' } });
    useAuthStore.setState({ profileMissing: true });
    const tree = render();
    fillValid(tree);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(useProfileStore.getState().profile).toEqual({ first_name: 'Existing' });
    expect(useAuthStore.getState().profileMissing).toBe(false);
    expect(mockNavigation.reset).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
    expect(texts(tree.root)).not.toContain('A profile already exists for this account.');
  });

  it('a reload with no profile shows the message and stays, unlocked', async () => {
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockResolvedValueOnce({ profile: null });
    const tree = render();
    fillValid(tree);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Something went wrong', 'A profile already exists for this account.']));
    expect(textInput(tree.root, 'profile-first_name').props.editable).toBe(true);
  });

  it('stays locked while the reload is in flight', async () => {
    const reload = deferred();
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    getProfile.mockReturnValueOnce(reload.promise);
    const tree = render();
    fillValid(tree);
    await act(async () => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(textInput(tree.root, 'profile-first_name').props.editable).toBe(false);
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalledTimes(1);
    await act(async () => reload.resolve({ profile: { first_name: 'Existing' } }));
    expect(mockNavigation.reset).toHaveBeenCalledTimes(1);
  });
});

describe('editing a field clears its own error (⚠P12 retired)', () => {
  it('first name clears only "First name is required"', () => {
    const tree = render();
    press(tree, 'profile-submit');
    type(tree, 'profile-first_name', 'A');
    const shown = texts(tree.root);
    expect(shown).not.toContain('First name is required');
    expect(shown).toEqual(expect.arrayContaining(['Last name is required', 'Feet is required']));
    expect(textInput(tree.root, 'profile-first_name').props.accessibilityState).toEqual({ invalid: false });
    expect(textInput(tree.root, 'profile-last_name').props.accessibilityState).toEqual({ invalid: true });
  });

  it('any height input clears every height error; the unit switch too', () => {
    const tree = render();
    type(tree, 'profile-first_name', 'A');
    type(tree, 'profile-last_name', 'B');
    type(tree, 'profile-height_inches', '12');
    press(tree, 'profile-submit');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Feet is required', 'Inches must be between 0 and 11']));
    type(tree, 'profile-height_inches', '3');
    expect(texts(tree.root)).not.toEqual(expect.arrayContaining(['Feet is required']));
    expect(texts(tree.root)).not.toContain('Inches must be between 0 and 11');

    type(tree, 'profile-height_inches', '');
    press(tree, 'profile-height-unit-cm');
    press(tree, 'profile-submit');
    expect(texts(tree.root)).toContain('Height is required');
    press(tree, 'profile-height-unit-in');
    expect(texts(tree.root)).not.toContain('Height is required');
  });

  it('a weight clears its own error, not the other weight', () => {
    const tree = render();
    fillValid(tree);
    type(tree, 'profile-current_weight_value', '0');
    type(tree, 'profile-goal_weight_value', '0');
    press(tree, 'profile-submit');
    type(tree, 'profile-current_weight_value', '80');
    expect(texts(tree.root)).not.toContain('Current weight must be greater than zero');
    expect(texts(tree.root)).toContain('Goal weight must be greater than zero');
  });

  it('server errors: Sex and Date of birth clear on their own change', async () => {
    createProfile.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Validation failed', errors: { date_of_birth: ['Bad date'], sex: ['Bad sex'], last_name: ['Too long'] } } },
    });
    const tree = render();
    fillValid(tree);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    act(() => sexSelect(tree).props.onChange('male'));
    expect(texts(tree.root)).not.toContain('Bad sex');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Bad date', 'Too long', 'Validation failed']));
    act(() => tree.root.find((node) => node.props.testID === 'profile-date-of-birth' && node.props.onChange).props.onChange('1990-09-21'));
    expect(texts(tree.root)).not.toContain('Bad date');
    expect(texts(tree.root)).toContain('Too long');
  });
});

describe('focus moves to the first field in error (⚠P8 retired)', () => {
  const INPUTS = ['profile-first_name', 'profile-last_name', 'profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'];
  const focusedIds = (spies) => Object.keys(spies).filter((id) => spies[id].mock.calls.length > 0);

  it('client errors: the first in form order, once per submit, never while typing', () => {
    const tree = render();
    const spies = spyFocus(tree, INPUTS);
    press(tree, 'profile-submit');
    expect(focusedIds(spies)).toEqual(['profile-first_name']);
    expect(spies['profile-first_name']).toHaveBeenCalledTimes(1);
    type(tree, 'profile-first_name', 'A');
    type(tree, 'profile-last_name', 'B');
    expect(spies['profile-first_name']).toHaveBeenCalledTimes(1);
    press(tree, 'profile-submit');
    expect(spies['profile-height_feet']).toHaveBeenCalledTimes(1);
  });

  it('a feet error focuses Feet; an inches-only error focuses Inches', () => {
    const tree = render();
    fillValid(tree);
    type(tree, 'profile-height_inches', '12');
    const spies = spyFocus(tree, INPUTS);
    press(tree, 'profile-submit');
    expect(focusedIds(spies)).toEqual(['profile-height_inches']);
  });

  it('cm: a height error focuses the Height input', () => {
    const tree = render();
    fillValid(tree);
    press(tree, 'profile-height-unit-cm');
    type(tree, 'profile-height_value', '');
    const spy = spyFocus(tree, ['profile-height_value'])['profile-height_value'];
    press(tree, 'profile-submit');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ height_unit: ['Height unit is required'] }, 'profile-height_feet'],
    [{ height_value: ['The height value must be between 36 and 108 inches'] }, 'profile-height_feet'],
    [{ goal_weight_value: ['Too heavy'], current_weight_value: ['Too light'] }, 'profile-current_weight_value'],
  ])('422 %j focuses %s', async (errors, id) => {
    createProfile.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Validation failed', errors } } });
    const tree = render();
    fillValid(tree);
    const spies = spyFocus(tree, INPUTS);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(focusedIds(spies)).toEqual([id]);
  });

  it.each([
    [{ goal_weight_unit: ['Bad unit'], goal_weight_value: ['x'] }, 'profile-weight-unit-label'],
    [{ date_of_birth: ['Bad date'], sex: ['Bad sex'] }, 'profile-date-of-birth-field'],
    [{ sex: ['Bad sex'] }, 'profile-sex-field'],
  ])('422 %j moves accessibility focus to %s', async (errors, id) => {
    const a11y = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    createProfile.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Validation failed', errors } } });
    const tree = render();
    fillValid(tree);
    const spies = spyFocus(tree, INPUTS);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    expect(a11yFocusTargets(a11y)).toEqual([id]);
    expect(focusedIds(spies)).toEqual([]);
    a11y.mockRestore();
  });

  it('brings the field into view (measured against the form, scrolled to it)', () => {
    const tree = render();
    const feet = composite(tree.root, 'profile-height_feet').instance;
    // Own mock: the prototype's measureLayout is shared by every instance.
    const measure = jest.fn((_relative, onSuccess) => onSuccess(0, 500));
    feet.measureLayout = measure;
    const scroll = tree.root.find((node) => node.props.testID === 'create-profile-screen' && node.instance && node.type !== 'RCTScrollView');
    const scrollTo = jest.fn();
    scroll.instance.scrollTo = scrollTo;
    type(tree, 'profile-first_name', 'A');
    type(tree, 'profile-last_name', 'B');
    press(tree, 'profile-submit');
    expect(measure).toHaveBeenCalledTimes(1);
    // 500 into the form + the phone top padding (47 inset + 24) − 16 above it.
    expect(scrollTo).toHaveBeenCalledWith({ y: 500 + 47 + spacing[6] - spacing[4], animated: false });
  });
});

describe('everything locks while submitting (⚠P9 retired)', () => {
  it('fields, pills, unit switches and the CTA are disabled; nothing edits; one request; all unlock on failure', async () => {
    const pending = deferred();
    createProfile.mockReturnValueOnce(pending.promise);
    const tree = render();
    fillValid(tree);
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    ['profile-first_name', 'profile-last_name', 'profile-height_feet', 'profile-height_inches', 'profile-current_weight_value', 'profile-goal_weight_value'].forEach((id) =>
      expect(textInput(tree.root, id).props.editable).toBe(false)
    );
    expect(pressable(tree.root, 'profile-sex').props.accessibilityState.disabled).toBe(true);
    expect(pressable(tree.root, 'profile-sex').props.disabled).toBe(true);
    ['profile-height-unit-lock', 'profile-weight-unit-lock', 'profile-date-of-birth-field', 'profile-sex-field'].forEach((id) => {
      expect(host(tree.root, id).props.pointerEvents).toBe('none');
      expect(flat(host(tree.root, id).props.style).opacity).toBe(0.5);
    });

    // Nothing edits, even if a handler fires.
    type(tree, 'profile-first_name', 'Changed');
    act(() => sexSelect(tree).props.onChange('female'));
    press(tree, 'profile-height-unit-cm');
    press(tree, 'profile-weight-unit-kg');
    act(() => tree.root.find((node) => node.props.testID === 'profile-date-of-birth' && node.props.onChange).props.onChange('1990-09-21'));
    expect(textInput(tree.root, 'profile-first_name').props.value).toBe(' Asad ');
    expect(sexSelect(tree).props.value).toBe('');
    expect(selected(tree, 'profile-height-unit-ft_in')).toBe(true);
    expect(selected(tree, 'profile-weight-unit-lb')).toBe(true);
    act(() => {
      textInput(tree.root, 'profile-goal_weight_value').props.onSubmitEditing();
    });
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalledTimes(1);

    await act(async () => pending.reject({ response: { status: 500, data: { message: 'Server down' } } }));
    expect(textInput(tree.root, 'profile-first_name').props.editable).toBe(true);
    expect(pressable(tree.root, 'profile-sex').props.disabled).toBe(false);
    ['profile-height-unit-lock', 'profile-weight-unit-lock', 'profile-date-of-birth-field', 'profile-sex-field'].forEach((id) => {
      expect(host(tree.root, id).props.pointerEvents).toBe('auto');
      expect(flat(host(tree.root, id).props.style)?.opacity).toBeUndefined();
    });
    act(() => sexSelect(tree).props.onChange('female'));
    expect(sexSelect(tree).props.value).toBe('female');
  });

  it('a validation failure never locks', () => {
    const tree = render();
    press(tree, 'profile-submit');
    expect(textInput(tree.root, 'profile-first_name').props.editable).toBe(true);
    expect(pressable(tree.root, 'profile-sex').props.disabled).toBe(false);
  });
});

describe('DOB and Sex server errors under their fields (⚠P4 narrowed)', () => {
  it('shows each first message under its own control, with the error border; the banner says "Validation failed"', async () => {
    createProfile.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Validation failed', errors: { date_of_birth: ['Date of birth is invalid', 'second'], sex: ['Sex is invalid'] } } },
    });
    const tree = render();
    fillValid(tree);
    await act(async () => pressable(tree.root, 'profile-submit').props.onPress());
    const dob = host(tree.root, 'profile-date-of-birth-field');
    const sexField = host(tree.root, 'profile-sex-field');
    expect(dob.findAll((node) => node.type === 'Text').map(textOf)).toContain('Date of birth is invalid');
    expect(texts(tree.root)).not.toContain('second');
    expect(sexField.findAll((node) => node.type === 'Text').map(textOf)).toContain('Sex is invalid');
    expect(flat(sexBox(tree).props.style).borderColor).toBe(colors.dangerText);
    expect(flat(pressable(tree.root, 'profile-date-of-birth').props.style).borderColor).toBe(colors.dangerText);
    expect(host(tree.root, 'profile-error').findAll((node) => node.type === 'Text').map(textOf)).toContain('Validation failed');
    expect(host(tree.root, 'profile-error').findAll((node) => node.type === 'Text').map(textOf)).not.toContain('Sex is invalid');
  });

  it('no error: no message under either control and the Sex box has no error border', () => {
    const tree = render();
    expect(flat(sexBox(tree).props.style).borderColor).not.toBe(colors.dangerText);
    expect(host(tree.root, 'profile-sex-field').findAll((node) => node.props.accessibilityRole === 'alert')).toHaveLength(0);
  });
});
