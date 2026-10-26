jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../auth/authService', () => ({ logout: jest.fn() }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./CoachingCard', () => () => null);
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), updateProfile: jest.fn(), sendPasswordResetEmail: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const mockNavigation = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { AccessibilityInfo } from 'react-native';
import { act, create } from 'react-test-renderer';

import { routes } from '../../navigation/routes';
import { logout } from '../auth/authService';
import { useAuthStore } from '../auth/authStore';
import { openShellPath } from '../shell/shellLinks';
import { sendPasswordResetEmail, updateProfile } from './api/profileApi';
import { clearResetCooldown } from './passwordReset';
import { resetProfileStore, setStoredProfile, useProfileStore } from './profileStore';
import EditProfileScreen from './screens/EditProfileScreen';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';

const PROFILE = {
  first_name: 'Asad',
  last_name: 'Khan',
  height_value: 69,
  height_unit: 'ft_in',
  current_weight_value: 82.5,
  current_weight_unit: 'kg',
  goal_weight_value: 78,
  goal_weight_unit: 'kg',
  date_of_birth: null,
  sex: null,
};

const texts = (root) =>
  root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
const byTestId = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');

beforeEach(() => {
  jest.clearAllMocks();
  resetProfileStore();
  clearResetCooldown();
  useAuthStore.setState({ user: { email: 'asad@example.com' }, claims: null });
});

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

function render(element, options) {
  let tree;
  act(() => {
    tree = create(element, options);
  });
  mounted.push(tree);
  return tree;
}

describe('P1 Settings', () => {
  it('renders the identity card, the rows and their actions from the store', () => {
    setStoredProfile(PROFILE);
    const tree = render(<ProfileSettingsScreen />);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['AK', 'Asad Khan', 'asad@example.com', 'Manage', 'Account', 'Logout']));
    expect(shown).toEqual(
      expect.arrayContaining(['Personal Information', 'Body Measurements', 'Units of Measurement', 'Change Password', 'Add weight log manually'])
    );
    act(() => byTestId(tree.root, 'settings-manage').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith(routes.EditProfile);
    act(() => byTestId(tree.root, 'settings-row-weight').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/progress');
    act(() => byTestId(tree.root, 'settings-sign-out').props.onPress());
    expect(logout).toHaveBeenCalled();
  });

  it('has the Workout "Speak rest alerts" switch, on by default, toggled by the whole row (P1.3 3b)', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    setStoredProfile(PROFILE);
    const tree = render(<ProfileSettingsScreen />);
    const row = () => tree.root.find((node) => node.props.testID === 'settings-speak-rest-alerts' && node.props.onPress);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Workout', 'Speak rest alerts', 'Say when rest is over']));
    expect(row().props.accessibilityRole).toBe('switch');
    expect(row().props.accessibilityState).toEqual({ checked: true });
    act(() => {
      row().props.onPress();
    });
    expect(row().props.accessibilityState).toEqual({ checked: false });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.speakRestAlerts', '0');
    act(() => {
      row().props.onPress();
    });
    expect(row().props.accessibilityState).toEqual({ checked: true });
  });

  it('has the "Vibrate on rest end" switch, on by default, stored separately (P1.3 3b)', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    setStoredProfile(PROFILE);
    const tree = render(<ProfileSettingsScreen />);
    const row = () => tree.root.find((node) => node.props.testID === 'settings-vibrate-rest-alerts' && node.props.onPress);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Vibrate on rest end', 'Buzz when rest is over']));
    expect(row().props.accessibilityRole).toBe('switch');
    expect(row().props.accessibilityState).toEqual({ checked: true });
    // Design system v1 #17: the gold track, the off colour behind it on iOS.
    const toggle = tree.root.find((node) => node.props.testID === 'settings-vibrate-rest-alerts-switch' && node.props.onValueChange);
    expect(toggle.props.trackColor).toEqual({ false: '#e5e7eb', true: '#f4b400' });
    expect(toggle.props.ios_backgroundColor).toBe('#e5e7eb');
    // QA 1.0.1: a white thumb in both states on both switches (Android's default ON thumb is teal).
    expect(toggle.props.thumbColor).toBe('#ffffff');
    expect(tree.root.find((node) => node.props.testID === 'settings-speak-rest-alerts-switch' && node.props.onValueChange).props.thumbColor).toBe('#ffffff');
    act(() => {
      row().props.onPress();
    });
    expect(row().props.accessibilityState).toEqual({ checked: false });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.vibrateRestAlerts', '0');
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('gymido.speakRestAlerts', expect.anything());
    act(() => {
      row().props.onPress();
    });
  });

  it('shows the error state with the transport text', () => {
    useProfileStore.setState({ profileStatus: 'error', profileError: new Error('Request failed with status code 500') });
    const shown = texts(render(<ProfileSettingsScreen />).root);
    expect(shown).toEqual(expect.arrayContaining(['Something went wrong', 'Request failed with status code 500']));
  });
});

describe('P1a Change password: reset email (T-32 H1)', () => {
  // The PillButton element (it carries `title`), not its inner Pressable.
  const button = (root, id) => root.find((node) => node.props.testID === id && node.props.title !== undefined);
  const has = (root, id) => root.findAll((node) => node.props.testID === id).length > 0;
  const BODY = "We'll email a link to asad@example.com so you can set a new password.";
  // The body line's text with the nested bold email flattened in.
  const flatten = (children) =>
    [].concat(children).map((child) => (child && typeof child === 'object' ? flatten(child.props.children) : child ?? '')).join('');
  const bodyLine = (root) => {
    const found = root.findAll((node) => node.props.testID === 'change-password-body' && node.props.children);
    return found.length ? flatten(found[0].props.children) : null;
  };
  // The countdown re-arms one timer per render, so step a second at a time.
  const elapse = (seconds) => {
    for (let i = 0; i < seconds; i += 1) {
      act(() => jest.advanceTimersByTime(1000));
    }
  };
  const modalOpen = (root) => root.find((node) => node.props.testID === 'change-password-modal' && 'isOpen' in node.props).props.isOpen;

  // Refs resolve to their testID (host nodes via createNodeMock, the mocked
  // View class via its props), so a focus call names its target.
  function openModal() {
    setStoredProfile(PROFILE);
    const tree = render(<ProfileSettingsScreen />, { createNodeMock: (element) => ({ testID: element.props.testID }) });
    act(() => byTestId(tree.root, 'settings-change-password').props.onPress());
    return tree;
  }

  async function press(tree, id) {
    await act(async () => {
      await button(tree.root, id).props.onPress();
    });
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-26T12:00:00Z') });
    jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    jest.spyOn(require('react-native'), 'findNodeHandle', 'get').mockReturnValue((ref) => ref?.testID ?? ref?.props?.testID ?? null);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('accounts: an auth0| sub (and no sub yet) keeps the "Change Password" row, which opens the modal', () => {
    useAuthStore.setState({ claims: { sub: 'auth0|abc123' } });
    const tree = openModal();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Change Password', 'Update your login password']));
    expect(modalOpen(tree.root)).toBe(true);
    expect(has(tree.root, 'settings-password-info')).toBe(false);
  });

  it('accounts: a google-oauth2| sub gets the plain "Password" row: role text, no onPress, no chevron, no modal', () => {
    useAuthStore.setState({ claims: { sub: 'google-oauth2|1234567890' } });
    setStoredProfile(PROFILE);
    const tree = render(<ProfileSettingsScreen />);
    expect(has(tree.root, 'settings-change-password')).toBe(false);
    const row = tree.root.find((node) => node.props.testID === 'settings-password-info' && node.props.accessibilityRole);
    expect(row.props.accessibilityRole).toBe('text');
    expect(row.props.onPress).toBeUndefined();
    expect(row.findAll((node) => typeof node.props.onPress === 'function')).toHaveLength(0);
    const rowTexts = texts(row);
    expect(rowTexts).toEqual(['◈', 'Password', "You sign in with Google, so there's no Gymido password to change."]);
    expect(rowTexts).not.toContain('›');
    expect(texts(tree.root)).not.toContain('Change Password');
    expect(modalOpen(tree.root)).toBe(false);
  });

  it('idle: title, no description, the body line with the email, "Cancel" · "Send reset email"; no old strings, never "Auth0"', () => {
    const tree = openModal();
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining(['Change password', 'asad@example.com', 'Cancel', 'Send reset email'])
    );
    expect(bodyLine(tree.root)).toBe(BODY);
    const modal = tree.root.find((node) => node.props.testID === 'change-password-modal' && 'isOpen' in node.props);
    expect(modal.props.description).toBeUndefined();
    expect(has(tree.root, 'change-password-new')).toBe(false);
    expect(has(tree.root, 'change-password-confirm')).toBe(false);
    expect(shown.join(' ')).not.toMatch(/Auth0/);
    expect(button(tree.root, 'change-password-cancel').props.variant).toBe('secondary');
    expect(button(tree.root, 'change-password-submit').props.variant).toBeUndefined();
  });

  it('sending: Cancel disabled, the primary loading, and the modal refuses to close', async () => {
    let resolve;
    sendPasswordResetEmail.mockReturnValue(new Promise((done) => (resolve = done)));
    const tree = openModal();
    act(() => {
      button(tree.root, 'change-password-submit').props.onPress();
    });
    expect(bodyLine(tree.root)).toBe(BODY);
    expect(button(tree.root, 'change-password-cancel').props.disabled).toBe(true);
    expect(button(tree.root, 'change-password-submit').props.loading).toBe(true);
    // Scrim / Android back.
    act(() => tree.root.find((node) => node.props.testID === 'change-password-modal' && 'isOpen' in node.props).props.onClose());
    expect(modalOpen(tree.root)).toBe(true);
    await act(async () => {
      resolve({ message: 'Not shown' });
    });
  });

  it('sent (200): the status block, "Send again in 59s" disabled counting down to 1, focus on "Done", no toast, Done closes', async () => {
    sendPasswordResetEmail.mockResolvedValue({ message: 'Server message not shown' });
    const tree = openModal();
    await press(tree, 'change-password-submit');
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const status = tree.root.find((node) => node.props.testID === 'change-password-sent' && node.props.role);
    expect(status.props.role).toBe('status');
    expect(texts(status)).toEqual(['✓', 'Email sent', 'Check your inbox for the link. It can take a few minutes, so look in spam too.']);
    expect(texts(tree.root)).not.toContain('Server message not shown');
    expect(has(tree.root, 'toast')).toBe(false);
    expect(button(tree.root, 'change-password-resend').props.title).toBe('Send again in 59s');
    expect(button(tree.root, 'change-password-resend').props.disabled).toBe(true);
    expect(button(tree.root, 'change-password-resend').props.variant).toBe('secondary');
    elapse(1);
    expect(button(tree.root, 'change-password-resend').props.title).toBe('Send again in 58s');
    elapse(57);
    expect(button(tree.root, 'change-password-resend').props.title).toBe('Send again in 1s');
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith('change-password-done');
    act(() => button(tree.root, 'change-password-done').props.onPress());
    expect(modalOpen(tree.root)).toBe(false);
  });

  it('cooldown over: "Send again" enabled; it re-sends and restarts 60 s', async () => {
    sendPasswordResetEmail.mockResolvedValue({});
    const tree = openModal();
    await press(tree, 'change-password-submit');
    elapse(59);
    expect(texts(tree.root)).toContain('Email sent');
    expect(button(tree.root, 'change-password-resend').props.title).toBe('Send again');
    expect(button(tree.root, 'change-password-resend').props.disabled).toBe(false);
    await press(tree, 'change-password-resend');
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(2);
    expect(button(tree.root, 'change-password-resend').props.title).toBe('Send again in 59s');
  });

  it('error: ErrorAlert "Could not send the email" with the server message (404/502/503), no Retry, focus on the alert', async () => {
    sendPasswordResetEmail.mockRejectedValue({ response: { status: 503, data: { message: 'Email is unavailable right now.' } } });
    const tree = openModal();
    await press(tree, 'change-password-submit');
    const alert = tree.root.find((node) => node.props.testID === 'change-password-error' && node.props.accessible);
    expect(texts(alert)).toEqual(['Could not send the email', 'Email is unavailable right now.']);
    expect(texts(alert)).not.toContain('Retry');
    expect(bodyLine(tree.root)).toBe(BODY);
    expect(button(tree.root, 'change-password-cancel').props.disabled).toBe(false);
    expect(button(tree.root, 'change-password-submit').props.loading).toBe(false);
    act(() => jest.advanceTimersByTime(300));
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith('change-password-error');
  });

  it('error: without a server message, "Please try again."', async () => {
    sendPasswordResetEmail.mockRejectedValue(new Error('Network Error'));
    const tree = openModal();
    await press(tree, 'change-password-submit');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Could not send the email', 'Please try again.']));
  });

  it('cooldown: reopening inside it shows the sent state with the time left; after it, idle', async () => {
    sendPasswordResetEmail.mockResolvedValue({});
    const tree = openModal();
    await press(tree, 'change-password-submit');
    act(() => button(tree.root, 'change-password-done').props.onPress());
    elapse(20);
    act(() => byTestId(tree.root, 'settings-change-password').props.onPress());
    expect(texts(tree.root)).toContain('Email sent');
    expect(button(tree.root, 'change-password-resend').props.title).toBe('Send again in 39s');
    act(() => button(tree.root, 'change-password-done').props.onPress());
    elapse(40);
    act(() => byTestId(tree.root, 'settings-change-password').props.onPress());
    expect(texts(tree.root)).not.toContain('Email sent');
    expect(button(tree.root, 'change-password-submit').props.title).toBe('Send reset email');
  });
});

describe('P2 Edit profile', () => {
  it('splits ft_in, keeps Save disabled until a change, and saves the full body', async () => {
    setStoredProfile(PROFILE);
    const tree = render(<EditProfileScreen />);
    const save = () => tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    expect(save().props.disabled).toBe(true);
    const feet = tree.root.find((node) => node.props.testID === 'edit-profile-height_feet' && node.props.onChangeText);
    expect(feet.props.value).toBe('5');
    const inches = tree.root.find((node) => node.props.testID === 'edit-profile-height_inches' && node.props.onChangeText);
    act(() => inches.props.onChangeText('10'));
    expect(save().props.disabled).toBe(false);

    const saved = { ...PROFILE, height_value: 70 };
    updateProfile.mockResolvedValue(saved);
    await act(async () => {
      await save().props.onPress();
    });
    expect(updateProfile).toHaveBeenCalledWith({
      first_name: 'Asad',
      last_name: 'Khan',
      height_value: 70,
      height_unit: 'ft_in',
      current_weight_value: 82.5,
      current_weight_unit: 'kg',
      goal_weight_value: 78,
      goal_weight_unit: 'kg',
      date_of_birth: null,
      sex: null,
    });
    expect(useProfileStore.getState().profile).toBe(saved);
    expect(mockNavigation.replace).toHaveBeenCalledWith(routes.Settings);
  });

  it('shows client errors and does not call the API', async () => {
    setStoredProfile(PROFILE);
    const tree = render(<EditProfileScreen />);
    const first = tree.root.find((node) => node.props.testID === 'edit-profile-first_name' && node.props.onChangeText);
    act(() => first.props.onChangeText(' '));
    const save = tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    await act(async () => {
      await save.props.onPress();
    });
    expect(texts(tree.root)).toContain('First name is required');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('shows the server message and field errors on failure', async () => {
    setStoredProfile(PROFILE);
    const tree = render(<EditProfileScreen />);
    const first = tree.root.find((node) => node.props.testID === 'edit-profile-first_name' && node.props.onChangeText);
    act(() => first.props.onChangeText('Asadd'));
    updateProfile.mockRejectedValue({
      response: { status: 422, data: { message: 'The given data was invalid.', errors: { sex: ['The selected sex is invalid.'] } } },
    });
    const save = tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    await act(async () => {
      await save.props.onPress();
    });
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['The given data was invalid.', 'The selected sex is invalid.']));
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('Cancel pushes Settings (⚠P-12)', () => {
    setStoredProfile(PROFILE);
    const tree = render(<EditProfileScreen />);
    act(() => byTestId(tree.root, 'edit-profile-cancel').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith(routes.Settings);
  });
});
