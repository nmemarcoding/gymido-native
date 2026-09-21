import AsyncStorage from '@react-native-async-storage/async-storage';

// Port of the web app's self-calibrating server clock (shared/utils/serverClock.js
// + the response hook in shared/api/api.js). The backend may serialize local
// wall-clock timestamps as UTC; comparing the HTTP `Date` header with a
// timestamp the server just set gives the offset to add to backend timestamps.
//
// Parity notes (RN-SPEC-plans §7, ⚠10): same key, same field search order,
// same rounding and bound. A cancel response carries an old created_at, so it
// can store a wrong offset; that is web behavior and is kept.

export const SERVER_OFFSET_STORAGE_KEY = 'server_utc_offset_minutes';
const MAX_OFFSET_MINUTES = 14 * 60;
const MUTATION_METHODS = new Set(['post', 'put', 'patch']);

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

// A timestamp the server just generated: created_at on POST, updated_at on
// PUT/PATCH, on the entity itself or one level of non-array nesting.
export function findFreshTimestamp(body, method) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const fields = method === 'post' ? ['created_at', 'updated_at'] : ['updated_at', 'created_at'];
  const pick = (obj) => {
    if (!obj || typeof obj !== 'object') {
      return null;
    }
    return fields.map((field) => obj[field]).find((value) => typeof value === 'string') || null;
  };

  const direct = pick(body);
  if (direct) {
    return direct;
  }
  for (const key of Object.keys(body)) {
    const child = body[key];
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = pick(child);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

// Axios response hook. Never lets calibration interfere with a response.
export function calibrateFromResponse(response) {
  try {
    const method = response?.config?.method?.toLowerCase();
    const headers = response?.headers;
    const dateHeader = typeof headers?.get === 'function' ? headers.get('date') : headers?.date;
    if (dateHeader && MUTATION_METHODS.has(method)) {
      const fresh = findFreshTimestamp(response.data?.data, method);
      if (fresh) {
        calibrateServerClock(dateHeader, fresh);
      }
    }
  } catch {
    /* ignore */
  }
  return response;
}
