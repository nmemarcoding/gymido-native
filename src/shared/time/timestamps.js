// Timestamp parsing of RN-SPEC-time §1.3 and §2, reproduced exactly,
// including the production wall-clock shift (a known web bug, ⚠T1).

const OFFSET_SUFFIX = /([Zz]|[+-]\d{2}:?\d{2})$/;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeTimestamp(value) {
  if (typeof value !== 'string') {
    return value;
  }
  if (OFFSET_SUFFIX.test(value)) {
    return value;
  }
  if (LOCAL_DATE_TIME.test(value)) {
    return `${value.replace(' ', 'T')}Z`;
  }
  return value;
}

const validOrNull = (date) => (Number.isNaN(date.getTime()) ? null : date);

// §2.2. A plain date is DEVICE-LOCAL midnight.
export function parseDateValue(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return validOrNull(value);
  }
  const dateOnly = typeof value === 'string' ? value.match(DATE_ONLY) : null;
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return validOrNull(new Date(normalizeTimestamp(value)));
}

// §1.3: shift an instant by its wall-clock offset in `zone`.
export function reinterpretWallClockInZone(date, zone) {
  try {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .forEach((part) => {
        parts[part.type] = Number(part.value);
      });
    const zoneWallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offsetMs = zoneWallAsUtc - date.getTime();
    return new Date(date.getTime() - offsetMs);
  } catch {
    return date;
  }
}

// Deterministic Los Angeles offset for Hermes builds without Intl time zones:
// −7h between the 2nd Sunday of March 10:00 UTC and the 1st Sunday of
// November 09:00 UTC, else −8h.
function nthSundayUtc(year, month, n, hourUtc) {
  const first = new Date(Date.UTC(year, month, 1));
  const day = 1 + ((7 - first.getUTCDay()) % 7) + (n - 1) * 7;
  return Date.UTC(year, month, day, hourUtc);
}

export function reinterpretLosAngelesFallback(date) {
  const year = date.getUTCFullYear();
  const dstStart = nthSundayUtc(year, 2, 2, 10);
  const dstEnd = nthSundayUtc(year, 10, 1, 9);
  const time = date.getTime();
  const offsetHours = time >= dstStart && time < dstEnd ? -7 : -8;
  return new Date(time - offsetHours * 3600 * 1000);
}

// The startup self-test of §1.3.
export function intlZoneShiftWorks() {
  const summer = reinterpretWallClockInZone(new Date('2026-07-01T12:00:00Z'), 'America/Los_Angeles');
  const winter = reinterpretWallClockInZone(new Date('2026-01-15T12:00:00Z'), 'America/Los_Angeles');
  return summer.toISOString() === '2026-07-01T19:00:00.000Z' && winter.toISOString() === '2026-01-15T20:00:00.000Z';
}

let intlWorks = null;

// §2.3. `serverTimeZone` is null in development builds.
export function parseTimestamp(value, serverTimeZone) {
  const date = parseDateValue(value);
  if (!date || !serverTimeZone) {
    return date;
  }
  if (intlWorks === null) {
    intlWorks = intlZoneShiftWorks();
  }
  if (!intlWorks && serverTimeZone === 'America/Los_Angeles') {
    return reinterpretLosAngelesFallback(date);
  }
  return reinterpretWallClockInZone(date, serverTimeZone);
}
