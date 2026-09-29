import * as ScreenOrientation from 'expo-screen-orientation';

import { applyOrientationPolicy, isAndroidTablet, TABLET_MIN_DP } from '../orientationPolicy';

// RN-SPEC-app-shell [O2]: Android phones portrait, Android tablets rotate,
// iOS left to Info.plist.

beforeEach(() => {
  ScreenOrientation.lockAsync.mockClear();
  ScreenOrientation.unlockAsync.mockClear();
});

describe('isAndroidTablet', () => {
  it('uses the shortest side of the screen, at 600dp', () => {
    expect(TABLET_MIN_DP).toBe(600);
    expect(isAndroidTablet({ width: 412, height: 915 })).toBe(false); // Pixel 8
    expect(isAndroidTablet({ width: 1280, height: 800 })).toBe(true); // Pixel Tablet, landscape
    expect(isAndroidTablet({ width: 600, height: 960 })).toBe(true); // exactly 600
    expect(isAndroidTablet({ width: 599, height: 960 })).toBe(false);
  });
});

describe('applyOrientationPolicy', () => {
  it('Android phone: locks portrait', async () => {
    await expect(applyOrientationPolicy({ platform: 'android', screen: { width: 412, height: 915 } })).resolves.toBe('portrait');
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
  });

  it('Android tablet: unlocks rotation', async () => {
    await expect(applyOrientationPolicy({ platform: 'android', screen: { width: 800, height: 1280 } })).resolves.toBe('rotate');
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });

  it('iOS: does nothing (Info.plist handles iPhone and iPad)', async () => {
    await expect(applyOrientationPolicy({ platform: 'ios', screen: { width: 1024, height: 1366 } })).resolves.toBeNull();
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
  });

  it('a native failure never escapes', async () => {
    ScreenOrientation.unlockAsync.mockRejectedValueOnce(new Error('no activity'));
    await expect(applyOrientationPolicy({ platform: 'android', screen: { width: 800, height: 1280 } })).resolves.toBeNull();
  });
});
