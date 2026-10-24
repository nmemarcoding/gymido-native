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
