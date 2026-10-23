import { parseDateValue } from './timestamps';

// The en-US fixed date formats of RN-SPEC-time §5, built by hand so Hermes
// and ICU differences can't change the output.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "{Mon} {d}" in the device time zone after shifting by `days` UTC days;
// invalid → "—". Always called with days = 1 (⚠T3/⚠T4 in the time spec).
export function formatDateWithOffset(value, days = 0) {
  const date = parseDateValue(value);
  if (!date) {
    return '—';
  }
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return `${MONTHS[shifted.getMonth()]} ${shifted.getDate()}`;
}

// "{Mon} {d}, {yyyy}" in the device time zone; invalid → "—".
export function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) {
    return '—';
  }
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// RN-SPEC-time §5 formatDuration: never hours ("95m 3s"); null/NaN → "—";
// a negative value shows "0s".
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
    return '—';
  }
  const total = Math.max(0, Math.round(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) {
    return `${rest}s`;
  }
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

// The device's LOCAL calendar date as YYYY-MM-DD (weight-log recorded_on,
// dated change 23 Oct 2026; ⚠H-11 retired).
export function formatLocalDateForInput(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
