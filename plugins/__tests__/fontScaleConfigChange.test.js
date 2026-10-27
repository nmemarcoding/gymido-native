// QA FINDING-N2 (s1, Android tablet): changing the system font size while on
// Clients sent the app back to Trainer Today. Android RECREATES the activity
// on a fontScale configuration change unless the activity handles it, so
// the JS app restarted on its first tab. MainActivity now declares
// fontScale in configChanges: the app stays on its screen. T-59 device check:
// RN only re-sends Dimensions to JS on resume, so a change while the app stays
// in front (adb, Settings in split screen) never reached the remount; the
// MainActivity override sends it at once.
const { addFontScaleConfigChange, addDimensionsUpdate } = require('../withFontScaleConfigChange');

const MAIN_ACTIVITY = `package com.gymido.app

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

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

  it('MainActivity sends the new Dimensions (fontScale) to JS on a configuration change, after super', () => {
    const result = addDimensionsUpdate(MAIN_ACTIVITY, 'kt');
    const body = result.slice(result.indexOf('override fun onConfigurationChanged'));
    expect(body).toMatch(/^override fun onConfigurationChanged\(newConfig: android\.content\.res\.Configuration\) \{\s+super\.onConfigurationChanged\(newConfig\)/);
    expect(body).toMatch(/\(application as com\.facebook\.react\.ReactApplication\)\.reactHost\?\.currentReactContext/);
    // DeviceInfoModule is internal in RN 0.86 (the f6d969a Release failed to
    // compile), so it sends RN's own Dimensions payload through public APIs.
    expect(body).not.toMatch(/DeviceInfoModule/);
    expect(body).toMatch(/\?\.emitDeviceEvent\(\s*"didUpdateDimensions",\s*com\.facebook\.react\.uimanager\.DisplayMetricsHolder\.getDisplayMetricsWritableMap\(newConfig\.fontScale\.toDouble\(\)\)/);
    // Still inside the class, the rest unchanged.
    expect(result.trimEnd().endsWith('}')).toBe(true);
    expect(result).toContain('override fun getMainComponentName(): String = "main"');
  });

  it('adds the override once (idempotent) and refuses a Java MainActivity', () => {
    const once = addDimensionsUpdate(MAIN_ACTIVITY, 'kt');
    expect(addDimensionsUpdate(once, 'kt')).toBe(once);
    expect(() => addDimensionsUpdate('public class MainActivity {}', 'java')).toThrow(/Kotlin/);
  });
});
