const fs = require('fs');
const path = require('path');

const { SHARED_DIR, MANIFEST, SHARED_FILES, sha256 } = require('../../../scripts/shared-files');
const tokensNative = require('../../../scripts/tokens-native');

// T-173 drift checks, run in every Jest gate. Check 3 (the copy vs gymido main) needs a gymido checkout and runs
// as `npm run shared:check`.

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [path.relative(SHARED_DIR, full).split(path.sep).join('/')];
  });
}

describe('check 1: shared/gymido/ is an unedited copy (SHARED_SOURCE.json)', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  test('the manifest names a full gymido SHA and exactly the shared files', () => {
    expect(manifest.gymidoSha).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(manifest.files).sort()).toEqual([...SHARED_FILES].sort());
  });

  test('no file was added to or removed from the copy', () => {
    expect(listFiles(SHARED_DIR).filter((file) => file !== 'SHARED_SOURCE.json').sort()).toEqual(Object.keys(manifest.files).sort());
  });

  test.each(SHARED_FILES)('%s matches its sha256 (edit it in gymido, then npm run shared:sync)', (file) => {
    expect(sha256(fs.readFileSync(path.join(SHARED_DIR, file)))).toBe(manifest.files[file]);
  });
});

describe('check 2: tokens.generated.json is what the generator makes from the copy', () => {
  test('the committed file is up to date (else: npm run tokens)', () => {
    expect(fs.readFileSync(tokensNative.OUTPUT, 'utf8')).toBe(tokensNative.expectedOutput());
  });
});

describe('the native formats (scripts/tokens-native.js)', () => {
  const { generate } = require(tokensNative.CORE);
  const build = (groups) => tokensNative.buildNativeTokens({ $version: '1.0.0', ...groups }, generate);

  test('colours: hex upper-cased, rgb()/rgba() exactly as written (M2)', () => {
    const out = build({
      color: {
        a: { $type: 'color', $value: '#ffc21a' },
        b: { $type: 'color', $value: 'rgba(255, 194, 26, 0.3)' },
        c: { $type: 'color', $value: 'rgba(255, 194, 26, 0.30)' },
      },
    });
    expect(out.color).toEqual({ a: '#FFC21A', b: 'rgba(255, 194, 26, 0.3)', c: 'rgba(255, 194, 26, 0.30)' });
  });

  test('dimensions in px, durations in ms, references resolved', () => {
    const out = build({
      radius: { a: { $type: 'dimension', $value: '1rem' }, b: { $type: 'dimension', $value: '88px' }, c: { $type: 'dimension', $value: '{radius.a}' } },
      duration: { a: { $type: 'duration', $value: '150ms' }, b: { $type: 'duration', $value: '1s' } },
    });
    expect(out.radius).toEqual({ a: 16, b: 88, c: 16 });
    expect(out.duration).toEqual({ a: 150, b: 1000 });
  });

  test('shadows as RN boxShadow strings, every length in px, trailing 0 spread left out', () => {
    const out = build({
      shadow: {
        a: { $type: 'shadow', $value: { color: 'rgba(255, 194, 26, 0.4)', offsetX: '0', offsetY: '10px', blur: '24px', spread: '-12px' } },
        b: { $type: 'shadow', $value: { color: 'rgba(0, 0, 0, 0.5)', offsetX: '0', offsetY: '16px', blur: '40px', spread: '0' } },
      },
    });
    expect(out.shadow).toEqual({ a: '0px 10px 24px -12px rgba(255, 194, 26, 0.4)', b: '0px 16px 40px rgba(0, 0, 0, 0.5)' });
  });

  test('gradients as GradientFill props; stops only when not evenly spaced', () => {
    const linear = (stops, angle) => ({ $type: 'gradient', $value: stops, $extensions: { gymido: { gradient: { kind: 'linear', angle } } } });
    const out = build({
      gradient: {
        even: linear([{ color: '#1e2129', position: 0 }, { color: '#14161c', position: 1 }], '160deg'),
        uneven: linear([{ color: '#ffd45c', position: 0 }, { color: '#ffc21a', position: 0.45 }, { color: '#f29e00', position: 1 }], '145deg'),
      },
    });
    expect(out.gradient.even).toEqual({ angle: 160, colors: ['#1E2129', '#14161C'] });
    expect(out.gradient.uneven).toEqual({ angle: 145, colors: ['#FFD45C', '#FFC21A', '#F29E00'], stops: [0, 0.45, 1] });
  });

  test('platform.native replaces the value, null drops it, native "skip" is left out', () => {
    const out = build({
      layout: {
        a: { $type: 'dimension', $value: '19rem', $extensions: { gymido: { platform: { native: '304px' } } } },
        b: { $type: 'dimension', $value: '4px', $extensions: { gymido: { platform: { native: null } } } },
        c: { $type: 'dimension', $value: '4px', $extensions: { gymido: { native: 'skip' } } },
      },
    });
    expect(out.layout).toEqual({ a: 304 });
  });

  test('an invalid source or an unknown native format fails loudly', () => {
    expect(() => build({ color: { a: { $type: 'color', $value: '{color.missing}' } } })).toThrow(/does not resolve/);
    expect(() => build({ text: { a: { $type: 'typography', $value: { fontSize: '1rem' } } } })).toThrow(/no native format/);
  });
});
