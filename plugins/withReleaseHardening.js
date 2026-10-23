// Release-only Info.plist hardening (APP_ENV production/staging). expo-dev-client and
// the iOS template leave dev-server keys in every build: plain-HTTP access to
// the local network (ATS NSAllowsLocalNetworking), the Local Network prompt
// text and the Bonjour service the dev launcher uses to find Metro. A release
// build talks to the HTTPS API only and never looks for Metro, so it drops
// all three. Dev builds keep them (the dev client needs them).
//
// Same ordering rule as withoutPushCapability: it wraps the earlier mod chain
// and strips after it, so it must come after the plugins that add these keys.

function afterEarlierInfoPlist(config, strip) {
  config.mods = config.mods ?? {};
  config.mods.ios = config.mods.ios ?? {};
  const earlier = config.mods.ios.infoPlist ?? (async (modConfig) => modConfig);
  if (earlier.isProvider) {
    throw new Error('withReleaseHardening must be added before the ios.infoPlist provider');
  }
  config.mods.ios.infoPlist = async (modConfig) => {
    const results = await earlier(modConfig);
    strip(results.modResults);
    return results;
  };
  return config;
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
  return enabled ? afterEarlierInfoPlist(config, stripDevNetworking) : config;
};

module.exports.stripDevNetworking = stripDevNetworking;
