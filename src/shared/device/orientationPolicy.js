import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions, Platform } from 'react-native';

// RN-SPEC-app-shell [O2]: phones are locked to portrait; tablets rotate freely,
// and the ≥768pt layout follows the live window width (layoutMetrics.js reads
// useWindowDimensions, so rotation and split-screen re-lay the shell).
//
// iOS needs nothing here: Info.plist already allows portrait only on iPhone
// and all four orientations on iPad (app.config.js).
//
// Android: the manifest keeps its portrait lock, so a phone is portrait from
// the very first frame, before JS runs. At startup a tablet unlocks rotation.
// Tablet = the SCREEN's shortest side ≥ 600dp — the screen, not the window,
// so a tablet in split-screen still counts as a tablet.
export const TABLET_MIN_DP = 600;

export function isAndroidTablet(screen = Dimensions.get('screen')) {
  return Math.min(screen.width, screen.height) >= TABLET_MIN_DP;
}

// Resolves to what it applied: 'rotate' | 'portrait' | null (iOS).
export async function applyOrientationPolicy({ platform = Platform.OS, screen = Dimensions.get('screen') } = {}) {
  if (platform !== 'android') {
    return null;
  }
  try {
    if (isAndroidTablet(screen)) {
      await ScreenOrientation.unlockAsync();
      return 'rotate';
    }
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return 'portrait';
  } catch {
    // Best effort: the manifest's portrait lock still holds for phones.
    return null;
  }
}
