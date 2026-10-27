const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

// QA FINDING-N2 / T-59: without fontScale in MainActivity's configChanges,
// Android recreates the activity when the system font size changes, and the
// app restarts on its first tab (the trainer lost Clients). With it, the app
// keeps its screen; React Native reports the new fontScale but does not
// re-lay out mounted text (BUG-N3), so App remounts the screens on the same
// route (src/shared/hooks/useFontScaleRemount.js; a half-typed form resets).
function addFontScaleConfigChange(manifest) {
  const activities = manifest.manifest.application?.[0]?.activity ?? [];
  for (const activity of activities) {
    const name = activity.$?.['android:name'] ?? '';
    if (name !== '.MainActivity' && !name.endsWith('.MainActivity')) {
      continue;
    }
    const changes = (activity.$['android:configChanges'] ?? '').split('|').filter(Boolean);
    if (!changes.includes('fontScale')) {
      changes.push('fontScale');
    }
    activity.$['android:configChanges'] = changes.join('|');
  }
  return manifest;
}

// T-59 device check: React Native re-sends Dimensions (with fontScale) to JS
// only on resume, so a change while the app stays in front (Settings in split
// screen) never reached the remount. After super (which refreshes RN's display
// metrics) the activity sends them at once; DeviceInfoModule skips the event
// when nothing changed.
const DIMENSIONS_UPDATE = `
  // T-59 (plugins/withFontScaleConfigChange.js): send the new fontScale to JS now.
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    (application as com.facebook.react.ReactApplication).reactHost?.currentReactContext
      ?.getNativeModule(com.facebook.react.modules.deviceinfo.DeviceInfoModule::class.java)
      ?.emitUpdateDimensionsEvent()
  }
`;

function addDimensionsUpdate(contents, language) {
  if (language !== 'kt') {
    throw new Error('withFontScaleConfigChange: MainActivity must be Kotlin');
  }
  if (contents.includes('override fun onConfigurationChanged')) {
    return contents;
  }
  const end = contents.lastIndexOf('}');
  return `${contents.slice(0, end).trimEnd()}\n${DIMENSIONS_UPDATE}${contents.slice(end)}`;
}

module.exports = function withFontScaleConfigChange(config) {
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = addFontScaleConfigChange(mod.modResults);
    return mod;
  });
  return withMainActivity(config, (mod) => {
    mod.modResults.contents = addDimensionsUpdate(mod.modResults.contents, mod.modResults.language);
    return mod;
  });
};
module.exports.addFontScaleConfigChange = addFontScaleConfigChange;
module.exports.addDimensionsUpdate = addDimensionsUpdate;
