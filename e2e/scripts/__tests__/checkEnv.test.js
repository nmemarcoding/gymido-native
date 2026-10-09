const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkEnvText, checkRequired, main } = require('../check-env');

describe('checkEnvText', () => {
  test('a clean file has no problems; comments and blank lines are skipped', () => {
    expect(checkEnvText('# rigs\n\nTRAINER_EMAIL=a@b.co\nTRAINER_PASSWORD=x=y!z\n')).toEqual([]);
  });

  test.each([
    ['TRAINER_EMAIL=a@b.co ', ['trailing whitespace']],
    ['TRAINER_EMAIL=a@b.co\t', ['trailing whitespace']],
    ['TRAINER_EMAIL= a@b.co', ['leading whitespace']],
    ['TRAINER_EMAIL=a@b.co\r', ['carriage return (CRLF line ending)']],
    ['TRAINER_EMAIL="a@b.co"', ['quotes']],
    ["TRAINER_EMAIL='a@b.co'", ['quotes']],
    ['TRAINER_EMAIL= "a@b.co" ', ['leading whitespace', 'trailing whitespace', 'quotes']],
  ])('%j → %j', (line, problems) => {
    expect(checkEnvText(`OK=1\n${line}\n`)).toEqual([{ line: 2, key: 'TRAINER_EMAIL', problems }]);
  });
});

describe('main', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-env-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('exit 1 naming the key, never printing the value', () => {
    const file = path.join(dir, '.env.e2e.local');
    fs.writeFileSync(file, 'TRAINER_PASSWORD=s3cret-value \n');
    expect(main(['node', 'check-env.js', file])).toBe(1);
    const printed = console.error.mock.calls.flat().join('\n');
    expect(printed).toContain('TRAINER_PASSWORD');
    expect(printed).not.toContain('s3cret-value');
  });

  test('exit 0 for a clean file and when the file is absent', () => {
    const file = path.join(dir, '.env.e2e.local');
    fs.writeFileSync(file, 'TRAINER_PASSWORD=s3cret\n');
    expect(main(['node', 'check-env.js', file])).toBe(0);
    expect(main(['node', 'check-env.js', path.join(dir, 'missing')])).toBe(0);
  });
});

describe('checkRequired', () => {
  test('names each missing variable and where it can come from, never a value', () => {
    const errors = [];
    jest.spyOn(console, 'error').mockImplementation((line) => errors.push(line));
    const required = { MEMBER_EMAIL: ['MEMBER_EMAIL', 'PROFILED_EMAIL'], TRAINER_PASSWORD: ['TRAINER_PASSWORD'] };
    expect(checkRequired(required, { MEMBER_EMAIL: 'secret@x.co' })).toBe(1);
    expect(errors.slice(1)).toEqual(['  TRAINER_PASSWORD: set TRAINER_PASSWORD (or pass -e TRAINER_PASSWORD=…)']);
    expect(errors.join('\n')).not.toContain('secret');
    expect(checkRequired(required, { MEMBER_EMAIL: 'a', TRAINER_PASSWORD: 'b' })).toBe(0);
    jest.restoreAllMocks();
  });
});
