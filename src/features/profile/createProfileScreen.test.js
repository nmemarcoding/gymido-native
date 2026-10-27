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

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useAuthStore } from '../auth/authStore';
import { colors } from '../../shared/theme/tokens';
import CreateProfileScreen, { HEIGHT_UNITS, WEIGHT_UNITS } from './CreateProfileScreen';
import { createProfile } from './api/profileApi';
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

  it('409: "A profile already exists for this account."', async () => {
    createProfile.mockRejectedValueOnce({ response: { status: 409, data: {} } });
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
