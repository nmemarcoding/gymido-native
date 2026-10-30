import { act, create } from 'react-test-renderer';

import { useAuthStore } from '../auth/authStore';
import { reminderTimesLabel } from '../reminders/reminderPlan';
import { fixReminderPermission, refreshReminderPermission } from '../reminders/reminderSignals';
import { useWorkoutReminders } from '../reminders/workoutReminderSetting';
import { resetProfileStore, setStoredProfile } from './profileStore';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';

jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../auth/authService', () => ({ logout: jest.fn() }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./CoachingCard', () => () => null);
jest.mock('./ProfileStatTiles', () => () => null);
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), updateProfile: jest.fn(), sendPasswordResetEmail: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ push: jest.fn(), navigate: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../reminders/reminderSignals', () => ({
  fixReminderPermission: jest.fn(() => Promise.resolve()),
  refreshReminderPermission: jest.fn(() => Promise.resolve()),
}));

const PROFILE = { first_name: 'Asad', last_name: 'Khan', height_unit: 'cm', current_weight_unit: 'kg', goal_weight_unit: 'kg' };

const texts = (root) =>
  root.findAll((node) => typeof node.type === 'string' && node.type === 'Text').map((node) => [].concat(node.props.children).join(''));
const row = (tree) => tree.root.find((node) => node.props.testID === 'settings-workout-reminders' && node.props.onPress);
const rowIds = (tree) =>
  tree.root.findAll((node) => node.props.accessibilityRole === 'switch' && typeof node.props.onPress === 'function').map((node) => node.props.testID);

const mounted = [];
function render() {
  let tree;
  act(() => {
    tree = create(<ProfileSettingsScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetProfileStore();
  setStoredProfile(PROFILE);
  useAuthStore.setState({ user: { email: 'asad@example.com', roles: ['member'] }, claims: null });
  useWorkoutReminders.setState({ enabled: true, permission: 'granted' });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

describe('T-103 Settings row (UX ruling §3)', () => {
  test('first in the Workout list, on by default, the times as its value; reads the permission on every visit', () => {
    const tree = render();
    expect(rowIds(tree)).toEqual(['settings-workout-reminders', 'settings-speak-rest-alerts', 'settings-vibrate-rest-alerts']);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Workout reminders', reminderTimesLabel()]));
    expect(row(tree).props.accessibilityLabel).toBe('Workout reminders');
    expect(row(tree).props.accessibilityHint).toBe(reminderTimesLabel());
    expect(row(tree).props.accessibilityState).toEqual({ checked: true });
    expect(refreshReminderPermission).toHaveBeenCalledTimes(1);
  });

  test('the whole row toggles it and stores "0" / "1" under gymido.workoutReminders', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const tree = render();
    act(() => row(tree).props.onPress());
    expect(row(tree).props.accessibilityState).toEqual({ checked: false });
    expect(row(tree).props.accessibilityHint).toBe('Off');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.workoutReminders', '0');
    act(() => row(tree).props.onPress());
    expect(row(tree).props.accessibilityState).toEqual({ checked: true });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gymido.workoutReminders', '1');
  });

  test('OS permission denied: switch off, "Off in your phone\'s settings"; a press asks again / opens settings, the stored choice stays', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    useWorkoutReminders.setState({ enabled: true, permission: 'denied' });
    const tree = render();
    expect(row(tree).props.accessibilityState).toEqual({ checked: false });
    expect(texts(tree.root)).toContain("Off in your phone's settings");
    act(() => row(tree).props.onPress());
    expect(fixReminderPermission).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('gymido.workoutReminders', expect.anything());
    // Permission granted on return → the row turns on.
    act(() => useWorkoutReminders.setState({ permission: 'granted' }));
    expect(row(tree).props.accessibilityState).toEqual({ checked: true });
  });

  test('switched off by the user wins over a denied permission: "Off"; a press turns it back on', () => {
    useWorkoutReminders.setState({ enabled: false, permission: 'denied' });
    const tree = render();
    expect(row(tree).props.accessibilityHint).toBe('Off');
    act(() => row(tree).props.onPress());
    expect(fixReminderPermission).not.toHaveBeenCalled();
    expect(useWorkoutReminders.getState().enabled).toBe(true);
  });

  test('never asked yet (undetermined) still reads on', () => {
    useWorkoutReminders.setState({ enabled: true, permission: 'undetermined' });
    const tree = render();
    expect(row(tree).props.accessibilityState).toEqual({ checked: true });
  });

  // DECLARED (T-136, PM-approved): was "trainer accounts don't see the row"
  // (ids [speak, vibrate], no "Workout reminders").
  test('trainer accounts see the row on the personal Settings (T-136)', () => {
    useAuthStore.setState({ user: { email: 'coach@example.com', roles: ['member', 'trainer'] } });
    const tree = render();
    expect(rowIds(tree)).toEqual(['settings-workout-reminders', 'settings-speak-rest-alerts', 'settings-vibrate-rest-alerts']);
    expect(texts(tree.root)).toContain('Workout reminders');
  });
});
