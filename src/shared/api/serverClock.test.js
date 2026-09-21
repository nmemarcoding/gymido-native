import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  calibrateServerClock,
  getServerOffsetMinutes,
  hydrateServerOffset,
  resetServerOffsetCache,
  SERVER_OFFSET_STORAGE_KEY,
} from './serverClock';

const DATE_HEADER = 'Mon, 21 Sep 2026 20:00:00 GMT';

beforeEach(async () => {
  resetServerOffsetCache();
  await AsyncStorage.clear();
});

test('uses the same AsyncStorage key as the web localStorage key', () => {
  expect(SERVER_OFFSET_STORAGE_KEY).toBe('server_utc_offset_minutes');
});

// The web API is ported for parity, but nothing in the app calls
// calibrateServerClock (RN-SPEC-time §1.2); these pin the dormant maths only.
test('the ported maths: a true-UTC timestamp gives 0, persisted as a string', async () => {
  calibrateServerClock(DATE_HEADER, '2026-09-21T20:00:04Z');
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

test('hydrates the stored offset on launch', async () => {
  await AsyncStorage.setItem(SERVER_OFFSET_STORAGE_KEY, '60');
  await hydrateServerOffset();
  expect(getServerOffsetMinutes()).toBe(60);
});

test('RN-SPEC-time §1.2: with nothing stored the offset is null', async () => {
  await hydrateServerOffset();
  expect(getServerOffsetMinutes()).toBeNull();
});
