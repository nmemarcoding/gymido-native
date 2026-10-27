// QA runs the v2 flows from v2qa/native-run on guarded Release builds: every
// subflow a flow references must exist on the branch, and no v2 flow may
// depend on the dev-client link (they launch with launchApp, or start on an
// already open, signed-in tab root).
const fs = require('fs');
const path = require('path');

const V2 = path.join(__dirname, '..', 'maestro', 'v2');
function yamls(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return yamls(full);
    return entry.name.endsWith('.yaml') ? [full] : [];
  });
}
const FLOWS = yamls(V2);
const rel = (file) => path.relative(V2, file);

describe('v2 flows on the QA branch', () => {
  it('has the phase flows QA runs', () => {
    const dirs = new Set(FLOWS.map((file) => rel(file).split(path.sep)[0]));
    expect([...dirs].sort()).toEqual(expect.arrayContaining(['phase3', 'phase4', 'phase5', 'phase6', 'subflows', 't55', 't56']));
  });

  it.each(FLOWS.map(rel))('%s: every referenced subflow exists', (name) => {
    const file = path.join(V2, name);
    const refs = [...fs.readFileSync(file, 'utf8').matchAll(/(?:runFlow:\s*|file:\s*)([^\s{}$]+\.yaml)/g)].map((m) => m[1]);
    const missing = refs.filter((ref) => !fs.existsSync(path.resolve(path.dirname(file), ref)));
    expect(missing).toEqual([]);
  });

  it.each(FLOWS.map(rel))('%s: never opens the dev-client link', (name) => {
    expect(fs.readFileSync(path.join(V2, name), 'utf8')).not.toMatch(/expo-development-client|open-dev-client-link|launch-dev-client/);
  });
});

describe('trainer-workspace subflow works on phone AND tablet', () => {
  const flow = fs.readFileSync(path.join(V2, 'subflows', 'trainer-workspace.yaml'), 'utf8');
  it('accepts the rail (tablet) as well as the bottom tabs (phone)', () => {
    expect(flow).toMatch(/id: "tab-TToday\|rail-TToday"/);
    expect(flow).toMatch(/id: "rail-Today"/);
  });
});

describe('restore-workspace subflow works on phone AND tablet', () => {
  const flow = fs.readFileSync(path.join(V2, 'subflows', 'restore-workspace.yaml'), 'utf8');
  it('taps the rail Profile items on a tablet and waits for either nav', () => {
    expect(flow).toMatch(/id: "rail-Profile"/);
    expect(flow).toMatch(/id: "rail-TProfile"/);
    expect(flow).toMatch(/id: "tab-Today\|rail-Today"/);
    expect(flow).toMatch(/id: "tab-TToday\|rail-TToday"/);
  });
});

describe('dismiss-browser-interstitials waits for a late Chrome first-run screen', () => {
  const flow = fs.readFileSync(path.join(__dirname, '..', 'maestro', 'subflows', 'dismiss-browser-interstitials.yaml'), 'utf8');
  it('on Android, waits for the first-run screen OR the hosted page before the conditional taps', () => {
    const wait = flow.indexOf('Use without an account|No thanks|Got it|Continue with Google');
    expect(wait).toBeGreaterThan(-1);
    expect(wait).toBeLessThan(flow.indexOf('tapOn: "Use without an account"'));
  });
});

describe('login-form anchors work on small screens', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', 'maestro', rel), 'utf8');
  it.each(['subflows/wait-for-login-form.yaml', 'subflows/cancel-universal-login.yaml', '02-login-opens-universal-login.yaml', '01-welcome-no-auto-redirect.yaml', '06-sign-out.yaml'])(
    '%s anchors on "Continue with Google|Reset password" (the Google button can be below the fold)',
    (rel) => {
      expect(read(rel)).toContain('"Continue with Google|Reset password"');
      const steps = read(rel).split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
      expect(steps).not.toMatch(/"Continue with Google"/);
    },
  );
});
