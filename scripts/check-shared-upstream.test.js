const { compare } = require('./check-shared-upstream');
const { sha256 } = require('./shared-files');

// T-173 check 3's verdicts (the git reads are the CLI's; this is the comparison).
describe('check 3: the synced copy vs gymido main', () => {
  const files = { 'design/tokens/tokens.json': sha256('A'), 'design/tokens/generate.js': sha256('B') };

  test('in sync when every file on main has the manifest hash', () => {
    const result = compare(files, { 'design/tokens/tokens.json': Buffer.from('A'), 'design/tokens/generate.js': Buffer.from('B') }, 'origin/main');
    expect(result.status).toBe(0);
  });

  test('differs (exit 1) when main has another version', () => {
    const result = compare(files, { 'design/tokens/tokens.json': Buffer.from('A2'), 'design/tokens/generate.js': Buffer.from('B') }, 'origin/main');
    expect(result.status).toBe(1);
    expect(result.lines[0]).toMatch(/^differs: design\/tokens\/tokens.json/);
  });

  test('absent upstream (exit 2) before FE merges, and says exactly that', () => {
    const result = compare(files, { 'design/tokens/tokens.json': null, 'design/tokens/generate.js': null }, 'origin/main');
    expect(result.status).toBe(2);
    expect(result.lines[0]).toBe(
      'absent upstream: design/tokens/tokens.json is not on gymido origin/main yet (expected until FE merges it); the copy cannot be checked against main',
    );
  });

  test('a differing file outranks an absent one', () => {
    const result = compare(files, { 'design/tokens/tokens.json': Buffer.from('X'), 'design/tokens/generate.js': null }, 'origin/main');
    expect(result.status).toBe(1);
  });
});
