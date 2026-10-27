// QA P5.8 / P5.9 / P5.11 need a real invite to THROWAWAY3, whose email only
// the canonical credentials file holds. invite.sh types it by ACCOUNT KEY and
// never prints it, with the same safety as android-sign-in.sh.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, 'invite.sh');
const text = fs.readFileSync(SCRIPT, 'utf8');
const FAKE = 'QA_TRAINER_EMAIL=fake.trainer@example.com\nQA_TRAINER_PASSWORD=Fake-Trainer-1\nTHROWAWAY3_EMAIL=fake.client@example.com\nTHROWAWAY3_PASSWORD=Fake-Client-1\n';

function run(args) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invite-test-'));
  const file = path.join(dir, 'creds.env');
  fs.writeFileSync(file, FAKE);
  return spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: dir, GYMIDO_E2E_ENV: file } });
}

describe('invite.sh', () => {
  it.each([
    [[]],
    [['emulator-5554', 'QA_TRAINER']],
    [['emulator-5554', 'QA_TRAINER', 'THROWAWAY3', '--bogus']],
  ])('usage errors exit 2: %j', (args) => {
    expect(run(args).status).toBe(2);
  });

  it('an unknown client account exits 2 and prints no value', () => {
    const r = run(['emulator-5554', 'QA_TRAINER', 'NO_SUCH']);
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).not.toMatch(/fake\.|Fake-/);
  });

  it('physical devices are refused before anything runs', () => {
    const r = run(['R58M12ABCDE', 'QA_TRAINER', 'THROWAWAY3']);
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).not.toMatch(/fake\.|Fake-/);
  });

  it('reads the email only through e2eEnv.sh and passes it only as MAESTRO_INVITE_EMAIL', () => {
    expect(text).toMatch(/\. "\$ROOT\/e2e\/scripts\/e2eEnv\.sh"/);
    expect(text).toMatch(/MAESTRO_INVITE_EMAIL="\$\(e2e_value "\$ENV_FILE" "\$\{CLIENT\}_EMAIL"\)"/);
    expect(text).toMatch(/inputText: \\\$\{MAESTRO_INVITE_EMAIL\}/);
    expect(text).not.toMatch(/-e [A-Z_]*EMAIL/);
    const lines = text.split('\n').filter((line) => !/^\s*patterns\(\)/.test(line));
    expect(lines.join('\n')).not.toMatch(/(echo|printf)[^\n]*\$\{?MAESTRO_INVITE_EMAIL/);
  });

  it('signs the trainer in with the platform runner first', () => {
    expect(text).toMatch(/android-sign-in\.sh" "\$DEVICE" "\$TRAINER"/);
    expect(text).toMatch(/ios-safe-sign-in\.sh" "\$DEVICE" "\$TRAINER"/);
  });

  it('cleans up + sweeps from a trap on EXIT, INT, TERM, HUP; Maestro backgrounded + wait', () => {
    expect(text).toMatch(/trap cleanup EXIT/);
    expect(text).toMatch(/trap [^\n]*INT TERM HUP/);
    expect(text).toMatch(/maestro-guarded\.sh[^\n]*&\s*\n\s*MPID=\$!/);
    expect(text).toMatch(/wait "\$MPID"/);
    expect(text).toMatch(/cleanup\(\) \{[\s\S]*grep -rlF/);
  });

  // QA re-check: --send exited 1 at the toast wait (the toast's title and
  // description are one accessibility node, so an exact "Invitation sent"
  // never matched), and the tablet failed in trainer-workspace (phone tab ids).
  it('--send proves the invite by the Invited row AND the toast (prefix match)', () => {
    const sendBlock = text.slice(text.indexOf('if [ "$SEND" = 1 ]'));
    expect(sendBlock).toMatch(/id: "invite-invited-\.\*"/);
    expect(sendBlock).toMatch(/visible: "Invitation sent\.\*"/);
  });

  it('reports the failed step instead of a bare exit code', () => {
    expect(text).toMatch(/FAIL invite[^\n]*step/);
  });

  it('opening Clients is verified and retried (tablet flake)', () => {
    expect(text).toMatch(/- retry:\n\s+maxRetries: 2[\s\S]*rail-TClients[\s\S]*id: "clients-search\|clients-list"\n/);
    // Review LOW: StateSlot's default testID ("state-slot") can match on Today.
    expect(text).not.toMatch(/state-slot/);
  });

  it('taps Invite only with --send', () => {
    expect(text).toMatch(/if \[ "\$SEND" = 1 \]/);
    const sendBlock = text.slice(text.indexOf('if [ "$SEND" = 1 ]'));
    expect(sendBlock).toMatch(/invite-user-/);
    expect(sendBlock).toMatch(/Invitation sent/);
  });
});
