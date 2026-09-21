import { ensureUtc, getServerOffsetMinutes } from '../api/serverClock';
import { env } from '../config/env';

// Port of the web app's shared/utils/formatters.js date helpers.

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }
  }
  const parsedDate = new Date(ensureUtc(value));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

// The date's UTC fields are the server's wall-clock components; shift the
// instant by that zone's offset for those components (DST-aware).
export function reinterpretWallClockInZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const zoneWallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs = zoneWallAsUtc - date.getTime();
  return new Date(date.getTime() - offsetMs);
}

// Deterministic America/Los_Angeles reinterpretation for a Hermes build whose
// Intl lacks timeZone support (RN-SPEC-time §1.3): -8h, or -7h between the
// 2nd Sunday of March 10:00 UTC and the 1st Sunday of November 09:00 UTC.
function nthSundayUtc(year, month, nth) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstWeekday) % 7) + (nth - 1) * 7;
}

export function reinterpretLosAngelesFallback(date) {
  const year = date.getUTCFullYear();
  const dstStart = Date.UTC(year, 2, nthSundayUtc(year, 2, 2), 10);
  const dstEnd = Date.UTC(year, 10, nthSundayUtc(year, 10, 1), 9);
  const time = date.getTime();
  const offsetHours = time >= dstStart && time < dstEnd ? -7 : -8;
  return new Date(time - offsetHours * 3600000);
}

// Startup self-test of Hermes Intl timeZone support; cached after first use.
let intlZoneSupported;
export function intlTimeZoneWorks() {
  if (intlZoneSupported === undefined) {
    try {
      const summer = reinterpretWallClockInZone(new Date('2026-07-01T12:00:00Z'), 'America/Los_Angeles');
      const winter = reinterpretWallClockInZone(new Date('2026-01-15T12:00:00Z'), 'America/Los_Angeles');
      intlZoneSupported =
        summer.toISOString() === '2026-07-01T19:00:00.000Z' && winter.toISOString() === '2026-01-15T20:00:00.000Z';
    } catch {
      intlZoneSupported = false;
    }
  }
  return intlZoneSupported;
}

// Test hook.
export function setIntlTimeZoneWorksForTest(value) {
  intlZoneSupported = value;
}

function reinterpret(date, timeZone) {
  if (!intlTimeZoneWorks() && timeZone === 'America/Los_Angeles') {
    return reinterpretLosAngelesFallback(date);
  }
  return reinterpretWallClockInZone(date, timeZone);
}

// Backend timestamp → Date or null (RN-SPEC-time §1.3). Priority: the stored
// server offset (always null: calibration is dormant), then the
// per-environment API_SERVER_TZ wall-clock reinterpretation, then none.
export function parseTimestamp(value, serverTimeZone = env.apiServerTz) {
  const date = parseDateValue(value);
  if (!date) {
    return null;
  }
  const offsetMinutes = getServerOffsetMinutes();
  if (offsetMinutes !== null) {
    return offsetMinutes === 0 ? date : new Date(date.getTime() + offsetMinutes * 60000);
  }
  if (serverTimeZone) {
    try {
      return reinterpret(date, serverTimeZone);
    } catch {
      return date;
    }
  }
  return date;
}

// YYYY-MM-DD from the UTC calendar fields, not the device-local date (⚠7).
export function formatDateForInput(value = new Date()) {
  const date = parseDateValue(value);
  if (!date) {
    return '';
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
