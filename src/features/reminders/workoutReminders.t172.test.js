// T-172 (P1, owner 31 Oct 2026: no 08:00 reminder). The controller side:
// fix a (a failed sync retries with backoff), fix b (the per-user plan cache,
// cleared on sign-out), fix c ('permissionChanged' resyncs), fix d (the last
// sync's report is kept on the device).
import { AuthStatus, useAuthStore } from '../auth/authStore';
import { signalReminders } from './reminderSignals';
import { createReminderSync } from './reminderSync';
import {
  REMINDER_LAST_SYNC_KEY,
  REMINDER_PLAN_CACHE_KEY,
  REMINDER_RETRY_DELAYS_MS,
  reminderPlanCache,
  resetWorkoutRemindersForTests,
  startWorkoutReminders,
} from './workoutReminders';
import { useWorkoutReminders } from './workoutReminderSetting';

const mockPrefs = new Map();
jest.mock('../../shared/storage/preferences', () => ({
  getPreference: jest.fn(async (key) => (mockPrefs.has(key) ? mockPrefs.get(key) : null)),
  setPreference: jest.fn(async (key, value) => mockPrefs.set(key, value)),
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
const mockSync = { sync: jest.fn(async () => []), clearAll: jest.fn(async () => {}) };
jest.mock('./reminderSync', () => ({ createReminderSync: jest.fn(() => mockSync) }));

const MEMBER = { id: 7, roles: ['member'] };
const OTHER = { id: 9, roles: ['member'] };
const CLAIMS_A = { sub: 'auth0|a' };
const CLAIMS_B = { sub: 'auth0|b' };
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

function start() {
  const platform = { getPermission: jest.fn(async () => 'granted'), dismiss: jest.fn(async () => {}) };
  const appState = { addEventListener: jest.fn(() => ({ remove: () => {} })) };
  const navigation = { isReady: () => true, addListener: jest.fn(() => () => {}) };
  startWorkoutReminders({ platform, api: {}, appState, openToday: jest.fn(), navigation });
  return { platform };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPrefs.clear();
  resetWorkoutRemindersForTests();
  useWorkoutReminders.setState({ enabled: true, permission: null });
  useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER, claims: CLAIMS_A });
});

afterEach(() => {
  resetWorkoutRemindersForTests();
  jest.useRealTimers();
});

describe('T-172 fix a: a failed sync retries with backoff', () => {
  test('5 s, 20 s, 60 s, then stops; a success ends the retries', async () => {
    mockSync.sync.mockRejectedValue(new Error('offline'));
    start();
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    expect(REMINDER_RETRY_DELAYS_MS).toEqual([5000, 20000, 60000]);
    jest.advanceTimersByTime(4999);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(20000);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(60000);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(4);
    jest.advanceTimersByTime(600000);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(4);
  });

  test('a retry that succeeds ends them; sign-out cancels a waiting retry', async () => {
    mockSync.sync.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    start();
    await flush();
    jest.advanceTimersByTime(5000);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(600000);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(2);

    mockSync.sync.mockRejectedValue(new Error('offline'));
    signalReminders('planChanged');
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(3);
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null });
    jest.advanceTimersByTime(600000);
    await flush();
    expect(mockSync.sync).toHaveBeenCalledTimes(3);
  });
});

describe('T-172 fix c: a permission granted at the workout start reschedules', () => {
  test("'permissionChanged' re-reads the permission, then syncs", async () => {
    const { platform } = start();
    await flush();
    mockSync.sync.mockClear();
    platform.getPermission.mockClear();
    signalReminders('permissionChanged');
    await flush();
    expect(platform.getPermission).toHaveBeenCalledTimes(1);
    expect(mockSync.sync).toHaveBeenCalledTimes(1);
    expect(useWorkoutReminders.getState().permission).toBe('granted');
  });
});

describe('T-172 fix b: the plan cache belongs to the signed-in user', () => {
  test('the sync gets the cache; it reads back only for the same user; sign-out clears it', async () => {
    start();
    expect(createReminderSync.mock.calls[0][0].cache).toBe(reminderPlanCache);
    const plan = { enrollment: { id: 1, status: 'active' }, schedule: [] };
    await reminderPlanCache.save(plan);
    expect(JSON.parse(mockPrefs.get(REMINDER_PLAN_CACHE_KEY))).toEqual({ owner: 'auth0|a', current: plan });
    await expect(reminderPlanCache.load()).resolves.toEqual(plan);
    useAuthStore.setState({ status: AuthStatus.signedIn, user: OTHER, claims: CLAIMS_B });
    await expect(reminderPlanCache.load()).resolves.toBeUndefined();
    useAuthStore.setState({ status: AuthStatus.signedOut, user: null, claims: null });
    await flush();
    expect(mockPrefs.get(REMINDER_PLAN_CACHE_KEY)).toBe('');
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER, claims: CLAIMS_A });
    await expect(reminderPlanCache.load()).resolves.toBeUndefined();
  });

  // Review M1: online the user is the /auth/me user (with an id); an offline cold start has only { email, roles }.
  // Both carry the token's sub, so a plan saved online loads offline.
  test('online save → offline cold-start load (keyed on claims.sub); another sub gets nothing', async () => {
    const plan = { enrollment: { id: 1, status: 'active' }, schedule: [] };
    useAuthStore.setState({ status: AuthStatus.signedIn, user: { id: 7, roles: ['member'] }, claims: CLAIMS_A });
    await reminderPlanCache.save(plan);
    useAuthStore.setState({ status: AuthStatus.signedIn, user: { email: 'a@example.com', roles: ['member'] }, claims: CLAIMS_A });
    await expect(reminderPlanCache.load()).resolves.toEqual(plan);
    useAuthStore.setState({ status: AuthStatus.signedIn, user: { email: 'b@example.com', roles: ['member'] }, claims: CLAIMS_B });
    await expect(reminderPlanCache.load()).resolves.toBeUndefined();
  });

  test('no sub (claims not known yet): nothing is saved or loaded', async () => {
    useAuthStore.setState({ status: AuthStatus.signedIn, user: MEMBER, claims: null });
    await reminderPlanCache.save({ enrollment: { id: 1 } });
    expect(mockPrefs.has(REMINDER_PLAN_CACHE_KEY)).toBe(false);
    await expect(reminderPlanCache.load()).resolves.toBeUndefined();
  });

  test('"no plan" is cached as null (not "nothing cached")', async () => {
    await reminderPlanCache.save(null);
    await expect(reminderPlanCache.load()).resolves.toBeNull();
  });
});

describe('T-172 fix d: the last sync is kept on the device', () => {
  test('the report lands in the store and in preferences', async () => {
    start();
    const { onReport } = createReminderSync.mock.calls[0][0];
    onReport({ count: 0, source: 'api', reason: 'no-schedule', status: null });
    expect(useWorkoutReminders.getState().lastSync).toEqual(expect.objectContaining({ count: 0, source: 'api', reason: 'no-schedule', status: null, at: expect.any(String) }));
    await flush();
    expect(JSON.parse(mockPrefs.get(REMINDER_LAST_SYNC_KEY))).toEqual(expect.objectContaining({ reason: 'no-schedule' }));
  });
});
