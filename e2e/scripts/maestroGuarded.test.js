// QA candidate-9643e9c: Maestro's device logs (device-logcat.txt,
// device-simulator.log) keep text from a sign-in, and Maestro wrote them to
// the shared ~/.maestro/tests. maestro-guarded.sh now sends the debug output
// to the caller's --debug-output or a private temp folder and deletes those
// logs (and maestro.log / commands*.json) after every run: a pass, a failure
// or a signal. A log it can't delete fails the run (exit 5).
const { spawn, spawnSync } = require('child_process');
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

  // Reviewer MEDIUM (ea27f77): a second signal while scrub runs must not
  // kill it before the logs are gone. A slow `find` marks "scrub started";
  // the test then sends TERM to the script itself.
  it('a TERM DURING scrub is ignored: the private folder is still removed whole and the exit stays maestro\'s', async () => {
    const box = make({ exitCode: 1 });
    const marker = path.join(box.root, 'in-scrub');
    const realFind = spawnSync('bash', ['-c', 'command -v find'], { encoding: 'utf8' }).stdout.trim();
    fs.writeFileSync(path.join(box.root, 'bin', 'find'), `#!/usr/bin/env bash\ntouch ${JSON.stringify(marker)}\nsleep 1\nexec ${realFind} "$@"\n`, { mode: 0o755 });
    const child = spawn('bash', [path.join(box.root, 'e2e', 'scripts', 'maestro-guarded.sh'), 'emulator-5594', 'flow.yaml'], { env: box.env });
    const done = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
    const started = Date.now();
    while (!fs.existsSync(marker) && Date.now() - started < 10000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(fs.existsSync(marker)).toBe(true);
    child.kill('SIGTERM');
    const result = await done;
    expect(result).toEqual({ code: 1, signal: null });
    const dir = fs.readFileSync(box.seen, 'utf8');
    expect(fs.existsSync(dir)).toBe(false);
  }, 20000);

  // Reviewer carry (final batch, 27 Oct 2026): `kill "$MPID"; wait "$MPID"`
  // hung for good when maestro (a JVM) ignored TERM. The cleanup now waits at
  // most MAESTRO_STOP_WAIT seconds (default 10), then kill -9. A stub maestro
  // that ignores TERM; the test waits 1 s.
  it('a maestro that ignores TERM: the cleanup waits at most MAESTRO_STOP_WAIT, then kill -9; the logs still go', async () => {
    const box = make();
    const dir = path.join(box.root, 'caller-debug');
    const started = path.join(box.root, 'maestro-started');
    const pidFile = path.join(box.root, 'maestro-pid');
    fs.writeFileSync(
      path.join(box.root, 'bin', 'maestro'),
      `#!/usr/bin/env bash
trap '' TERM
mkdir -p "${dir}/run"
echo typed-bytes > "${dir}/run/device-logcat.txt"
echo $$ > ${JSON.stringify(pidFile)}
touch ${JSON.stringify(started)}
exec sleep 60
`,
      { mode: 0o755 },
    );
    const child = spawn('bash', [path.join(box.root, 'e2e', 'scripts', 'maestro-guarded.sh'), 'emulator-5594', '--debug-output', dir, 'flow.yaml'], {
      env: { ...box.env, MAESTRO_STOP_WAIT: '1' },
    });
    const done = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
    const begin = Date.now();
    while (!fs.existsSync(started) && Date.now() - begin < 10000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(fs.existsSync(started)).toBe(true);
    const killedAt = Date.now();
    child.kill('SIGTERM');
    const result = await done;
    expect(Date.now() - killedAt).toBeLessThan(8000);
    expect(result).toEqual({ code: 1, signal: null });
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
    expect(files(dir).some((file) => file.endsWith('device-logcat.txt'))).toBe(false);
  }, 20000);

  it.each(['maestro-guarded.sh', 'android-sign-in.sh', 'invite.sh'])('%s: the cleanup never waits on maestro unbounded (bounded wait, then kill -9)', (name) => {
    const src = fs.readFileSync(path.join(__dirname, name), 'utf8');
    expect(src).not.toMatch(/kill "\$MPID"[^\n]*&& wait "\$MPID"/);
    expect(src).toMatch(/stop_maestro "\$MPID"/);
    expect(src).toMatch(/MAESTRO_STOP_WAIT:-10/);
    expect(src).toMatch(/kill -9/);
  });

  it.each(['maestro-guarded.sh', 'android-sign-in.sh', 'invite.sh', 'ios-safe-sign-in.sh'])(
    '%s: its cleanup IGNORES INT/TERM/HUP (never resets them to the default, which kills it)',
    (name) => {
      const src = fs.readFileSync(path.join(__dirname, name), 'utf8');
      expect(src).not.toMatch(/trap - [^\n]*(INT|TERM|HUP)/);
      expect(src).toMatch(/trap '' INT TERM HUP/);
    },
  );

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

  // E4 (final pass 5f53f3d, PM 28 Oct 2026): `maestro hierarchy` has no
  // --debug-output and left 3 log folders per sign-in in ~/.maestro/tests; the
  // form checks run it with a private user.home under $WORK (purged whole) and
  // pipe the JSON, never saving it.
  it('ios-safe-sign-in.sh: every `maestro … hierarchy` runs with a private user.home under $WORK, piped', () => {
    const src = code(read('ios-safe-sign-in.sh'));
    const runs = src.split('\n').filter((line) => /maestro --device "\$UDID" hierarchy/.test(line));
    expect(runs.length).toBe(1);
    runs.forEach((line) => {
      expect(line).toMatch(/\(unset XDG_STATE_HOME; JAVA_TOOL_OPTIONS="-Duser\.home=\$WORK\/home" exec maestro/);
      expect(line).toMatch(/2>\/dev\/null\) \| python3 "\$CHECK"/);
      expect(line).not.toMatch(/>\s*"\$WORK/);
    });
    expect(src).toMatch(/purge\(\) \{\n  rm -rf "\$WORK\/out" "\$WORK\/home"/);
  });

  it.each(['ios-safe-sign-in.sh', 'android-sign-in.sh', 'invite.sh'])('%s: no age-based delete in ~/.maestro/tests; the byte sweep stays', (name) => {
    const src = code(read(name));
    expect(src).not.toMatch(/find "\$HOME\/\.maestro\/tests"[^\n]*-newer/);
    expect(src).toMatch(/grep -rlF -f <\(patterns\) "\$HOME\/\.maestro"/);
  });
});
