// QA candidate-9643e9c: Maestro's device logs (device-logcat.txt,
// device-simulator.log) keep text from a sign-in, and Maestro wrote them to
// the shared ~/.maestro/tests. maestro-guarded.sh now sends the debug output
// to the caller's --debug-output or a private temp folder and deletes those
// logs (and maestro.log / commands*.json) after every run: a pass, a failure
// or a signal. A log it can't delete fails the run (exit 5).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, 'maestro-guarded.sh');
const LOGS = ['device-logcat.txt', 'device-simulator.log', 'maestro.log', 'commands-(flow.yaml).json'];

// A temp root with the script, a passing guard and one-sim check, and a fake
// maestro that writes the logs + a screenshot into its --debug-output folder.
function sandbox({ exitCode = 0, sleep = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-guarded-test-'));
  const scripts = path.join(root, 'e2e', 'scripts');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(root, 'home'));
  fs.copyFileSync(SCRIPT, path.join(scripts, 'maestro-guarded.sh'));
  fs.writeFileSync(path.join(scripts, 'single-ios-sim.sh'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'apiGuard.js'), "console.log('apiGuard: OK (Release build)');\n");
  const seen = path.join(root, 'seen-debug-dir');
  fs.writeFileSync(
    path.join(bin, 'maestro'),
    `#!/usr/bin/env bash
dir=""
while [ $# -gt 0 ]; do
  case "$1" in --debug-output) dir="$2"; shift ;; --debug-output=*) dir="\${1#--debug-output=}" ;; esac
  shift
done
[ -n "$dir" ] || { echo "no --debug-output" >&2; exit 9; }
printf '%s' "$dir" > ${JSON.stringify(seen)}
mkdir -p "$dir/2026-10-27_200000"
for f in ${LOGS.map((name) => `'${name}'`).join(' ')} shot.png; do echo typed-bytes > "$dir/2026-10-27_200000/$f"; done
${sleep ? `sleep ${sleep}` : ''}
exit ${exitCode}
`,
    { mode: 0o755 },
  );
  return { root, seen, env: { PATH: `${bin}:${process.env.PATH}`, HOME: path.join(root, 'home'), TMPDIR: root } };
}
const files = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String) : []);
const run = (box, args, options = {}) =>
  spawnSync('bash', [path.join(box.root, 'e2e', 'scripts', 'maestro-guarded.sh'), 'emulator-5594', ...args], { encoding: 'utf8', env: box.env, ...options });

const boxes = [];
afterEach(() => boxes.splice(0).forEach((box) => fs.rmSync(box.root, { recursive: true, force: true })));
const make = (options) => {
  const box = sandbox(options);
  boxes.push(box);
  return box;
};

describe('maestro-guarded.sh deletes Maestro debug logs after every run', () => {
  it.each([0, 1])('no --debug-output (maestro exit %i): a private temp folder, removed whole; exit passes through', (exitCode) => {
    const box = make({ exitCode });
    const result = run(box, ['flow.yaml']);
    expect(result.status).toBe(exitCode);
    const dir = fs.readFileSync(box.seen, 'utf8');
    expect(dir.startsWith(box.root)).toBe(true);
    expect(fs.existsSync(dir)).toBe(false);
    // Never the shared ~/.maestro/tests.
    expect(fs.existsSync(path.join(box.env.HOME, '.maestro'))).toBe(false);
  });

  it.each([
    ['--debug-output', 'DIR'],
    ['--debug-output=DIR'],
  ])('the caller\'s %s: the logs go, other files stay', (...form) => {
    const box = make({ exitCode: 1 });
    const dir = path.join(box.root, 'caller-debug');
    const result = run(box, [...form.map((arg) => arg.replace('DIR', dir)), 'flow.yaml']);
    expect(result.status).toBe(1);
    const left = files(dir);
    LOGS.forEach((name) => expect(left.some((file) => file.endsWith(name))).toBe(false));
    expect(left.some((file) => file.endsWith('shot.png'))).toBe(true);
  });

  it('a TERM mid-run stops maestro and still deletes the logs', () => {
    const box = make({ sleep: 30 });
    const dir = path.join(box.root, 'caller-debug');
    const result = run(box, ['--debug-output', dir, 'flow.yaml'], { timeout: 3000, killSignal: 'SIGTERM' });
    expect(result.signal ?? result.status).not.toBe(0);
    const left = files(dir);
    LOGS.forEach((name) => expect(left.some((file) => file.endsWith(name))).toBe(false));
  });

  it('a log it cannot delete fails the run (exit 5) and names the folder, not the contents', () => {
    const box = make();
    const dir = path.join(box.root, 'caller-debug');
    // A read-only run folder: the fake maestro writes, then the script can't delete.
    fs.writeFileSync(
      path.join(box.root, 'bin', 'maestro'),
      `#!/usr/bin/env bash\nmkdir -p "${dir}/run"\necho typed-bytes > "${dir}/run/device-logcat.txt"\nchmod 555 "${dir}/run"\nexit 0\n`,
      { mode: 0o755 },
    );
    const result = run(box, ['--debug-output', dir, 'flow.yaml']);
    fs.chmodSync(path.join(dir, 'run'), 0o755);
    expect(result.status).toBe(5);
    expect(result.stderr).toMatch(/could not be deleted/);
    expect(result.stdout + result.stderr).not.toMatch(/typed-bytes/);
  });
});

// The sign-in runners: ios-safe-sign-in.sh calls maestro itself, so its
// stages and its cancel flow send the debug output into its private $WORK
// (removed whole). The shared ~/.maestro/tests is no longer swept by age (it
// could delete another lane's files mid-run); the byte sweeps stay.
describe('sign-in runners keep Maestro debug output private', () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
  const code = (src) => src.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

  it('ios-safe-sign-in.sh: every `maestro … test` passes --debug-output under $WORK', () => {
    const runs = code(read('ios-safe-sign-in.sh')).split('\n').filter((line) => /maestro --device "\$UDID" test/.test(line));
    expect(runs.length).toBe(2);
    runs.forEach((line) => expect(line).toMatch(/test --debug-output "\$WORK\/[^"]+"/));
  });

  it.each(['ios-safe-sign-in.sh', 'android-sign-in.sh', 'invite.sh'])('%s: no age-based delete in ~/.maestro/tests; the byte sweep stays', (name) => {
    const src = code(read(name));
    expect(src).not.toMatch(/find "\$HOME\/\.maestro\/tests"[^\n]*-newer/);
    expect(src).toMatch(/grep -rlF -f <\(patterns\) "\$HOME\/\.maestro"/);
  });
});
