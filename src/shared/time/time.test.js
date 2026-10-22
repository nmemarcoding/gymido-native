import { formatRelativeTime } from './relativeTime';
import {
  intlZoneShiftWorks,
  normalizeTimestamp,
  parseDateValue,
  parseTimestamp,
  reinterpretLosAngelesFallback,
} from './timestamps';

describe('normalizeTimestamp / parseDateValue', () => {
  it('appends Z only to naive date-times', () => {
    expect(normalizeTimestamp('2026-09-21T14:03:22Z')).toBe('2026-09-21T14:03:22Z');
    expect(normalizeTimestamp('2026-09-21T14:03:22+02:00')).toBe('2026-09-21T14:03:22+02:00');
    expect(normalizeTimestamp('2026-09-21 14:03:22')).toBe('2026-09-21T14:03:22Z');
    expect(normalizeTimestamp(5)).toBe(5);
  });

  it('parses date-only values as device-local midnight', () => {
    const date = parseDateValue('2026-09-14');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 8, 14, 0]);
    expect(parseDateValue('')).toBeNull();
    expect(parseDateValue('nope')).toBeNull();
  });
});

describe('parseTimestamp', () => {
  it('passes through without a server zone (development)', () => {
    expect(parseTimestamp('2026-07-01T12:00:00Z', null).toISOString()).toBe('2026-07-01T12:00:00.000Z');
  });

  it('shifts by the Los Angeles wall clock, DST-aware', () => {
    expect(intlZoneShiftWorks()).toBe(true);
    expect(parseTimestamp('2026-07-01T12:00:00Z', 'America/Los_Angeles').toISOString()).toBe('2026-07-01T19:00:00.000Z');
    expect(parseTimestamp('2026-01-15T12:00:00Z', 'America/Los_Angeles').toISOString()).toBe('2026-01-15T20:00:00.000Z');
  });

  it('has a matching deterministic fallback', () => {
    const cases = ['2026-07-01T12:00:00Z', '2026-01-15T12:00:00Z', '2026-03-08T09:59:00Z', '2026-03-08T10:00:00Z', '2026-11-01T09:00:00Z'];
    const expected = ['2026-07-01T19:00:00.000Z', '2026-01-15T20:00:00.000Z', '2026-03-08T17:59:00.000Z', '2026-03-08T17:00:00.000Z', '2026-11-01T17:00:00.000Z'];
    expect(cases.map((c) => reinterpretLosAngelesFallback(new Date(c)).toISOString())).toEqual(expected);
  });
});

describe('formatRelativeTime (§7.6)', () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 0);
  const ago = (seconds) => formatRelativeTime(new Date(now - seconds * 1000), now);

  it('follows the table', () => {
    expect(formatRelativeTime(null, now)).toBe('Just now');
    expect(ago(-50)).toBe('Just now');
    expect(ago(9)).toBe('Just now');
    expect(ago(10)).toBe('10 seconds ago');
    expect(ago(60)).toBe('1 minute ago');
    expect(ago(3599)).toBe('59 minutes ago');
    expect(ago(3600)).toBe('1 hour ago');
    expect(ago(7200)).toBe('2 hours ago');
    expect(ago(86400)).toBe('yesterday');
    expect(ago(86400 * 3)).toBe('3 days ago');
    expect(ago(2592000)).toBe('last month');
    expect(ago(2592000 * 5)).toBe('5 months ago');
    expect(ago(31536000)).toBe('last year');
    expect(ago(31536000 * 2)).toBe('2 years ago');
  });
});
