import { AuthStatus, useAuthStore } from '../auth/authStore';
import { openShellPath } from '../shell/shellLinks';
import { requestPermissionAtWorkoutStart } from '../workout/runtime/restAlerts';
import { Workspace } from '../workspace/workspace';
import { askReminderPermissionOnTrainingDay } from './reminderSignals';
import { openPersonalToday, resetWorkoutRemindersForTests, startWorkoutReminders } from './workoutReminders';
import { useWorkoutReminders } from './workoutReminderSetting';

// T-136 (owner, 29 Oct 2026): a trainer gets the T-103 reminders from their
// own plan, exactly as a member (the personal side).
const mockPrefs = new Map();
jest.mock('../../shared/storage/preferences', () => ({
  getPreference: jest.fn(async (key) => (mockPrefs.has(key) ? mockPrefs.get(key) : null)),
  setPreference: jest.fn(async (key, value) => mockPrefs.set(key, value)),
}));
const mockTap = { listener: null };
jest.mock('./reminderPlatform', () => ({
  addReminderTapListener: jest.fn((listener) => {
    mockTap.listener = listener;
    return () => {};
  }),
  lastReminderTap: jest.fn(async () => null),
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

const TRAINER = { id: 8, roles: ['member', 'trainer'] };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function start({ permission = 'granted', openToday = jest.fn() } = {}) {
  const platform = {
    getPermission: jest.fn(async () => permission),
    dismiss: jest.fn(async () => {}),
    deleteChannel: jest.fn(),
  };
  const navigation = { isReady: () => true, addListener: jest.fn(() => () => {}) };
  const appState = { addEventListener: jest.fn(() => ({ remove: () => {} })) };
  startWorkoutReminders({ platform, api: {}, appState, openToday, navigation });
  return { platform, openToday };
}

const reminderTap = () => ({
  notification: {
    request: {
      identifier: 'gymido.reminder.2026-10-30.morning',
      content: { data: { kind: 'workoutReminder', date: '2026-10-30', slot: 'morning' } },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrefs.clear();
  resetWorkoutRemindersForTests();
  useWorkoutReminders.setState({ enabled: true, permission: null });
  useAuthStore.setState({ status: AuthStatus.signedIn, user: TRAINER, workspace: Workspace.member });
});

describe('T-136 trainer reminders', () => {
  test('a signed-in trainer is allowed (switch on + granted) and syncs on sign-in; the channel is kept', async () => {
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
    const { platform } = start();
    await flush();
    mockSync.sync.mockClear();
    useAuthStore.setState({ status: AuthStatus.signedIn, user: TRAINER, workspace: Workspace.trainer });
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    expect(await mockAllowed()).toBe(true);
    expect(platform.deleteChannel).not.toHaveBeenCalled();
    useWorkoutReminders.setState({ enabled: false });
    expect(await mockAllowed()).toBe(false);
  });

  test('a tap opens Today for a trainer (never dropped), in either mode', () => {
    const { openToday } = start();
    mockTap.listener(reminderTap());
    useAuthStore.setState({ workspace: Workspace.trainer });
    mockTap.listener(reminderTap());
    expect(openToday).toHaveBeenCalledTimes(2);
  });

  test('openPersonalToday: trainer mode switches to the personal side (stored), then the Today root', async () => {
    useAuthStore.setState({ workspace: Workspace.trainer });
    openPersonalToday();
    expect(useAuthStore.getState().workspace).toBe(Workspace.member);
    expect(openShellPath).toHaveBeenCalledWith('/');
    await flush();
    expect(mockPrefs.get('gymido-mode')).toBe(Workspace.member);
  });

  test('review N3: the default tap handler is openPersonalToday (trainer mode switched, then the Today root)', () => {
    useAuthStore.setState({ workspace: Workspace.trainer });
    const appState = { addEventListener: jest.fn(() => ({ remove: () => {} })) };
    const navigation = { isReady: () => true, addListener: jest.fn(() => () => {}) };
    startWorkoutReminders({ platform: { getPermission: jest.fn(async () => 'granted'), dismiss: jest.fn(async () => {}) }, api: {}, appState, navigation });
    mockTap.listener(reminderTap());
    expect(useAuthStore.getState().workspace).toBe(Workspace.member);
    expect(openShellPath).toHaveBeenCalledWith('/');
  });

  test('openPersonalToday on the personal side: just the Today root, the preference untouched', () => {
    openPersonalToday();
    expect(useAuthStore.getState().workspace).toBe(Workspace.member);
    expect(openShellPath).toHaveBeenCalledWith('/');
    expect(mockPrefs.has('gymido-mode')).toBe(false);
  });

  test('training-day prompt: a trainer on the personal side is asked; never in trainer mode (UX ruling 4)', async () => {
    const { platform } = start({ permission: 'undetermined' });
    await flush();
    useAuthStore.setState({ workspace: Workspace.trainer });
    await askReminderPermissionOnTrainingDay();
    expect(requestPermissionAtWorkoutStart).not.toHaveBeenCalled();
    useAuthStore.setState({ workspace: Workspace.member });
    await askReminderPermissionOnTrainingDay();
    expect(requestPermissionAtWorkoutStart).toHaveBeenCalledWith(platform);
  });

  test('no prompt stacked on a tap\'s mode switch: a reminder means the permission is settled', async () => {
    useAuthStore.setState({ workspace: Workspace.trainer });
    start({ permission: 'granted', openToday: openPersonalToday });
    mockTap.listener(reminderTap());
    expect(useAuthStore.getState().workspace).toBe(Workspace.member);
    await askReminderPermissionOnTrainingDay();
    expect(requestPermissionAtWorkoutStart).not.toHaveBeenCalled();
  });
});
