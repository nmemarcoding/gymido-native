const fs = require('fs');
const path = require('path');

// RN-SPEC-v2-foundation §1: v2 is dark only. The native chrome (system UI,
// root view, splash, status bar) uses color-ground and light content, so a
// launch or a modal never flashes white. Read as text: evaluating
// app.config.js needs the .env values.
const ROOT = path.join(__dirname, '..', '..');
const GROUND = '#0A0B0F';

describe('dark chrome (v2)', () => {
  const config = fs.readFileSync(path.join(ROOT, 'app.config.js'), 'utf8');

  it('forces the dark system UI', () => {
    expect(config).toContain("userInterfaceStyle: 'dark'");
    expect(config).not.toContain("userInterfaceStyle: 'light'");
  });

  it('paints the root view and the splash with color-ground', () => {
    expect(config).toContain(`backgroundColor: '${GROUND}',\n    splash: {`);
    const splash = config.slice(config.indexOf('splash: {'), config.indexOf('},', config.indexOf('splash: {')));
    expect(splash).toContain(`backgroundColor: '${GROUND}'`);
  });

  it('draws light status-bar content', () => {
    const app = fs.readFileSync(path.join(ROOT, 'src', 'App.js'), 'utf8');
    expect(app).toContain('<StatusBar style="light" />');
    expect(app).not.toContain('<StatusBar style="dark" />');
  });
});
