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
