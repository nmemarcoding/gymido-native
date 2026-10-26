const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// RN-SPEC-v2-foundation §2: Geist 400/500/600/700, the same release as the
// web (assets/fonts/README.md), embedded by the expo-font config plugin.
const ROOT = path.join(__dirname, '..', '..');
const FONTS = path.join(ROOT, 'assets', 'fonts');
const FAMILIES = ['Geist-Regular', 'Geist-Medium', 'Geist-SemiBold', 'Geist-Bold'];

// The Windows-platform strings of a TTF's name table, by name ID.
function nameTable(file) {
  const b = fs.readFileSync(file);
  const tables = b.readUInt16BE(4);
  for (let i = 0; i < tables; i += 1) {
    const at = 12 + i * 16;
    if (b.toString('latin1', at, at + 4) === 'name') {
      const off = b.readUInt32BE(at + 8);
      const count = b.readUInt16BE(off + 2);
      const strings = off + b.readUInt16BE(off + 4);
      const names = {};
      for (let j = 0; j < count; j += 1) {
        const rec = off + 6 + j * 12;
        if (b.readUInt16BE(rec) === 3) {
          const start = strings + b.readUInt16BE(rec + 10);
          names[b.readUInt16BE(rec + 6)] = b.subarray(start, start + b.readUInt16BE(rec + 8)).swap16().toString('utf16le');
        }
      }
      return names;
    }
  }
  return {};
}

describe('bundled Geist (v2 typeface)', () => {
  const readme = fs.readFileSync(path.join(FONTS, 'README.md'), 'utf8');
  const config = fs.readFileSync(path.join(ROOT, 'app.config.js'), 'utf8');

  it.each(FAMILIES)('%s is listed for the expo-font plugin', (family) => {
    expect(config).toContain(`'./assets/fonts/${family}.ttf'`);
  });

  it.each(FAMILIES)('%s: PostScript name = file name, Version 1.800, SHA-256 as recorded', (family) => {
    const file = path.join(FONTS, `${family}.ttf`);
    const names = nameTable(file);
    expect(names[6]).toBe(family);
    expect(names[5]).toMatch(/^Version 1\.800;/);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    expect(readme).toContain(`| \`${family}.ttf\` | \`${family}\` | \`${sha}\` |`);
  });

  it('ships the OFL licence and no other weights', () => {
    expect(fs.readFileSync(path.join(FONTS, 'OFL.txt'), 'utf8')).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
    const ttfs = fs.readdirSync(FONTS).filter((name) => name.endsWith('.ttf')).sort();
    expect(ttfs).toEqual(FAMILIES.map((family) => `${family}.ttf`).sort());
  });
});
