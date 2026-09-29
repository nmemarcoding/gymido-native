const { patchAppDelegate } = require('./withSceneLifecycle');

const SDK57_APP_DELEGATE = `@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
`;

test('adopts ExpoReactNativeFactoryProvider and stops creating the window', () => {
  const patched = patchAppDelegate(SDK57_APP_DELEGATE);
  expect(patched).toContain('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
  expect(patched).not.toContain('UIWindow(frame:');
  expect(patched).not.toContain('startReactNative');
});

test('is idempotent', () => {
  const once = patchAppDelegate(SDK57_APP_DELEGATE);
  expect(patchAppDelegate(once)).toBe(once);
});

test('fails loudly if the template changes', () => {
  expect(() => patchAppDelegate('class AppDelegate: Something {}')).toThrow(/no longer matches/);
});
