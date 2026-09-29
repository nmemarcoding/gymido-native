const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// The iOS 27 SDK (Xcode 27) asserts at launch unless the app adopts the UIScene
// life cycle ("UIScene life cycle is required for apps built with this SDK").
// Expo SDK 57's runtime already ships ExpoAppSceneDelegate for this, but the
// SDK 57 prebuild template still generates the window-based AppDelegate.
// This ports the SDK 58 template setup:
// - Info.plist gets a scene manifest pointing at ExpoAppSceneDelegate by its
//   Objective-C name (no extra Swift file to add to the Xcode project).
// - AppDelegate conforms to ExpoReactNativeFactoryProvider and no longer
//   creates the window; the scene delegate creates it and starts React Native.
// URL / universal-link events are re-fed to the AppDelegate by Expo's
// SceneEventForwarder, which de-duplicates SDK 57-style RCTLinkingManager calls.
// Remove this plugin once the project moves to an SDK whose template does this.

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const CLASS_DECLARATION = 'class AppDelegate: ExpoAppDelegate {';

function patchAppDelegate(contents) {
  if (contents.includes('ExpoReactNativeFactoryProvider')) {
    return contents;
  }
  if (!contents.includes(CLASS_DECLARATION) || !contents.includes(WINDOW_BLOCK)) {
    throw new Error(
      '[withSceneLifecycle] AppDelegate.swift no longer matches the SDK 57 template; update or remove this plugin.'
    );
  }
  return contents
    .replace(CLASS_DECLARATION, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
    .replace(
      WINDOW_BLOCK,
      `    // The window is created and React Native is started by the scene delegate
    // (ExpoAppSceneDelegate) under the scene-based life cycle required by iOS 27.
`
    );
}

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('[withSceneLifecycle] expected a Swift AppDelegate.');
    }
    mod.modResults.contents = patchAppDelegate(mod.modResults.contents);
    return mod;
  });
};

module.exports.patchAppDelegate = patchAppDelegate;
