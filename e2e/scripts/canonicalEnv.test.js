// QA runs from its own worktree and must never hold or read the credentials
// file. Every sign-in runner reads the ONE canonical file (or the file
// GYMIDO_E2E_ENV points at) and never prints a value.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ENV_SH = path.join(__dirname, 'e2eEnv.sh');
const FAKE = 'QA_MEMBER_EMAIL=fake.member@example.com\nQA_MEMBER_PASSWORD=Fake-Pass-123\n';

function home() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2eenv-'));
  return dir;
}
function bash(script, env) {
  return spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
}

describe('e2eEnv.sh', () => {
  it('defaults to the canonical file under $HOME/Desktop/coding/gymido-native', () => {
    const h = home();
    const file = path.join(h, 'Desktop/coding/gymido-native/.env.e2e.local');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, FAKE);
    const r = bash(`. "${ENV_SH}"; e2e_env_file`, { HOME: h });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(file);
  });

  it('GYMIDO_E2E_ENV points at another file', () => {
    const h = home();
    const file = path.join(h, 'creds.env');
    fs.writeFileSync(file, FAKE);
    const r = bash(`. "${ENV_SH}"; e2e_env_file`, { HOME: h, GYMIDO_E2E_ENV: file });
    expect(r.stdout.trim()).toBe(file);
  });

  it('missing file: exit 2 with a hint, no repo-local fallback', () => {
    const h = home();
    const r = bash(`cd "${h}"; printf 'X=1\\n' > .env.e2e.local; . "${ENV_SH}"; e2e_env_file`, { HOME: h });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/GYMIDO_E2E_ENV/);
    expect(r.stdout).toBe('');
  });

  it('e2e_value reads one key without echoing the file', () => {
    const h = home();
    const file = path.join(h, 'creds.env');
    fs.writeFileSync(file, FAKE);
    const r = bash(`. "${ENV_SH}"; v="$(e2e_value "${file}" QA_MEMBER_PASSWORD)"; [ "$v" = Fake-Pass-123 ] && echo same`, { HOME: h });
    expect(r.stdout.trim()).toBe('same');
  });
});

describe.each(['ios-safe-sign-in.sh', 'android-sign-in.sh'])('%s', (name) => {
  const script = path.join(__dirname, name);
  const text = fs.readFileSync(script, 'utf8');

  it('reads credentials only through e2eEnv.sh (no repo-local .env.e2e.local)', () => {
    expect(text).toMatch(/e2eEnv\.sh/);
    expect(text).toMatch(/e2e_env_file/);
    expect(text).not.toMatch(/\$ROOT\/\.env\.e2e\.local/);
  });

  it('never echoes a credential variable (only patterns() feeds them to the sweep grep)', () => {
    const lines = text.split('\n').filter((line) => !/^\s*patterns\(\)|^\s*printf '%s\\n%s\\n' "\$MAESTRO_LOGIN_EMAIL"/.test(line));
    expect(lines.join('\n')).not.toMatch(/(echo|printf)[^\n]*\$\{?(MAESTRO_LOGIN_(EMAIL|PASSWORD))/);
  });

  it('an unknown account exits 2 without printing any value', () => {
    const h = home();
    const file = path.join(h, 'creds.env');
    fs.writeFileSync(file, FAKE);
    const device = name.startsWith('ios') ? '9953C354-61F2-4C92-A615-3797BA67FA61' : 'emulator-5554';
    const r = spawnSync('bash', [script, device, 'NO_SUCH_ACCOUNT'], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: h, GYMIDO_E2E_ENV: file } });
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).not.toMatch(/fake\.member|Fake-Pass/);
  });
});

// Review dd729f0 MEDIUM: an interrupted Android sign-in must still sweep.
describe('android-sign-in.sh cleans up on interrupt', () => {
  const text = fs.readFileSync(path.join(__dirname, 'android-sign-in.sh'), 'utf8');

  it('runs cleanup + the byte sweep from a trap on EXIT, INT, TERM and HUP', () => {
    expect(text).toMatch(/trap '?cleanup[^\n]*'? EXIT/);
    expect(text).toMatch(/trap '[^']*cleanup[^']*' INT TERM HUP|trap [^\n]*INT[^\n]*TERM[^\n]*HUP/);
    expect(text).toMatch(/cleanup\(\) \{[\s\S]*rm -rf "\$WORK"[\s\S]*grep -rlF/);
  });

  it('runs Maestro in the background and waits, so a signal reaches the trap at once', () => {
    expect(text).toMatch(/maestro-guarded\.sh[^\n]*&\s*\n[^\n]*MPID=\$!/);
    expect(text).toMatch(/wait "?\$MPID"?/);
    expect(text).toMatch(/kill[^\n]*\$MPID/);
  });

  it('clears Chrome again at the end (no saved form data left behind)', () => {
    const cleanup = text.slice(text.indexOf('cleanup() {'));
    expect(cleanup).toMatch(/pm clear com\.android\.chrome/);
  });
});
