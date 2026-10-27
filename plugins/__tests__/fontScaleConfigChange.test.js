// QA FINDING-N2 (s1, Android tablet): changing the system font size while on
// Clients sent the app back to Trainer Today. Android RECREATES the activity
// on a fontScale configuration change unless the activity handles it, so
// the JS app restarted on its first tab. MainActivity now declares
// fontScale in configChanges: the app stays on its screen, RN reports the
// new fontScale, and ShellPage re-measures (only a half-typed form resets,
// the accepted trade-off).
const { addFontScaleConfigChange } = require('../withFontScaleConfigChange');

const TEMPLATE_CHANGES = 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths';
const manifest = (changes, name = '.MainActivity') => ({
  manifest: {
    application: [
      {
        activity: [
          { $: { 'android:name': name, 'android:configChanges': changes } },
          { $: { 'android:name': 'com.other.Activity', 'android:configChanges': 'orientation' } },
        ],
      },
    ],
  },
});
const changesOf = (m, i = 0) => m.manifest.application[0].activity[i].$['android:configChanges'];

describe('withFontScaleConfigChange', () => {
  it('adds fontScale to MainActivity and keeps the template entries', () => {
    const result = addFontScaleConfigChange(manifest(TEMPLATE_CHANGES));
    expect(changesOf(result).split('|')).toEqual([...TEMPLATE_CHANGES.split('|'), 'fontScale']);
  });

  it('is idempotent and leaves other activities alone', () => {
    const once = addFontScaleConfigChange(manifest(TEMPLATE_CHANGES));
    const twice = addFontScaleConfigChange(once);
    expect(changesOf(twice).split('|').filter((c) => c === 'fontScale')).toHaveLength(1);
    expect(changesOf(twice, 1)).toBe('orientation');
  });

  it('works with the fully qualified activity name and no existing configChanges', () => {
    const result = addFontScaleConfigChange(manifest(undefined, 'com.gymido.app.MainActivity'));
    expect(changesOf(result)).toBe('fontScale');
  });

  it('app.config registers the plugin for every build', () => {
    const text = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'app.config.js'), 'utf8');
    expect(text).toMatch(/'\.\/plugins\/withFontScaleConfigChange'/);
  });
});
