// Final audit (27 Oct): with two iOS simulators booted, one `maestro --device
// <udid> hierarchy` returned the OTHER simulator's screen (QA's, mid-workout).
// Every iOS Maestro call must first see exactly one booted simulator: ours.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const script = path.join(__dirname, 'single-ios-sim.sh');
const OURS = '9953C354-61F2-4C92-A615-3797BA67FA61';
const OTHER = '562ADE62-0000-4000-8000-000000000000';

function run(device, booted) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'single-ios-sim-'));
  const lines = booted.map((udid) => `    Sim (${udid}) (Booted)`).join('\\n');
  fs.writeFileSync(path.join(bin, 'xcrun'), `#!/usr/bin/env bash\nprintf '== Devices ==\\n${lines}\\n'\n`, { mode: 0o755 });
  try {
    return spawnSync('bash', [script, device], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

describe('single-ios-sim.sh', () => {
  it('passes when our simulator is the only one booted', () => {
    expect(run(OURS, [OURS]).status).toBe(0);
  });

  it('refuses (exit 4) when another simulator is booted too, naming it', () => {
    const result = run(OURS, [OURS, OTHER]);
    expect(result.status).toBe(4);
    expect(result.stderr).toContain(OTHER);
  });

  it('refuses (exit 4) when our simulator is not booted', () => {
    expect(run(OURS, [OTHER]).status).toBe(4);
  });

  it('ignores Android emulators (not a simulator UDID)', () => {
    expect(run('emulator-5554', [OURS, OTHER]).status).toBe(0);
  });

  it('every script that drives Maestro on iOS calls it before Maestro', () => {
    ['maestro-guarded.sh', 'ios-safe-sign-in.sh'].forEach((name) => {
      // Code lines only: the header comments mention `maestro --device` too.
      const text = fs
        .readFileSync(path.join(__dirname, name), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n');
      const check = text.indexOf('single-ios-sim.sh');
      expect(check).toBeGreaterThan(-1);
      expect(check).toBeLessThan(text.search(/\bmaestro --device\b/));
    });
  });
});
