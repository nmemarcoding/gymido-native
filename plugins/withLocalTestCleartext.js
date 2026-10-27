const { withAndroidManifest } = require('expo/config-plugins');

// Local-test builds only (APP_ENV localtest-*): Android blocks plain-HTTP
// traffic in Release builds, so a Release build pointed at the local test API
// (http://10.0.2.2:<port>) could sign in through Auth0 (HTTPS) but load no
// data ("Network Error"; v2 Phase 1 Release run, 26 Oct). This allows
// cleartext for those builds so QA can run Release builds on the test stack.
// Production and staging never enable it (and withReleaseHardening keeps
// them HTTPS-only).
module.exports = function withLocalTestCleartext(config, { enabled = false } = {}) {
  if (!enabled) {
    return config;
  }
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return mod;
  });
};
