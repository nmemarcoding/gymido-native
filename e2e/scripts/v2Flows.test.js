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
