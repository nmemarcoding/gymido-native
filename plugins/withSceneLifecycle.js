const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// iOS 27 asserts at launch unless the app uses the scene-based life cycle.
// Expo SDK 57 ships the scene delegate (EXExpoAppSceneDelegate) but its
// prebuild template still starts React Native from the app delegate, so this
// adopts it: the scene manifest, and an app delegate that leaves the window
// to the scene delegate. Drop it once the SDK template does this itself.
const START_REACT_NATIVE = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const SCENE_STARTS_REACT_NATIVE = `    // The window is created and React Native is started by the scene delegate
    // (ExpoAppSceneDelegate) under the scene-based life cycle required by iOS 27.`;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes('ExpoReactNativeFactoryProvider')) {
      return modConfig;
    }
    if (!contents.includes('class AppDelegate: ExpoAppDelegate {') || !contents.includes(START_REACT_NATIVE)) {
      throw new Error('[withSceneLifecycle] AppDelegate.swift no longer matches the SDK 57 template; update the plugin.');
    }
    contents = contents
      .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      .replace(START_REACT_NATIVE, SCENE_STARTS_REACT_NATIVE);
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return modConfig;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneManifest(withSceneAppDelegate(config));
};
