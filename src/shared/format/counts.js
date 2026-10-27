// Day counts and value + unit text (RN-SPEC-v2-foundation §7.1, dated changes
// 27 Oct 2026; web `shared/utils/formatters.js` formatCount / keepUnitsTogether).

// U+00A0: keeps a number on the same line as its unit. Display only: never in
// form values, search matching, share/copy text or anything sent to the server.
export const NBSP = ' ';

// The word for a count: the singular for exactly 1 ("1 day"), else the plural.
export function pluralWord(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

// "1 day", "3 days", "1 training day", joined by U+00A0. Every displayed
// count of days goes through here (the only raw plural left is the trainer's
// "No workout in {n} days", n >= 7).
export function formatCount(count, singular, plural) {
  return `${count}${NBSP}${pluralWord(count, singular, plural)}`;
}

// A digit, ONE normal space, then the lowercase whole word day / days / min.
// "Day 3 ·", "3 Days", "3 minutes" and numbers written as words stay as is.
const VALUE_UNIT = /(\d) (days?|min)(?![\p{L}\p{N}_])/gu;

// Display time only: "Get stronger · 3 days" → "Get stronger · 3 days".
// Non-strings (null, undefined) pass through unchanged.
export function keepUnitsTogether(text) {
  return typeof text === 'string' ? text.replace(VALUE_UNIT, `$1${NBSP}$2`) : text;
}
