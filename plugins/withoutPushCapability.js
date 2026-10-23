// expo-notifications' prebuild adds the iOS Push Notifications capability:
// the `aps-environment` entitlement (and, when enabled, the
// `remote-notification` background mode). Gymido only schedules LOCAL
// notifications (the rest alerts, RN-SPEC-time §7.2 / O4), never server push,
// so neither is needed, and a free Apple personal team cannot sign
// `aps-environment` ("Personal development teams … do not support the Push
// Notifications capability"). Local notifications need no entitlement.
// (ported from the 28 Sep build)
//
// Ordering: Expo runs mods in REVERSE registration order (each mod does its
// own work, then calls the mod registered before it). A plain
// withEntitlementsPlist listed last would therefore run FIRST, and
// expo-notifications would add the key back afterwards. So this plugin wraps
// the chain instead: it lets every earlier mod run, then strips the keys.
// Keep it LAST in app.config.js plugins.
//
// To re-enable real push later: remove this plugin and rebuild (needs a paid
// Apple Developer account, an APNs key and a server sending the pushes).

// Replaces ios.<mod> with a mod that runs the earlier chain first, then strips.
function afterEarlierMods(config, mod, strip) {
  config.mods = config.mods ?? {};
  config.mods.ios = config.mods.ios ?? {};
  const earlier = config.mods.ios[mod] ?? (async (modConfig) => modConfig);
  if (earlier.isProvider) {
    throw new Error(`withoutPushCapability must be added before the ios.${mod} provider`);
  }
  config.mods.ios[mod] = async (modConfig) => {
    const results = await earlier(modConfig);
    strip(results.modResults);
    return results;
  };
  return config;
}

function stripEntitlements(entitlements) {
  delete entitlements['aps-environment'];
}

function stripBackgroundModes(infoPlist) {
  const modes = infoPlist.UIBackgroundModes;
  if (Array.isArray(modes)) {
    const kept = modes.filter((mode) => mode !== 'remote-notification');
    if (kept.length) {
      infoPlist.UIBackgroundModes = kept;
    } else {
      delete infoPlist.UIBackgroundModes;
    }
  }
}

module.exports = function withoutPushCapability(config) {
  config = afterEarlierMods(config, 'entitlements', stripEntitlements);
  return afterEarlierMods(config, 'infoPlist', stripBackgroundModes);
};
