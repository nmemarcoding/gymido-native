const fs = require('fs');
const path = require('path');

// P1-02: every colour lives in tokens.js. This scans src/**/*.js (tests and
// tokens.js excluded) for hex colours, rgb()/rgba() literals and quoted
// 'white' / 'black', so a new literal cannot bypass the tokens.

const SRC = path.resolve(__dirname, '../..');
const TOKENS = path.join(SRC, 'shared/theme/tokens.js');

const PATTERNS = [
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/,
  /\brgba?\(/,
  /['"`](?:white|black)['"`]/i,
];

// `file:line text` entries that may keep a match, each with its reason.
const ALLOWED = [
  // splitStopColor rebuilds an rgba() token as rgb() + stopOpacity for
  // react-native-svg; it formats a token value, it is not a colour itself.
  { file: 'shared/components/GradientFill.js', text: 'stopColor: `rgb(${r}, ${g}, ${b})`' },
];

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js') || full === TOKENS) return [];
    return [full];
  });
}

function isAllowed(file, line) {
  return ALLOWED.some((entry) => file === entry.file && line.includes(entry.text));
}

test('no colour literal outside tokens.js', () => {
  const hits = [];
  listJs(SRC).forEach((full) => {
    const file = path.relative(SRC, full).split(path.sep).join('/');
    fs.readFileSync(full, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (PATTERNS.some((pattern) => pattern.test(line)) && !isAllowed(file, line)) {
          hits.push(`${file}:${index + 1} ${line.trim()}`);
        }
      });
  });
  expect(hits).toEqual([]);
});

test('every allow-list entry still matches a line', () => {
  ALLOWED.forEach((entry) => {
    const source = fs.readFileSync(path.join(SRC, entry.file), 'utf8');
    expect(source.includes(entry.text)).toBe(true);
  });
});
