import AsyncStorage from '@react-native-async-storage/async-storage';

// Port of the web app's shared/utils/serverClock.js (RN-SPEC-time §1.2).
// DORMANT by design: the web can't read the cross-origin `Date` header, so
// calibrateServerClock is never called there and no offset is ever stored.
// Native never reads `Date` either, so nothing calls calibrateServerClock and
// getServerOffsetMinutes() returns null. The read path is kept so the
// parseTimestamp code path matches the web.

export const SERVER_OFFSET_STORAGE_KEY = 'server_utc_offset_minutes';
const MAX_OFFSET_MINUTES = 14 * 60;

// localStorage is synchronous on the web; AsyncStorage is not. The offset is
// mirrored in memory so parseTimestamp can stay synchronous.
// undefined = not hydrated yet, null = nothing stored.
let cachedOffset;

function toOffset(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// Loads the stored offset into memory. Call once at startup.
export async function hydrateServerOffset() {
  try {
    const raw = await AsyncStorage.getItem(SERVER_OFFSET_STORAGE_KEY);
    if (cachedOffset === undefined) {
      cachedOffset = toOffset(raw);
    }
  } catch {
    if (cachedOffset === undefined) {
      cachedOffset = null;
    }
  }
}

export function getServerOffsetMinutes() {
  return cachedOffset ?? null;
}

export function setServerOffsetMinutes(minutes) {
  cachedOffset = minutes;
  AsyncStorage.setItem(SERVER_OFFSET_STORAGE_KEY, String(minutes)).catch(() => {
    /* ignore storage failures */
  });
}

// Test hook.
export function resetServerOffsetCache() {
  cachedOffset = undefined;
}

// Treat a timezone-less datetime as UTC (matches the backend's serialization).
export function ensureUtc(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return trimmed;
  }
  const isoLike = trimmed.replace(' ', 'T');
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoLike) ? `${isoLike}Z` : trimmed;
}

export function calibrateServerClock(serverDateHeader, freshTimestamp) {
  if (!serverDateHeader || !freshTimestamp) {
    return;
  }
  const trueNowMs = new Date(serverDateHeader).getTime();
  const buggyMs = new Date(ensureUtc(freshTimestamp)).getTime();
  if (!Number.isFinite(trueNowMs) || !Number.isFinite(buggyMs)) {
    return;
  }
  const offsetMinutes = Math.round((trueNowMs - buggyMs) / 60000 / 15) * 15;
  if (Math.abs(offsetMinutes) > MAX_OFFSET_MINUTES) {
    return;
  }
  setServerOffsetMinutes(offsetMinutes);
}
