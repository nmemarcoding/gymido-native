// QA runs flows on guarded RELEASE builds, where the dev-client deep link
// doesn't exist. The guard tells the build kind apart; both runners pass it
// to Maestro as MAESTRO_GYMIDO_RELEASE, and the launch subflow then uses
// launchApp instead of the dev-client link.
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const code = (text) => text.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

describe('launch-dev-client.yaml on a Release build', () => {
  const flow = code(read('maestro/subflows/launch-dev-client.yaml'));

  it('launches with launchApp when MAESTRO_GYMIDO_RELEASE is true, then waits for app-root', () => {
    const release = flow.slice(flow.indexOf("${MAESTRO_GYMIDO_RELEASE == 'true'}"));
    expect(flow).toContain("${MAESTRO_GYMIDO_RELEASE == 'true'}");
    expect(release).toMatch(/- launchApp/);
    expect(release).toMatch(/id: "app-root"/);
  });

  it('opens the dev-client link only when it is NOT a Release build', () => {
    expect(flow).toContain("${MAESTRO_GYMIDO_RELEASE != 'true'}");
    const devBranch = flow.slice(flow.indexOf("${MAESTRO_GYMIDO_RELEASE != 'true'}"));
    expect(devBranch).toContain('open-dev-client-link.yaml');
  });
});

describe.each(['scripts/maestro-guarded.sh', 'scripts/ios-safe-sign-in.sh'])('%s', (script) => {
  const text = code(read(script));

  it('sets MAESTRO_GYMIDO_RELEASE from the guard result (Release build → true)', () => {
    expect(text).toMatch(/Release build/);
    expect(text).toMatch(/export MAESTRO_GYMIDO_RELEASE=/);
  });

  it('still refuses (exit 3) when the guard fails', () => {
    expect(text).toMatch(/apiGuard\.js[\s\S]*exit 3/);
  });
});

// Review 7815521 LOWs: the Release switch comes only from the guard, and the
// docs no longer tell anyone to hand-edit the launch subflow.
const { spawnSync } = require('child_process');

describe('maestro-guarded.sh refuses a hand-set Release switch', () => {
  const script = path.join(__dirname, 'maestro-guarded.sh');
  it.each([
    ['-e', 'MAESTRO_GYMIDO_RELEASE=true', 'flow.yaml'],
    ['flow.yaml', '-e', 'MAESTRO_GYMIDO_RELEASE=false'],
    ['--env=MAESTRO_GYMIDO_RELEASE=true', 'flow.yaml'],
  ])('refuses %j (exit 2, before the guard or Maestro run)', (...args) => {
    const result = spawnSync('bash', [script, 'emulator-5554', ...args], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/MAESTRO_GYMIDO_RELEASE/);
  });
});

describe('docs match the automatic Release launch', () => {
  it('no stale "replace the body with launchApp" advice', () => {
    expect(read('maestro/README.md')).not.toMatch(/replace (that subflow's|the) body with/i);
    expect(read('maestro/subflows/launch-dev-client.yaml')).not.toMatch(/replace the body with/i);
  });

  it('README warns that GYMIDO_METRO_PORT on a Release run fails safe (dev link), so leave it unset', () => {
    expect(read('maestro/README.md')).toMatch(/GYMIDO_METRO_PORT[^\n]*Release[^\n]*(fails safe|dev-client link)|Release[^\n]*GYMIDO_METRO_PORT[^\n]*(fails safe|dev-client link)/);
  });
});
