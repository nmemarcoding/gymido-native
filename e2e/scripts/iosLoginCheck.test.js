// The iOS sign-in form check (ios-login-check.py) reads `maestro hierarchy`
// on stdin. With the private Maestro home (E4) every run is a first run, and
// Maestro 2.10 prints notices before and after the JSON (confirm 2941880:
// "FAIL probe: no hierarchy" twice), so it parses the first JSON value only.
// Fake account values only (example.invalid), in a temp file removed after.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, 'ios-login-check.py');
const EMAIL = 'fake-probe@example.invalid';
let dir;
let envFile;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-login-check-'));
  envFile = path.join(dir, 'env');
  fs.writeFileSync(envFile, `FAKE_EMAIL=${EMAIL}\nFAKE_PASSWORD=not-a-real-one\n`);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const node = (label, value) => ({ attributes: { accessibilityText: label, value, bounds: '[0,0][100,40]' }, children: [] });
const HIERARCHY = JSON.stringify({ attributes: {}, children: [node('Email address', EMAIL), node('Password', '•')] });
const BEFORE = 'Anonymous analytics enabled. To opt out, set MAESTRO_CLI_NO_ANALYTICS environment variable to any value before running Maestro.\n';
const AFTER = '\n╭────────────────────────────╮\n│ Try out our new Analyze with Ai feature. │\n╰────────────────────────────╯\n';
const check = (input) => spawnSync('python3', ['-I', SCRIPT, envFile, 'FAKE', 'probe'], { input, encoding: 'utf8' }).stdout.trim();

describe('ios-login-check.py reads the first JSON value', () => {
  it('passes with the bare JSON', () => {
    expect(check(HIERARCHY)).toBe('PASS probe');
  });

  it('passes with Maestro first-run notices before and after the JSON', () => {
    expect(check(BEFORE + HIERARCHY + AFTER)).toBe('PASS probe');
  });

  it('still fails with no JSON at all, and never prints a value', () => {
    const out = check(BEFORE + AFTER);
    expect(out).toBe('FAIL probe: no hierarchy');
    expect(out).not.toContain(EMAIL);
  });
});
