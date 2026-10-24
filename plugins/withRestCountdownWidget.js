const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

// RN-SPEC-time O13.2: adds the RestCountdownWidget Live Activity extension
// at prebuild, so `expo prebuild --clean` always regenerates it. The sources
// live in modules/rest-countdown; the shared attributes file is copied from
// the module's pod so the app and the extension compile the same type.
const TARGET = 'RestCountdownWidget';
// The extension's bundle id is <app>.RestCountdown, the 28 Sep build's
// suffix, so the owner's existing App ID and provisioning are reused. The
// Xcode target keeps its newer name (renaming it would churn the generated
// folder and the module's paths for no gain).
const BUNDLE_SUFFIX = 'RestCountdown';
const MODULE_DIR = path.join(__dirname, '..', 'modules', 'rest-countdown');
const SOURCES = ['RestCountdownWidget.swift', 'RestCountdownCardView.swift', 'RestCountdownAttributes.swift'];
const RESOURCES = ['Assets.xcassets'];

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(source, target);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}

function withWidgetFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const out = path.join(modConfig.modRequest.platformProjectRoot, TARGET);
      copyRecursive(path.join(MODULE_DIR, 'widget'), out);
      fs.copyFileSync(path.join(MODULE_DIR, 'ios', 'RestCountdownAttributes.swift'), path.join(out, 'RestCountdownAttributes.swift'));
      return modConfig;
    },
  ]);
}

function withWidgetTarget(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    if (project.pbxTargetByName(TARGET)) {
      return modConfig;
    }
    const appBundleId = modConfig.ios?.bundleIdentifier;
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    // Creates the target, its product and the embed phase in the app target.
    const target = project.addTarget(TARGET, 'app_extension', TARGET, `${appBundleId}.${BUNDLE_SUFFIX}`);

    const group = project.addPbxGroup([...SOURCES, ...RESOURCES, 'Info.plist'], TARGET, TARGET);
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    project.addBuildPhase(SOURCES, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase(RESOURCES, 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    // The extension follows the app's deployment target and team.
    const appSettings = Object.values(project.pbxXCBuildConfigurationSection()).find(
      (item) => item?.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER?.replace(/"/g, '') === appBundleId
    )?.buildSettings;
    const configList = objects.XCConfigurationList[target.pbxNativeTarget.buildConfigurationList];
    for (const { value } of configList.buildConfigurations) {
      Object.assign(objects.XCBuildConfiguration[value].buildSettings, {
        INFOPLIST_FILE: `${TARGET}/Info.plist`,
        IPHONEOS_DEPLOYMENT_TARGET: appSettings?.IPHONEOS_DEPLOYMENT_TARGET ?? '16.4',
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        CODE_SIGN_STYLE: 'Automatic',
        MARKETING_VERSION: appSettings?.MARKETING_VERSION ?? '1.0',
        CURRENT_PROJECT_VERSION: appSettings?.CURRENT_PROJECT_VERSION ?? '1',
        GENERATE_INFOPLIST_FILE: 'NO',
        CLANG_ENABLE_MODULES: 'YES',
        SDKROOT: 'iphoneos',
        // Extension hardening (ported from the 28 Sep build): only
        // extension-safe APIs; not installed on its own, so an Archive is an
        // app archive and not a "Generic Xcode Archive"; and it finds the
        // app's embedded frameworks from PlugIns/<ext>.appex.
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        SKIP_INSTALL: 'YES',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
        ...(appSettings?.DEVELOPMENT_TEAM ? { DEVELOPMENT_TEAM: appSettings.DEVELOPMENT_TEAM } : {}),
      });
    }

    project.addTargetDependency(project.getFirstTarget().uuid, [target.uuid]);
    return modConfig;
  });
}

// O13: the app declares Live Activities. No App Group, no push.
function withLiveActivities(config) {
  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults.NSSupportsLiveActivities = true;
    return modConfig;
  });
}

module.exports = function withRestCountdownWidget(config) {
  return withLiveActivities(withWidgetTarget(withWidgetFiles(config)));
};
module.exports.TARGET = TARGET;
module.exports.BUNDLE_SUFFIX = BUNDLE_SUFFIX;
