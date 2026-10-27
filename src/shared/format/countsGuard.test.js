const fs = require('fs');
const path = require('path');

// RN-SPEC-v2-foundation §7.1 (dated changes 27 Oct 2026): every displayed
// count of days goes through formatCount (singular for 1, U+00A0 before the
// unit), and every displayed plan name through keepUnitsTogether. This scans
// src/**/*.js (tests excluded) so a raw template cannot come back.

const SRC = path.resolve(__dirname, '../..');

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) return [];
    return [full];
  });
}

function codeLines() {
  return listJs(SRC).flatMap((full) => {
    const file = path.relative(SRC, full).split(path.sep).join('/');
    return fs
      .readFileSync(full, 'utf8')
      .split('\n')
      .map((text, index) => ({ file, line: index + 1, text }))
      .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text));
  });
}

function hitsOf(patterns, allowed) {
  return codeLines()
    .filter(({ text }) => patterns.some((pattern) => pattern.test(text)))
    .filter(({ file, text }) => !allowed.some((entry) => entry.file === file && text.includes(entry.text)))
    .map(({ file, line, text }) => `${file}:${line} ${text.trim()}`);
}

const DAY_PATTERNS = [
  // `${n} days`, `${n} training days`, JSX "{n} days" (an interpolation, a
  // space, at most one word, then day/days; not a JSX `day=` prop).
  /\{[^{}]*\}\s+(?:[a-z]+\s+)?days?\b(?!=)/,
  // Hand-made plurals: `day${plural}`, `day${n === 1 ? '' : 's'}`.
  /\bdays?\$\{/,
];

const DAY_ALLOWED = [
  // The one count with no singular (n >= 7 only).
  { file: 'features/trainer/clients/clientActivity.js', text: '`No workout in ${days} days`' },
  // A word, not a count ("all available days" when the plan has no limit).
  { file: 'features/trainer/plans/planValidation.js', text: '`This plan already has all ${fallback} days.`' },
];

test('no raw day-count template outside formatCount', () => {
  expect(hitsOf(DAY_PATTERNS, DAY_ALLOWED)).toEqual([]);
});

const NAME = String.raw`[\w?.]*(?:plan\??\.name|planName|plan_name|planInfo\??\.name)`;
const NAME_PATTERNS = [
  // A JSX child on its own line: {plan.name}, {planName || 'Workout'}.
  new RegExp(String.raw`^\s*\{${NAME}(?:\s*(?:\|\||\?\?)[^}]*)?\}\s*$`, 'i'),
  // A template that interpolates the name: `${planName} created.`
  new RegExp(String.raw`\$\{${NAME}(?:\s*(?:\|\||\?\?)[^}]*)?\}`, 'i'),
  // The trainer client rows' plan name (clientActivity.planNameOf) shown unwrapped.
  /(?<!keepUnitsTogether\()\bplanNameOf\((?:row|client)\)/,
];

const NAME_ALLOWED = [
  // Share text leaves the app: the raw name (dated change 27 Oct, PM).
  { file: 'features/workout/runtime/restPresentation.js', text: '`Workout complete: ${popup.planName' },
  // Client search matches the raw name (never display text).
  { file: 'features/trainer/clients/clientActivity.js', text: 'const plan = planNameOf(row);' },
  { file: 'features/trainer/clients/clientActivity.js', text: 'export function planNameOf(row) {' },
];

test('no raw plan-name display outside keepUnitsTogether', () => {
  const hits = hitsOf(NAME_PATTERNS, NAME_ALLOWED).filter((hit) => !/accessibilityLabel/.test(hit));
  expect(hits).toEqual([]);
});
