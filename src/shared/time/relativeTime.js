// App-shell spec §7.6, implemented directly (no Intl.RelativeTimeFormat).

const UNITS = [
  { min: 31536000, divisor: 31536000, one: 'last year', many: 'years ago' },
  { min: 2592000, divisor: 2592000, one: 'last month', many: 'months ago' },
  { min: 86400, divisor: 86400, one: 'yesterday', many: 'days ago' },
  { min: 3600, divisor: 3600, one: '1 hour ago', many: 'hours ago' },
  { min: 60, divisor: 60, one: '1 minute ago', many: 'minutes ago' },
];

export function formatRelativeTime(date, now = Date.now()) {
  if (!date || Number.isNaN(date.getTime())) {
    return 'Just now';
  }
  const diff = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diff < 10) {
    return 'Just now';
  }
  if (diff < 60) {
    return `${diff} seconds ago`;
  }
  const unit = UNITS.find((candidate) => diff >= candidate.min);
  const n = Math.max(1, Math.floor(diff / unit.divisor));
  return n === 1 ? unit.one : `${n} ${unit.many}`;
}
