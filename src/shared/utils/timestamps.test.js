import { calibrateServerClock, resetServerOffsetCache } from '../api/serverClock';
import { formatDateForInput, parseTimestamp } from './timestamps';

beforeEach(() => {
  resetServerOffsetCache();
});

test('tests run in a zone behind UTC (see jest.globalSetup.js)', () => {
  expect(new Date('2026-09-22T03:00:00Z').getDate()).toBe(21);
});

describe('formatDateForInput (⚠7)', () => {
  test('uses the UTC calendar date, not the device-local date', () => {
    // 20:00 PDT on Sep 21 is already Sep 22 in UTC.
    expect(formatDateForInput(new Date('2026-09-22T03:00:00Z'))).toBe('2026-09-22');
  });

  test('pads month and day', () => {
    expect(formatDateForInput(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });

  test('empty string for an invalid date', () => {
    expect(formatDateForInput('not a date')).toBe('');
  });
});

describe('parseTimestamp', () => {
  test('no offset and no server zone: the instant as sent', () => {
    expect(parseTimestamp('2026-09-21T12:00:00Z', null).toISOString()).toBe('2026-09-21T12:00:00.000Z');
  });

  test('before calibration, reinterprets as Los Angeles wall-clock (production default), DST-aware', () => {
    expect(parseTimestamp('2026-09-21T12:00:00Z', 'America/Los_Angeles').toISOString()).toBe(
      '2026-09-21T19:00:00.000Z'
    );
    expect(parseTimestamp('2026-01-15T12:00:00Z', 'America/Los_Angeles').toISOString()).toBe(
      '2026-01-15T20:00:00.000Z'
    );
  });

  test('a calibrated offset takes priority over the zone fallback', () => {
    calibrateServerClock('Mon, 21 Sep 2026 20:00:00 GMT', '2026-09-21T20:00:00Z');
    expect(parseTimestamp('2026-09-21T12:00:00Z', 'America/Los_Angeles').toISOString()).toBe(
      '2026-09-21T12:00:00.000Z'
    );
  });

  test('applies a non-zero calibrated offset', () => {
    calibrateServerClock('Mon, 21 Sep 2026 20:00:00 GMT', '2026-09-21T13:00:00Z');
    expect(parseTimestamp('2026-09-21T12:00:00Z', null).toISOString()).toBe('2026-09-21T19:00:00.000Z');
  });

  test('null for empty or invalid input', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp('garbage')).toBeNull();
  });
});
