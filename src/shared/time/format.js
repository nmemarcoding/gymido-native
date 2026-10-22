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
