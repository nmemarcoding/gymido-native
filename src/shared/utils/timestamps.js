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

// Backend timestamp → Date or null. Correction priority: the calibrated server
// offset, then the per-environment API_SERVER_TZ, then none.
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
      return reinterpretWallClockInZone(date, serverTimeZone);
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
