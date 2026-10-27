const { withAndroidManifest } = require('expo/config-plugins');

// QA FINDING-N2: without fontScale in MainActivity's configChanges, Android
// recreates the activity when the system font size changes, and the app
// restarts on its first tab (the trainer lost Clients). With it, the app
// keeps its screen; React Native reports the new fontScale and ShellPage
// re-measures the page (only a half-typed form resets).
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

module.exports = function withFontScaleConfigChange(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = addFontScaleConfigChange(mod.modResults);
    return mod;
  });
};
module.exports.addFontScaleConfigChange = addFontScaleConfigChange;
