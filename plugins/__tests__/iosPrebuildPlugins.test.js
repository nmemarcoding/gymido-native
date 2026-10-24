const fs = require('fs');
const path = require('path');
const { withEntitlementsPlist } = require('expo/config-plugins');
const notificationsPlugin = require('expo-notifications/app.plugin.js');

const withNotifications = notificationsPlugin.default ?? notificationsPlugin;

const withoutPushCapability = require('../withoutPushCapability');
const withRestCountdownWidget = require('../withRestCountdownWidget');

const run = (config, mod, modResults) => config.mods.ios[mod]({ ...config, modResults, modRequest: { platform: 'ios', modName: mod } });

describe('withoutPushCapability (listed last in app.config.js)', () => {
  it('a plain entitlements mod listed last runs FIRST, so expo-notifications would re-add the key (why the plugin wraps)', async () => {
    let config = withNotifications({ name: 'x', slug: 'x', ios: {} }, {});
    config = withEntitlementsPlist(config, (mod) => {
      delete mod.modResults['aps-environment'];
      return mod;
    });
    const result = await run(config, 'entitlements', {});
    expect(result.modResults['aps-environment']).toBe('development');
  });

  it('strips aps-environment after expo-notifications has added it', async () => {
    const config = withoutPushCapability(withNotifications({ name: 'x', slug: 'x', ios: {} }, {}));
    const result = await run(config, 'entitlements', { 'com.apple.developer.foo': true });
    expect(result.modResults).toEqual({ 'com.apple.developer.foo': true });
  });

  it('drops only the remote-notification background mode', async () => {
    const config = withoutPushCapability(withNotifications({ name: 'x', slug: 'x', ios: {} }, { enableBackgroundRemoteNotifications: true }));
    expect((await run(config, 'infoPlist', { UIBackgroundModes: ['audio'] })).modResults.UIBackgroundModes).toEqual(['audio']);
    expect((await run(config, 'infoPlist', {})).modResults.UIBackgroundModes).toBeUndefined();
  });

  it('is the last plugin in app.config.js', () => {
    // Read as text: evaluating app.config.js needs the .env values.
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app.config.js'), 'utf8');
    const list = source.slice(source.indexOf('plugins: ['), source.indexOf('\n    ],', source.indexOf('plugins: [')));
    const entries = list.match(/'\.\/plugins\/[A-Za-z]+'|\['[^']+'/g);
    expect(entries[entries.length - 1]).toBe("'./plugins/withoutPushCapability'");
  });
});

describe('withRestCountdownWidget extension target', () => {
  function fakeProject() {
    const settings = {};
    const calls = {};
    const project = {
      settings,
      calls,
      hash: {
        project: {
          objects: {
            XCConfigurationList: { L: { buildConfigurations: [{ value: 'C1' }] } },
            XCBuildConfiguration: { C1: { buildSettings: settings } },
          },
        },
      },
      pbxTargetByName: () => null,
      addTarget: (...args) => {
        calls.addTarget = args;
        return { uuid: 'T', pbxNativeTarget: { buildConfigurationList: 'L' } };
      },
      addPbxGroup: () => ({ uuid: 'G' }),
      addToPbxGroup: () => {},
      getFirstProject: () => ({ firstProject: { mainGroup: 'M' } }),
      addBuildPhase: () => {},
      pbxXCBuildConfigurationSection: () => ({}),
      addTargetDependency: () => {},
      getFirstTarget: () => ({ uuid: 'A' }),
    };
    return project;
  }

  it('uses the 28 Sep bundle suffix and the extension hardening settings', async () => {
    const config = withRestCountdownWidget({ name: 'x', slug: 'x', ios: { bundleIdentifier: 'app.gymido' } });
    const project = fakeProject();
    await run(config, 'xcodeproj', project);
    expect(project.calls.addTarget).toEqual(['RestCountdownWidget', 'app_extension', 'RestCountdownWidget', 'app.gymido.RestCountdown']);
    expect(project.settings).toMatchObject({
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      SKIP_INSTALL: 'YES',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    });
  });
});

describe('withReleaseHardening', () => {
  const withReleaseHardening = require('../withReleaseHardening');
  const devPlist = () => ({
    NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true },
    NSLocalNetworkUsageDescription: 'Expo Dev Launcher …',
    NSBonjourServices: ['_expo._tcp'],
    NSSupportsLiveActivities: true,
  });

  it('strips the dev-server keys in a release build, after the earlier mods', async () => {
    let config = { name: 'x', slug: 'x', ios: {}, mods: { ios: { infoPlist: async (mod) => ({ ...mod, modResults: devPlist() }) } } };
    config = withReleaseHardening(config, { enabled: true });
    const result = await run(config, 'infoPlist', {});
    expect(result.modResults).toEqual({ NSAppTransportSecurity: { NSAllowsArbitraryLoads: false }, NSSupportsLiveActivities: true });
  });

  it('leaves dev builds alone', () => {
    const config = { name: 'x', slug: 'x', ios: {} };
    expect(withReleaseHardening(config, { enabled: false })).toBe(config);
  });
});

describe('withTimeSensitiveNotifications', () => {
  const withTimeSensitiveNotifications = require('../withTimeSensitiveNotifications');

  it('adds the Time Sensitive entitlement and survives withoutPushCapability', async () => {
    let config = withNotifications({ name: 'x', slug: 'x', ios: {} }, {});
    config = withTimeSensitiveNotifications(config);
    config = withoutPushCapability(config);
    const result = await run(config, 'entitlements', {});
    expect(result.modResults).toEqual({ [withTimeSensitiveNotifications.TIME_SENSITIVE]: true });
  });
});
