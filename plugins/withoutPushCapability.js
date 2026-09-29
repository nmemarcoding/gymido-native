const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

// expo-notifications' prebuild adds the iOS Push Notifications capability
// (the `aps-environment` entitlement, plus the `remote-notification`
// background mode). We only ever schedule LOCAL notifications (the O4 rest
// alerts in RN-SPEC-time), never server-sent push, so neither is needed — and
// a free Apple personal team cannot sign `aps-environment`, which fails the
// device build with "Personal development teams … do not support the Push
// Notifications capability".
//
// Listed last in app.config.js so it runs after expo-notifications' own mod.
//
// TO RE-ENABLE real push later: remove this plugin from app.config.js and
// rebuild. That needs a paid Apple Developer account (a free personal team
// cannot sign the entitlement at all), plus an APNs key and a server sending
// the notifications. Nothing in the app depends on it today.
module.exports = function withoutPushCapability(config) {
  config = withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });

  return withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      const kept = modes.filter((mode) => mode !== 'remote-notification');
      if (kept.length) {
        mod.modResults.UIBackgroundModes = kept;
      } else {
        delete mod.modResults.UIBackgroundModes;
      }
    }
    return mod;
  });
};
