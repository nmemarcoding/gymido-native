import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  calibrateFromResponse,
  calibrateServerClock,
  findFreshTimestamp,
  getServerOffsetMinutes,
  hydrateServerOffset,
  resetServerOffsetCache,
  SERVER_OFFSET_STORAGE_KEY,
} from './serverClock';

const DATE_HEADER = 'Mon, 21 Sep 2026 20:00:00 GMT';

function mutation(method, data, date = DATE_HEADER) {
  return { config: { method }, headers: { date }, data: { success: true, data } };
}

beforeEach(async () => {
  resetServerOffsetCache();
  await AsyncStorage.clear();
});

test('uses the same AsyncStorage key as the web localStorage key', () => {
  expect(SERVER_OFFSET_STORAGE_KEY).toBe('server_utc_offset_minutes');
});

test('true-UTC backend calibrates to 0 and persists it as a string', async () => {
  calibrateFromResponse(mutation('post', { enrollment: { created_at: '2026-09-21T20:00:04Z' } }));
  // Math.round of a tiny negative is -0, exactly as on the web; it compares === 0.
  expect(getServerOffsetMinutes() === 0).toBe(true);
  await Promise.resolve();
  expect(await AsyncStorage.getItem(SERVER_OFFSET_STORAGE_KEY)).toBe('0');
});

test('rounds to 15 minutes', () => {
  calibrateServerClock(DATE_HEADER, '2026-09-21T13:08:00Z');
  expect(getServerOffsetMinutes()).toBe(6 * 60 + 45);
});

test('rejects offsets beyond ±840 minutes', () => {
  calibrateServerClock(DATE_HEADER, '2026-09-21T05:00:00Z');
  expect(getServerOffsetMinutes()).toBeNull();
});

test('treats a timezone-less timestamp as UTC', () => {
  calibrateServerClock(DATE_HEADER, '2026-09-21 13:00:00');
  expect(getServerOffsetMinutes()).toBe(420);
});

describe('findFreshTimestamp', () => {
  test('POST checks created_at before updated_at', () => {
    expect(findFreshTimestamp({ created_at: 'c', updated_at: 'u' }, 'post')).toBe('c');
  });

  test('PUT/PATCH check updated_at before created_at', () => {
    expect(findFreshTimestamp({ created_at: 'c', updated_at: 'u' }, 'put')).toBe('u');
    expect(findFreshTimestamp({ created_at: 'c', updated_at: 'u' }, 'patch')).toBe('u');
  });

  test('looks one level down into non-array objects only', () => {
    expect(findFreshTimestamp({ schedule: [{ created_at: 'x' }], enrollment: { created_at: 'e' } }, 'post')).toBe('e');
    expect(findFreshTimestamp({ enrollment_id: 31, schedule: [{ created_at: 'x' }] }, 'post')).toBeNull();
  });
});

test('GET responses never calibrate', () => {
  calibrateFromResponse(mutation('get', { created_at: '2026-09-21T13:00:00Z' }));
  expect(getServerOffsetMinutes()).toBeNull();
});

test('reads the Date header from AxiosHeaders too', () => {
  const response = mutation('post', { created_at: '2026-09-21T20:00:00Z' });
  response.headers = { get: (name) => (name === 'date' ? DATE_HEADER : undefined) };
  calibrateFromResponse(response);
  expect(getServerOffsetMinutes()).toBe(0);
});

test('⚠10 parity: a cancel response stores the enrollment age as the offset', () => {
  // Enrollment created 3h10m before the cancel; POST checks created_at first.
  calibrateFromResponse(
    mutation('post', {
      enrollment: { id: 31, status: 'cancelled', created_at: '2026-09-21T16:50:00Z', updated_at: '2026-09-21T20:00:00Z' },
    })
  );
  expect(getServerOffsetMinutes()).toBe(195);
});

test('a malformed response never throws', () => {
  expect(() => calibrateFromResponse({ config: { method: 'post' }, headers: { date: 'nonsense' }, data: null })).not.toThrow();
});

test('hydrates the stored offset on launch', async () => {
  await AsyncStorage.setItem(SERVER_OFFSET_STORAGE_KEY, '60');
  await hydrateServerOffset();
  expect(getServerOffsetMinutes()).toBe(60);
});
