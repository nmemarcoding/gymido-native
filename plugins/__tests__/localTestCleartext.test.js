const fs = require('fs');
const path = require('path');

const withLocalTestCleartext = require('../withLocalTestCleartext');

const manifest = () => ({ manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } });
const run = async (config) => config.mods.android.manifest({ ...config, modResults: manifest(), modRequest: { platform: 'android', modName: 'manifest' } });

describe('withLocalTestCleartext', () => {
  it('allows cleartext for local-test builds (Release builds against the http test API)', async () => {
    const result = await run(withLocalTestCleartext({ name: 'x', slug: 'x' }, { enabled: true }));
    expect(result.modResults.manifest.application[0].$['android:usesCleartextTraffic']).toBe('true');
  });

  it('does nothing when disabled (production, staging, development)', () => {
    const config = { name: 'x', slug: 'x' };
    expect(withLocalTestCleartext(config, { enabled: false })).toBe(config);
    expect(withLocalTestCleartext(config)).toBe(config);
  });

  it('is enabled ONLY for the localtest-* envs in app.config.js', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app.config.js'), 'utf8');
    expect(source).toContain("['./plugins/withLocalTestCleartext', { enabled: APP_ENV.startsWith('localtest') }]");
  });
});
