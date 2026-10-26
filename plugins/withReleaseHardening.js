const { AndroidConfig, IOSConfig } = require('expo/config-plugins');

// Release-only hardening (APP_ENV production/staging). expo-dev-client and
// the iOS template leave dev-server keys in every build: plain-HTTP access to
// the local network (ATS NSAllowsLocalNetworking), the Local Network prompt
// text and the Bonjour service the dev launcher uses to find Metro. A release
// build talks to the HTTPS API only and never looks for Metro, so it drops
// all three. T-10: it also drops the dev launcher's `exp+<slug>` URL scheme
// on both platforms (any app could open the release build with it). Dev
// builds keep all of them (the dev client needs them).
//
// Same ordering rule as withoutPushCapability: it wraps the earlier mod chain
// and strips after it, so it must come after the plugins that add these keys.

function afterEarlier(config, platform, mod, strip) {
  config.mods = config.mods ?? {};
  config.mods[platform] = config.mods[platform] ?? {};
  const earlier = config.mods[platform][mod] ?? (async (modConfig) => modConfig);
  if (earlier.isProvider) {
    throw new Error(`withReleaseHardening must be added before the ${platform}.${mod} provider`);
  }
  config.mods[platform][mod] = async (modConfig) => {
    const results = await earlier(modConfig);
    results.modResults = strip(results.modResults, modConfig) ?? results.modResults;
    return results;
  };
  return config;
}

// expo-dev-client's rule (getDefaultScheme): `exp+` + the slug, lowercased,
// with only URI-safe characters.
function devClientScheme(config) {
  return `exp+${String(config.slug).replace(/[^A-Za-z0-9+\-.]/g, '').toLowerCase()}`;
}

function stripDevSchemeIos(infoPlist, config) {
  const scheme = devClientScheme(config);
  if (IOSConfig.Scheme.hasScheme(scheme, infoPlist)) {
    infoPlist = IOSConfig.Scheme.removeScheme(scheme, infoPlist);
  }
  // Drop a URL type left with no schemes.
  if (Array.isArray(infoPlist.CFBundleURLTypes)) {
    infoPlist.CFBundleURLTypes = infoPlist.CFBundleURLTypes.filter((type) => (type.CFBundleURLSchemes ?? []).length > 0);
  }
  return infoPlist;
}

function stripDevSchemeAndroid(manifest, config) {
  return AndroidConfig.Scheme.removeScheme(devClientScheme(config), manifest);
}

function stripDevNetworking(infoPlist) {
  delete infoPlist.NSLocalNetworkUsageDescription;
  delete infoPlist.NSBonjourServices;
  const ats = infoPlist.NSAppTransportSecurity;
  if (ats) {
    delete ats.NSAllowsLocalNetworking;
  }
}

module.exports = function withReleaseHardening(config, { enabled = false } = {}) {
  if (!enabled) {
    return config;
  }
  config = afterEarlier(config, 'ios', 'infoPlist', (infoPlist, modConfig) => {
    stripDevNetworking(infoPlist);
    return stripDevSchemeIos(infoPlist, modConfig);
  });
  return afterEarlier(config, 'android', 'manifest', stripDevSchemeAndroid);
};

module.exports.stripDevNetworking = stripDevNetworking;
module.exports.devClientScheme = devClientScheme;
