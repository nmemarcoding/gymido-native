import { AuthStatus, useAuthStore } from '../auth/authStore';
import { REMINDER_KIND } from './reminderPlan';
import { resetWorkoutRemindersForTests, startWorkoutReminders } from './workoutReminders';
import { useWorkoutReminders } from './workoutReminderSetting';

jest.mock('../../shared/storage/preferences', () => ({
  getPreference: jest.fn(async () => null),
  setPreference: jest.fn(async () => {}),
}));
jest.mock('./reminderPlatform', () => ({
  initReminderChannel: jest.fn(),
  addReminderTapListener: jest.fn(() => () => {}),
  lastReminderTap: jest.fn(async () => null),
  reminderApi: {},
  reminderPlatform: {},
}));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), shellNavigation: {} }));
jest.mock('../workout/runtime/restAlerts', () => ({ requestPermissionAtWorkoutStart: jest.fn(async () => {}) }));

// Review M1 (native-t103-c23456f): the REAL sync. A cold start runs its first
// sync while auth is still restoring; an offline open then reaches signedIn
// with the plan read failing. Neither may cancel or dismiss anything.
const flush = () => new Promise((resolve) => setImmediate(resolve));
const reminder = (date, slot) => ({ identifier: `gymido.reminder.${date}.${slot}`, content: { data: { kind: REMINDER_KIND, date, slot } } });
const PENDING = [reminder('2026-11-02', 'morning'), reminder('2026-11-02', 'afternoon')];
const SHOWN = [{ date: 1, request: reminder('2026-10-29', 'evening') }];
const PLAN = {
  enrollment: { id: 31, status: 'active', started_on: '2026-09-21T00:00:00Z' },
  schedule: [{ weekday: { id: 1, sort_order: 1 }, plan_day: { id: 11, title: 'Push' } }],
};

function start(api) {
  const platform = {
    getPermission: jest.fn(async () => 'granted'),
    getScheduled: jest.fn(async () => PENDING),
    getPresented: jest.fn(async () => SHOWN),
    cancelScheduled: jest.fn(async () => {}),
    dismiss: jest.fn(async () => {}),
    schedule: jest.fn(async () => 'id'),
  };
  const appState = { addEventListener: jest.fn(() => ({ remove: () => {} })) };
  const navigation = { isReady: () => true, addListener: () => () => {} };
  startWorkoutReminders({ platform, api, appState, openToday: jest.fn(), navigation });
  return platform;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetWorkoutRemindersForTests();
  useWorkoutReminders.setState({ enabled: true, permission: null });
  useAuthStore.setState({ status: AuthStatus.restoring, user: null });
});

test('cold start while restoring, then signed in offline: every reminder stays (pending and shown)', async () => {
  const api = { getCurrentPlan: jest.fn(async () => Promise.reject(new Error('Network Error'))), listCompletedWorkouts: jest.fn(async () => []) };
  const platform = start(api);
  await flush();
  useAuthStore.setState({ status: AuthStatus.loadingUser });
  await flush();
  expect(api.getCurrentPlan).not.toHaveBeenCalled();
  expect(platform.cancelScheduled).not.toHaveBeenCalled();
  expect(platform.dismiss).not.toHaveBeenCalled();

  // authService signs in from the token on a network error.
  useAuthStore.setState({ status: AuthStatus.signedIn, user: { id: 7, roles: ['member'] } });
  await flush();
  await flush();
  expect(api.getCurrentPlan).toHaveBeenCalledTimes(1);
  expect(platform.cancelScheduled).not.toHaveBeenCalled();
  expect(platform.dismiss).not.toHaveBeenCalled();
  expect(platform.schedule).not.toHaveBeenCalled();
});

test('the same start online replaces the set once signed in', async () => {
  const api = { getCurrentPlan: jest.fn(async () => PLAN), listCompletedWorkouts: jest.fn(async () => []) };
  const platform = start(api);
  await flush();
  expect(platform.cancelScheduled).not.toHaveBeenCalled();
  useAuthStore.setState({ status: AuthStatus.signedIn, user: { id: 7, roles: ['member'] } });
  await flush();
  await flush();
  expect(platform.cancelScheduled).toHaveBeenCalledTimes(PENDING.length);
  expect(platform.schedule).toHaveBeenCalled();
});

test('a cold start that ends signed out clears everything', async () => {
  const api = { getCurrentPlan: jest.fn(), listCompletedWorkouts: jest.fn() };
  const platform = start(api);
  await flush();
  useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
  await flush();
  expect(platform.cancelScheduled).toHaveBeenCalledTimes(PENDING.length);
  expect(platform.dismiss).toHaveBeenCalledWith('gymido.reminder.2026-10-29.evening');
  expect(api.getCurrentPlan).not.toHaveBeenCalled();
});
