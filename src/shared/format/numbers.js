// en-US number formats (web `shared/utils/formatters.js`), RN-SPEC-home §H1.5.

const formatters = {};

function formatter(decimals) {
  formatters[decimals] = formatters[decimals] ?? new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals });
  return formatters[decimals];
}

function isMissing(value) {
  return value === null || value === undefined || Number.isNaN(Number(value));
}

// At most `decimals` decimals, no trailing zeros, grouping on; missing → "—".
export function formatNumber(value, decimals = 1) {
  return isMissing(value) ? '—' : formatter(decimals).format(Number(value));
}

export function formatWeight(value, unit, decimals = 1) {
  return isMissing(value) ? '—' : `${formatNumber(value, decimals)} ${unit ?? ''}`.trim();
}

// "+" only above zero; negatives keep en-US's hyphen-minus.
export function formatSignedNumber(value, unit) {
  if (isMissing(value)) {
    return '—';
  }
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${formatNumber(value)} ${unit ?? ''}`.trim();
}

// T-64 (27 Oct 2026, one minus app-wide; web `formatSignedChange`): a real
// minus U+2212 below 0, "+" above, no sign once it rounds to 0 at `decimals`.
export function formatSignedChange(value, unit, decimals = 1) {
  if (isMissing(value)) {
    return '—';
  }
  const number = Number(value);
  const magnitude = formatNumber(Math.abs(number), decimals);
  let sign = '';
  if (magnitude !== '0') {
    sign = number > 0 ? '+' : '\u2212';
  }
  return `${sign}${magnitude} ${unit ?? ''}`.trim();
}

// T-64 (UX/PM, web `formatToGoal`): "To goal" = the change still needed =
// goal − current = −difference_to_goal ("−10 lb" for a loss goal, "+5 kg"
// for a gain goal, "0 kg" once it rounds to 0).
export function formatToGoal(differenceToGoal, unit) {
  return isMissing(differenceToGoal) ? '—' : formatSignedChange(-Number(differenceToGoal), unit);
}

const DECIMAL_TEXT = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

// Typed weights (dated change 25 Oct 2026, T-16): a comma decimal reads as a
// dot ("83,5" → 83.5, "83," → 83, ",5" → 0.5); blank → null; anything else,
// "1e2" and "-2" included, → NaN.
export function parseDecimal(value) {
  const text = String(value ?? '').trim();
  if (text === '') {
    return null;
  }
  return DECIMAL_TEXT.test(text) ? Number(text.replace(',', '.')) : NaN;
}
