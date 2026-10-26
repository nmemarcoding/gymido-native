jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../auth/authService', () => ({ logout: jest.fn() }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./CoachingCard', () => () => null);
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const mockNavigation = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { act, create } from 'react-test-renderer';

import { routes } from '../../navigation/routes';
import { logout } from '../auth/authService';
import { useAuthStore } from '../auth/authStore';
import { openShellPath } from '../shell/shellLinks';
import { getProfile, updateProfile } from './api/profileApi';
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
  useAuthStore.setState({ user: { email: 'asad@example.com' } });
});

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

const retryButton = (root) => root.find((node) => node.props.title === 'Retry' && typeof node.props.onPress === 'function');

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
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

  it('retries a failed load once on mount, then shows the error with Retry (T-16)', async () => {
    const failure = Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } });
    getProfile.mockRejectedValue(failure);
    useProfileStore.setState({ profileStatus: 'error', profileError: failure });
    let tree;
    await act(async () => {
      tree = render(<ProfileSettingsScreen />);
    });
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Something went wrong', 'Request failed with status code 500']));

    getProfile.mockResolvedValue({ profile: PROFILE });
    await act(async () => {
      await retryButton(tree.root).props.onPress();
    });
    expect(getProfile).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain('Asad Khan');
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

  it('keeps "82,5" as typed on a decimal keypad and saves 82.5 (T-16)', async () => {
    setStoredProfile(PROFILE);
    const tree = render(<EditProfileScreen />);
    const weight = () => tree.root.find((node) => node.props.testID === 'edit-profile-current_weight_value' && node.props.onChangeText);
    expect(weight().props.keyboardType).toBe('decimal-pad');
    act(() => weight().props.onChangeText('82,5'));
    expect(weight().props.value).toBe('82,5');
    act(() => weight().props.onChangeText('81,5'));
    updateProfile.mockResolvedValue({ ...PROFILE, current_weight_value: 81.5 });
    const save = tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    await act(async () => {
      await save.props.onPress();
    });
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ current_weight_value: 81.5 }));
  });

  it('retries a failed load once on mount and never loops (T-16)', async () => {
    getProfile.mockRejectedValue(Object.assign(new Error('Request failed with status code 503'), { response: { status: 503 } }));
    useProfileStore.setState({ profileStatus: 'error', profileError: new Error('Request failed with status code 500') });
    let tree;
    await act(async () => {
      tree = render(<EditProfileScreen />);
    });
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Something went wrong', 'Request failed with status code 503']));
    await act(async () => {
      await retryButton(tree.root).props.onPress();
    });
    expect(getProfile).toHaveBeenCalledTimes(2);
    expect(retryButton(tree.root)).toBeTruthy();
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
