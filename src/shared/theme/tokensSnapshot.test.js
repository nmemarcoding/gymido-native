const fs = require('fs');
const path = require('path');

// T-173 day-1 proof: tokens.js became a facade over tokens.generated.json with zero change. Every exported value
// (each leaf, arrays item by item, `undefined` included), the export names, the outputs of font() /
// titleTracking() / muscleGlow(), and deep-frozenness are compared with tokens.snapshot.json, taken from the
// hand-written tokens.js at main 3a80be2 before the switch. iOS fully; Android = iOS + its overrides.
// A value that must change later is a token change (tokens.json first), and this snapshot is updated in the same
// commit, declared to the PM. To rewrite it: WRITE_TOKENS_SNAPSHOT=1 npx jest tokensSnapshot.

const SNAPSHOT = path.join(__dirname, 'tokens.snapshot.json');
const UNDEFINED = '<undefined>';
const FUNCTION = '<function>';

function loadTokens(os) {
  let tokens;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    tokens = require('./tokens');
  });
  jest.dontMock('react-native');
  return tokens;
}

function flatten(value, key, into) {
  if (value === undefined) into[key] = UNDEFINED;
  else if (typeof value === 'function') into[key] = FUNCTION;
  else if (value !== null && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
    if (entries.length === 0) into[key] = Array.isArray(value) ? '<empty array>' : '<empty object>';
    entries.forEach(([childKey, child]) => flatten(child, `${key}.${childKey}`, into));
  } else into[key] = value;
  return into;
}

function unfrozen(value, key, out) {
  if (value === null || typeof value !== 'object') return out;
  if (!Object.isFrozen(value)) out.push(key);
  Object.entries(value).forEach(([childKey, child]) => unfrozen(child, `${key}.${childKey}`, out));
  return out;
}

function describeTokens(tokens) {
  const leaves = {};
  Object.keys(tokens)
    .sort()
    .forEach((name) => flatten(tokens[name], name, leaves));
  [undefined, 100, 300, 400, 500, 600, 700, 800, 900, '600'].forEach((weight) => {
    flatten(tokens.font(weight), `font(${weight})`, leaves);
  });
  [
    [92, -0.06],
    [56, -0.05],
    [24, -0.03],
    [15, 0],
    [36],
  ].forEach(([size, em]) => {
    leaves[`titleTracking(${size}, ${em})`] = tokens.titleTracking(size, em);
  });
  Object.entries(tokens.muscle).forEach(([name, hex]) => flatten(tokens.muscleGlow(hex), `muscleGlow(muscle.${name})`, leaves));
  return leaves;
}

function current() {
  const ios = loadTokens('ios');
  const android = loadTokens('android');
  const iosLeaves = describeTokens(ios);
  const androidLeaves = describeTokens(android);
  const androidOverrides = {};
  Object.entries(androidLeaves).forEach(([key, value]) => {
    if (iosLeaves[key] !== value) androidOverrides[key] = value;
  });
  return {
    ios: iosLeaves,
    androidOverrides,
    androidKeys: Object.keys(androidLeaves).length,
    unfrozen: { ios: Object.keys(ios).flatMap((name) => unfrozen(ios[name], name, [])) },
  };
}

if (process.env.WRITE_TOKENS_SNAPSHOT === '1') {
  test('writes tokens.snapshot.json', () => {
    fs.writeFileSync(SNAPSHOT, `${JSON.stringify(current(), null, 1)}\n`);
  });
} else {
  describe('T-173 day-1: tokens.js exports exactly the values it had before the generated source', () => {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const now = current();

    test('the snapshot covers every leaf (≈580) on both platforms', () => {
      expect(Object.keys(snapshot.ios).length).toBeGreaterThan(550);
      expect(now.androidKeys).toBe(Object.keys(now.ios).length);
    });

    test('iOS: every exported leaf is identical (names, values, string spelling)', () => {
      expect(now.ios).toEqual(snapshot.ios);
    });

    test('Android: the same, plus only its recorded overrides (title tracking floor)', () => {
      expect(now.androidOverrides).toEqual(snapshot.androidOverrides);
    });

    test('nothing that was frozen became mutable', () => {
      expect(now.unfrozen).toEqual(snapshot.unfrozen);
    });
  });
}
