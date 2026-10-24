import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions, Platform } from 'react-native';

// app-shell O2 (accepted mechanism, 29 Sep 2026): Android keeps the manifest's
// portrait lock and only tablets are unlocked, measured on the SCREEN (not
// the window) so split-screen never demotes a tablet. iOS is handled by
// Info.plist alone.
export function isAndroidTablet(screen = Dimensions.get('screen')) {
  return Math.min(screen.width, screen.height) >= 600;
}

export function unlockTabletOrientation(os = Platform.OS, screen = Dimensions.get('screen')) {
  if (os !== 'android' || !isAndroidTablet(screen)) {
    return false;
  }
  ScreenOrientation.unlockAsync().catch(() => {});
  return true;
}
