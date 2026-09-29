const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

// O13 (RN-SPEC-time): the rest countdown's WidgetKit extension, which renders
// the self-ending Lock Screen Live Activity.
//
// Deliberately NO App Group and NO entitlements file: a free Apple Personal Team
// can't sign an App Group (proven on the owner's device), and nothing needs
// one — the layout is compiled into the extension and the data travels in
// ActivityKit's ContentState. __tests__/restCountdownPrebuild.test.js pins that
// no target gains application-groups or aps-environment.
//
// Everything is generated at prebuild from files in this repo, so it survives
// `expo prebuild --clean`:
//   plugins/restCountdown/RestCountdownWidget.swift        the Live Activity
//   plugins/restCountdown/RestCountdownCardView.swift      the card (also snapshot-tested)
//   modules/rest-countdown/ios/RestCountdownAttributes.swift  the shared data type
//   plugins/restCountdown/GymidoMark/GymidoMark@2x.png, @3x.png  the app mark
//     (32 and 48 px, from the app icon's artwork). Optional: without them the
//     card shows the spec's fallback, the SF Symbol `timer`.
const TARGET = 'RestCountdownWidget';
const BUNDLE_SUFFIX = 'RestCountdown';
const EMBED_PHASE = 'Embed Foundation Extensions';
const ASSETS = 'Assets.xcassets';
const MARK_DIR = path.join(__dirname, 'restCountdown', 'GymidoMark');
const MARK_FILES = ['GymidoMark@2x.png', 'GymidoMark@3x.png'];
const SOURCES = [
  path.join(__dirname, 'restCountdown', 'RestCountdownWidget.swift'),
  path.join(__dirname, 'restCountdown', 'RestCountdownCardView.swift'),
  path.join(__dirname, '..', 'modules', 'rest-countdown', 'ios', 'RestCountdownAttributes.swift'),
];
const SOURCE_NAMES = SOURCES.map((file) => path.basename(file));

function infoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`;
}

const catalogInfo = { info: { author: 'xcode', version: 1 } };

// The extension's own asset catalog. The GymidoMark image set is written only
// when both artwork files exist, so a missing mark falls back cleanly.
function writeAssetCatalog(dir) {
  const catalog = path.join(dir, ASSETS);
  fs.rmSync(catalog, { recursive: true, force: true });
  fs.mkdirSync(catalog, { recursive: true });
  fs.writeFileSync(path.join(catalog, 'Contents.json'), JSON.stringify(catalogInfo, null, 2));
  if (!MARK_FILES.every((file) => fs.existsSync(path.join(MARK_DIR, file)))) {
    return;
  }
  const imageSet = path.join(catalog, 'GymidoMark.imageset');
  fs.mkdirSync(imageSet);
  MARK_FILES.forEach((file) => fs.copyFileSync(path.join(MARK_DIR, file), path.join(imageSet, file)));
  fs.writeFileSync(
    path.join(imageSet, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          { idiom: 'universal', scale: '1x' },
          { idiom: 'universal', scale: '2x', filename: MARK_FILES[0] },
          { idiom: 'universal', scale: '3x', filename: MARK_FILES[1] },
        ],
        ...catalogInfo,
      },
      null,
      2
    )
  );
}

// The extension's files, written into ios/ at prebuild.
const withSources = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, TARGET);
      fs.mkdirSync(dir, { recursive: true });
      SOURCES.forEach((file) => fs.copyFileSync(file, path.join(dir, path.basename(file))));
      fs.writeFileSync(path.join(dir, 'Info.plist'), infoPlist());
      writeAssetCatalog(dir);
      return mod;
    },
  ]);

function buildPhase(project, type, targetUuid, comment) {
  const section = project.hash.project.objects[type];
  const target = project.pbxNativeTargetSection()[targetUuid];
  const phase = target?.buildPhases?.find((entry) => (!comment || entry.comment === comment) && section?.[entry.value]);
  return phase ? section[phase.value] : null;
}

const withTarget = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    if (project.pbxTargetByName(TARGET)) {
      return mod;
    }
    const bundleIdentifier = `${config.ios.bundleIdentifier}.${BUNDLE_SUFFIX}`;
    const mainTargetUuid = project.getFirstTarget().uuid;
    const deploymentTarget = config.ios?.deploymentTarget ?? '16.4';

    // No CODE_SIGN_ENTITLEMENTS at all: this target has none.
    const settings = {
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
      INFOPLIST_FILE: `${TARGET}/Info.plist`,
      GENERATE_INFOPLIST_FILE: '"YES"',
      INFOPLIST_KEY_CFBundleDisplayName: TARGET,
      MARKETING_VERSION: `"${config.ios?.version ?? config.version ?? '1.0'}"`,
      CURRENT_PROJECT_VERSION: `"${config.ios?.buildNumber ?? '1'}"`,
      IPHONEOS_DEPLOYMENT_TARGET: `"${deploymentTarget}"`,
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      APPLICATION_EXTENSION_API_ONLY: '"YES"',
      SKIP_INSTALL: '"YES"',
      CODE_SIGN_STYLE: 'Automatic',
      ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS: '"NO"',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    };
    const configurationList = project.addXCConfigurationList(
      ['Debug', 'Release'].map((name) => ({ name, isa: 'XCBuildConfiguration', buildSettings: { ...settings } })),
      'Release',
      `Build configuration list for PBXNativeTarget "${TARGET}"`
    );

    const productFile = project.addProductFile(TARGET, {
      basename: `${TARGET}.appex`,
      group: EMBED_PHASE,
      explicitFileType: 'wrapper.app-extension',
      settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
      includeInIndex: 0,
      path: `${TARGET}.appex`,
      sourceTree: 'BUILT_PRODUCTS_DIR',
    });

    const target = {
      uuid: project.generateUuid(),
      pbxNativeTarget: {
        isa: 'PBXNativeTarget',
        name: TARGET,
        productName: TARGET,
        productReference: productFile.fileRef,
        productType: '"com.apple.product-type.app-extension"',
        buildConfigurationList: configurationList.uuid,
        buildPhases: [],
        buildRules: [],
        dependencies: [],
      },
    };
    project.addToPbxNativeTargetSection(target);
    project.addToPbxProjectSection(target);
    const pbxProject = project.pbxProjectSection()[project.getFirstProject().uuid];
    pbxProject.attributes.TargetAttributes = pbxProject.attributes.TargetAttributes || {};
    pbxProject.attributes.TargetAttributes[target.uuid] = { LastSwiftMigration: 1250 };

    // The app builds and embeds the extension.
    project.hash.project.objects.PBXTargetDependency = project.hash.project.objects.PBXTargetDependency || {};
    project.hash.project.objects.PBXContainerItemProxy = project.hash.project.objects.PBXContainerItemProxy || {};
    project.addTargetDependency(mainTargetUuid, [target.uuid]);

    project.addBuildPhase(SOURCE_NAMES, 'PBXSourcesBuildPhase', 'Sources', target.uuid, 'app_extension', '""');
    project.addBuildPhase([ASSETS], 'PBXResourcesBuildPhase', 'Resources', target.uuid, 'app_extension', '""');
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid, 'app_extension', '""');
    project.addBuildPhase([], 'PBXCopyFilesBuildPhase', EMBED_PHASE, mainTargetUuid, 'app_extension', '""');
    const embed = buildPhase(project, 'PBXCopyFilesBuildPhase', mainTargetUuid, EMBED_PHASE);
    embed.files.push({ value: productFile.uuid, comment: `${productFile.basename} in ${EMBED_PHASE}` });
    project.addToPbxBuildFileSection(productFile);

    // A group for the files, so Xcode shows them and resolves their paths.
    const { uuid: groupUuid } = project.addPbxGroup([...SOURCE_NAMES, ASSETS, 'Info.plist'], TARGET, TARGET);
    const groups = project.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (groups[key].name === undefined && groups[key].path === undefined) {
        project.addToPbxGroup(groupUuid, key);
      }
    });
    return mod;
  });

// The app declares Live Activity support: an Info.plist key, not an
// entitlement, so nothing here touches signing capabilities.
const withLiveActivitiesKey = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.NSSupportsLiveActivities = true;
    return mod;
  });

module.exports = function withRestCountdownWidget(config) {
  return withLiveActivitiesKey(withTarget(withSources(config)));
};
