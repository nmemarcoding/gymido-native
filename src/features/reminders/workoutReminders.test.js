import { AuthStatus, useAuthStore } from '../auth/authStore';
import { requestPermissionAtWorkoutStart } from '../workout/runtime/restAlerts';
import { initReminderChannel } from './reminderPlatform';
import { askReminderPermissionOnTrainingDay, fixReminderPermission, refreshReminderPermission, signalReminders } from './reminderSignals';
import { resetWorkoutRemindersForTests, startWorkoutReminders } from './workoutReminders';
import { WORKOUT_REMINDERS_KEY, setWorkoutRemindersEnabled, useWorkoutReminders } from './workoutReminderSetting';

const mockPrefs = new Map();
jest.mock('../../shared/storage/preferences', () => ({
  getPreference: jest.fn(async (key) => (mockPrefs.has(key) ? mockPrefs.get(key) : null)),
  setPreference: jest.fn(async (key, value) => mockPrefs.set(key, value)),
}));
const mockTap = { listener: null, last: null };
jest.mock('./reminderPlatform', () => ({
  initReminderChannel: jest.fn(),
  addReminderTapListener: jest.fn((listener) => {
    mockTap.listener = listener;
    return () => {};
  }),
  lastReminderTap: jest.fn(async () => mockTap.last),
  reminderApi: {},
  reminderPlatform: {},
}));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), shellNavigation: {} }));
jest.mock('../workout/runtime/restAlerts', () => ({ requestPermissionAtWorkoutStart: jest.fn(async () => {}) }));

const mockSync = { sync: jest.fn(async () => []), clearAll: jest.fn(async () => {}) };
let mockAllowed = null;
jest.mock('./reminderSync', () => ({
  createReminderSync: jest.fn(({ allowed }) => {
    mockAllowed = allowed;
    return mockSync;
  }),
}));

const MEMBER = { id: 7, roles: ['member'] };
const TRAINER = { id: 8, roles: ['member', ' Trainer '] };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function start({ permission = 'granted', canAskAgain = false, ready = true } = {}) {
  const appListeners = [];
  const stateListeners = [];
  const platform = {
    getPermission: jest.fn(async () => permission),
    canAskAgain: jest.fn(async () => canAskAgain),
    requestPermission: jest.fn(async () => 'granted'),
    openNotificationSettings: jest.fn(),
    dismiss: jest.fn(async () => {}),
    deleteChannel: jest.fn(),
  };
  const navigation = { isReady: jest.fn(() => ready), addListener: jest.fn((_event, listener) => {
      stateListeners.push(listener);
      return () => {};
    }) };
  const openToday = jest.fn();
  const appState = {
    addEventListener: jest.fn((_event, listener) => {
      appListeners.push(listener);
      return { remove: () => {} };
    }),
  };
  const controller = startWorkoutReminders({ platform, api: {}, appState, openToday, navigation });
  return { controller, platform, navigation, openToday, appState: (next) => appListeners.forEach((fn) => fn(next)), navState: () => stateListeners.forEach((fn) => fn()) };
}

const reminderTap = (id = 'gymido.reminder.2026-10-29.morning') => ({
  notification: { request: { identifier: id, content: { data: { kind: 'workoutReminder', date: '2026-10-29', slot: 'morning' } } } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrefs.clear();
  mockTap.listener = null;
  mockTap.last = null;
  resetWorkoutRemindersForTests();
  useWorkoutReminders.setState({ enabled: true, permission: null });
  useAuthStore.setState({ status: AuthStatus.restoring, user: null });
});

describe('T-103 startWorkoutReminders', () => {
  // DECLARED (review L3): was "creates the Android channel" at startup; the
  // channel now comes with a member's first scheduled reminder (the sync).
  test('once only; no channel at startup; syncs once the setting has loaded', async () => {
    const { controller } = start();
    expect(start().controller).toBe(controller);
    expect(initReminderChannel).not.toHaveBeenCalled();
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
  });

  test('allowed = signed-in member + switch on + permission granted (and the permission is stored for Settings)', async () => {
    start({ permission: 'granted' });
    await flush();
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
    expect(await mockAllowed()).toBe(false);
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    expect(await mockAllowed()).toBe(true);
    expect(useWorkoutReminders.getState().permission).toBe('granted');
    useWorkoutReminders.setState({ enabled: false });
    expect(await mockAllowed()).toBe(false);
    useWorkoutReminders.setState({ enabled: true });
    useAuthStore.setState({ user: TRAINER });
    expect(await mockAllowed()).toBe(false);
  });

  test.each([AuthStatus.restoring, AuthStatus.authenticating, AuthStatus.loadingUser])('auth %s → not known yet (null), the permission is not read (review M1)', async (status) => {
    const { platform } = start();
    useAuthStore.setState({ status, user: MEMBER });
    expect(await mockAllowed()).toBeNull();
    expect(platform.getPermission).not.toHaveBeenCalled();
  });

  test.each(['denied', 'undetermined'])('permission %s → not allowed', async (permission) => {
    start({ permission });
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    expect(await mockAllowed()).toBe(false);
    expect(useWorkoutReminders.getState().permission).toBe(permission);
  });

  test('the stored "0" turns it off; missing = on', async () => {
    mockPrefs.set(WORKOUT_REMINDERS_KEY, '0');
    start();
    await flush();
    expect(useWorkoutReminders.getState().enabled).toBe(false);
  });

  test('sign-in syncs; sign-out and an unavailable account clear everything', async () => {
    start();
    await flush();
    mockSync.sync.mockClear();
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
    expect(mockSync.clearAll).toHaveBeenCalledTimes(1);
    useAuthStore.setState({ status: AuthStatus.accountUnavailable });
    expect(mockSync.clearAll).toHaveBeenCalledTimes(2);
  });

  test('every return to the foreground reschedules (app open)', async () => {
    const { appState } = start();
    await flush();
    mockSync.sync.mockClear();
    appState('background');
    appState('inactive');
    expect(mockSync.sync).not.toHaveBeenCalled();
    appState('active');
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
  });

  test('the Settings switch: off and on both resync (the sync clears when off)', async () => {
    start();
    await flush();
    mockSync.sync.mockClear();
    await setWorkoutRemindersEnabled(false);
    expect(mockPrefs.get(WORKOUT_REMINDERS_KEY)).toBe('0');
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    await setWorkoutRemindersEnabled(true);
    expect(mockPrefs.get(WORKOUT_REMINDERS_KEY)).toBe('1');
    expect(mockSync.sync).toHaveBeenCalledTimes(2);
  });

  test('signals: a plan change and a finished workout both resync (the sync decides about today)', async () => {
    start();
    await flush();
    mockSync.sync.mockClear();
    signalReminders('planChanged');
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    signalReminders('workoutFinished');
    expect(mockSync.sync).toHaveBeenCalledTimes(2);
    signalReminders('somethingElse');
    expect(mockSync.sync).toHaveBeenCalledTimes(2);
  });
});

describe('T-103 tap → Today (UX ruling §5)', () => {
  test('signed-in member: opens Today and clears the tapped reminder', () => {
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    const { openToday, platform } = start();
    mockTap.listener(reminderTap());
    expect(openToday).toHaveBeenCalledTimes(1);
    expect(platform.dismiss).toHaveBeenCalledWith('gymido.reminder.2026-10-29.morning');
  });

  test('a rest-end tap is not a reminder', () => {
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    const { openToday } = start();
    mockTap.listener({ notification: { request: { identifier: 'gymido-rest-end', content: { data: { kind: 'restEnd' } } } } });
    expect(openToday).not.toHaveBeenCalled();
  });

  test('cold start: the launching tap opens Today once navigation is ready', async () => {
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    mockTap.last = reminderTap();
    let ready = false;
    const { openToday, navigation, navState } = start();
    navigation.isReady.mockImplementation(() => ready);
    await flush();
    expect(openToday).not.toHaveBeenCalled();
    ready = true;
    navState();
    navState();
    expect(openToday).toHaveBeenCalledTimes(1);
  });

  test('signed out: Today after sign-in; a trainer sign-in drops it', () => {
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
    const { openToday } = start();
    mockTap.listener(reminderTap());
    expect(openToday).not.toHaveBeenCalled();
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    expect(openToday).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
    mockTap.listener(reminderTap());
    useAuthStore.setState({ status: AuthStatus.signedIn, user: TRAINER });
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    expect(openToday).toHaveBeenCalledTimes(1);
  });
});

describe('T-103 permission (UX ruling §3 + §4)', () => {
  // DECLARED (review N1): was "asks … then reschedules" with a granted
  // permission; a settled permission now does nothing (no ask, no resync).
  test('Today\'s training day, permission not asked yet: asks through the T-50 asked-once rule, then reschedules; never for a trainer', async () => {
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    const { platform } = start({ permission: 'undetermined' });
    await flush();
    mockSync.sync.mockClear();
    await askReminderPermissionOnTrainingDay();
    expect(requestPermissionAtWorkoutStart).toHaveBeenCalledWith(platform);
    expect(mockSync.sync).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ user: TRAINER });
    await askReminderPermissionOnTrainingDay();
    expect(requestPermissionAtWorkoutStart).toHaveBeenCalledTimes(1);
  });

  test.each(['granted', 'denied'])('Today\'s training day, permission already %s: no ask, no resync (review N1)', async (permission) => {
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER });
    start({ permission });
    await flush();
    mockSync.sync.mockClear();
    await askReminderPermissionOnTrainingDay();
    expect(requestPermissionAtWorkoutStart).not.toHaveBeenCalled();
    expect(mockSync.sync).not.toHaveBeenCalled();
  });

  test('a trainer account removes the reminders channel once (review L3)', async () => {
    const { platform } = start();
    useAuthStore.setState({ status: AuthStatus.signedIn, user: TRAINER });
    expect(await mockAllowed()).toBe(false);
    expect(await mockAllowed()).toBe(false);
    expect(platform.deleteChannel).toHaveBeenCalledTimes(1);
    useAuthStore.setState({ user: MEMBER });
    await mockAllowed();
    expect(platform.deleteChannel).toHaveBeenCalledTimes(1);
  });

  test('a finished workout\'s session is handed to the sync (review L4)', async () => {
    const { createReminderSync } = require('./reminderSync');
    start();
    await flush();
    const { localCompleted } = createReminderSync.mock.calls.at(-1)[0];
    expect(localCompleted()).toEqual([]);
    signalReminders('workoutFinished', { id: 9, workout_plan_day_id: 12, started_at: '2026-10-29T15:00:00Z' });
    signalReminders('workoutFinished', null);
    expect(localCompleted()).toEqual([{ id: 9, workout_plan_day_id: 12, started_at: '2026-10-29T15:00:00Z' }]);
    expect(mockSync.sync).toHaveBeenCalled();
  });

  test('before the controller starts, the screens\' calls are no-ops', async () => {
    await expect(askReminderPermissionOnTrainingDay()).resolves.toBeUndefined();
    await expect(fixReminderPermission()).resolves.toBeUndefined();
    await expect(refreshReminderPermission()).resolves.toBeUndefined();
  });

  test('denied row press, the OS can still ask: asks again, re-reads, reschedules', async () => {
    const { platform } = start({ permission: 'denied', canAskAgain: true });
    await flush();
    mockSync.sync.mockClear();
    platform.getPermission.mockResolvedValue('granted');
    await fixReminderPermission();
    expect(platform.requestPermission).toHaveBeenCalledTimes(1);
    expect(platform.openNotificationSettings).not.toHaveBeenCalled();
    expect(useWorkoutReminders.getState().permission).toBe('granted');
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
  });

  test('denied row press, the OS can\'t ask: opens the system settings (no dialog)', async () => {
    const { platform } = start({ permission: 'denied', canAskAgain: false });
    await fixReminderPermission();
    expect(platform.openNotificationSettings).toHaveBeenCalledTimes(1);
    expect(platform.requestPermission).not.toHaveBeenCalled();
  });

  test('refreshReminderPermission stores the OS state for the row', async () => {
    start({ permission: 'denied' });
    await refreshReminderPermission();
    expect(useWorkoutReminders.getState().permission).toBe('denied');
  });
});
