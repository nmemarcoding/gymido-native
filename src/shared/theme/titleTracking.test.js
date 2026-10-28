const fs = require('fs');
const path = require('path');

// UX native final audit 27 Oct 2026, ruling 5 as amended by (k)/(f2) ruling
// f2: big titles keep letter-spacing ≥ −0.04em ON ANDROID ONLY (that's where
// Geist's letters collide); iOS keeps the board values. There are no Android
// exceptions (Welcome 84 included). titleTracking(fontSize, boardEm) is the
// one conversion, so a style never hard-codes a px value tighter than the floor.

const SRC = path.resolve(__dirname, '../..');
const TOKENS = path.join(SRC, 'shared/theme/tokens.js');
const FLOOR_EM = -0.04;

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js') || full === TOKENS) return [];
    return [full];
  });
}

// The innermost `{ … }` around `index`: the style object the literal sits in.
function enclosingObject(source, index) {
  let depth = 0;
  let start = index;
  for (; start >= 0; start -= 1) {
    if (source[start] === '}') depth += 1;
    else if (source[start] === '{') {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  depth = 0;
  let end = index;
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    else if (source[end] === '}') {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  return source.slice(start, end + 1);
}

// The style's font size: a literal or a file constant, else the size of a
// spread type token (`...typography.displayLg`, `...textScale.x`).
function fontSizeOf(style, source) {
  const { textScale, typography } = require('./tokens');
  const own = style.match(/\bfontSize:\s*([A-Za-z_$][\w$]*|[\d.]+)/);
  if (own) {
    if (/^[\d.]+$/.test(own[1])) return Number(own[1]);
    const constant = source.match(new RegExp(`const ${own[1]} = ([\\d.]+);`));
    return constant ? Number(constant[1]) : null;
  }
  const spread = style.match(/\.\.\.(typography|textScale)\.(\w+)/);
  if (spread) return ({ typography, textScale })[spread[1]][spread[2]]?.fontSize ?? null;
  return null;
}

describe('ruling 5 (f2): title tracking source guard', () => {
  it('every negative letterSpacing literal tighter than −0.04em goes through titleTracking', () => {
    const offenders = [];
    let scanned = 0;
    listJs(SRC).forEach((full) => {
      const file = path.relative(SRC, full).split(path.sep).join('/');
      const source = fs.readFileSync(full, 'utf8');
      const literal = /letterSpacing:\s*(-[\d.]+)/g;
      let match;
      while ((match = literal.exec(source))) {
        scanned += 1;
        const line = source.slice(0, match.index).split('\n').length;
        const size = fontSizeOf(enclosingObject(source, match.index), source);
        // A literal whose size the scan cannot see is an offender too: give it
        // a fontSize in the same style, or route it through titleTracking.
        if (size == null) offenders.push(`${file}:${line} ${match[1]} (no fontSize in its style)`);
        else if (Number(match[1]) < FLOOR_EM * size - 1e-9) offenders.push(`${file}:${line} ${size}/${match[1]}`);
      }
    });
    expect(scanned).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });

  // Reviewer carry (65504db): every letterSpacing (a style key or a JSX prop)
  // is a numeric literal (checked above), a titleTracking() call or a token
  // reference, so a computed value can't dodge the literal scan. The named
  // exceptions below are the only other values allowed.
  const EXCEPTIONS = [
    // PM ruling 27 Oct 2026: the "404" numeral is react-native-svg Text, which
    // never wraps, so the Android floor (against word splits) doesn't apply;
    // it keeps the board's −0.07em.
    { file: 'features/shell/NotFoundScreen.js', value: 'NUMERAL_TRACKING' },
  ];

  it('every letterSpacing is a literal, a titleTracking() call or a token reference (or a named exception)', () => {
    const others = [];
    const seen = new Set();
    listJs(SRC).forEach((full) => {
      const file = path.relative(SRC, full).split(path.sep).join('/');
      const source = fs.readFileSync(full, 'utf8');
      const any = /letterSpacing\s*(?::|=\{?)\s*([^,}\n]+)/g;
      let match;
      while ((match = any.exec(source))) {
        const value = match[1].trim();
        if (/^-?[\d.]+$/.test(value) || /^titleTracking\(/.test(value) || /^(typography|textScale)\.\w+\.letterSpacing$/.test(value)) continue;
        const exception = EXCEPTIONS.find((entry) => entry.file === file && entry.value === value);
        if (exception) seen.add(exception);
        else others.push(`${file} ${value}`);
      }
    });
    expect(others).toEqual([]);
    // A stale exception (the code it names is gone or changed) fails too.
    expect(EXCEPTIONS.filter((entry) => !seen.has(entry))).toEqual([]);
  });
});

// Behaviour: the routed screens build their StyleSheets at module load, so
// each platform loads its own copy and the test reads the style objects the
// module handed to StyleSheet.create.
function stylesOn(os, modulePath) {
  const sheets = [];
  jest.isolateModules(() => {
    const { Platform, StyleSheet } = require('react-native');
    Platform.OS = os;
    const create = StyleSheet.create;
    StyleSheet.create = (styles) => {
      sheets.push(styles);
      return create(styles);
    };
    try {
      require(modulePath);
    } finally {
      StyleSheet.create = create;
    }
  });
  return Object.assign({}, ...sheets);
}

// Mocked only so the screens load outside a navigator / native shell.
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../features/shell/ShellPage', () => (props) => props.children);
jest.mock('react-native-auth0', () => jest.fn());
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));

describe('ruling 5 (f2): routed titles per platform', () => {
  // module, style key, font size, board em
  const SAMPLES = [
    ['../../features/auth/screens/WelcomeScreen', 'titleTablet', 84, -0.06],
    ['../../features/profile/CreateProfileScreen', 'titlePhone', 48, -0.055],
    ['../../features/profile/CreateProfileScreen', 'titleTablet', 60, -0.055],
    ['../../features/progress/ProgressScreen', 'currentPhone', 52, -0.05],
    // DECLARED (T-76): was TodayHeroCard planNameTablet 60/−0.055 (card retired); the hub's today title.
    ['../../features/workout/components/hub/HubTodayCard', 'title', 32, -0.04],
    ['../../features/workout/runtime/RuntimeOverlays', 'digitsTablet', 100, -0.06],
  ];

  it.each(SAMPLES)('%s %s: Android holds −0.04em, iOS keeps the board', (modulePath, key, size, em) => {
    const android = stylesOn('android', modulePath)[key];
    const ios = stylesOn('ios', modulePath)[key];
    expect(android.letterSpacing).toBe(Math.round(FLOOR_EM * size * 100) / 100);
    expect(android.letterSpacing).toBeGreaterThanOrEqual(FLOOR_EM * size - 1e-9);
    expect(ios.letterSpacing).toBe(Math.round(em * size * 100) / 100);
  });
});
