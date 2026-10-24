jest.mock('expo-screen-orientation', () => ({ unlockAsync: jest.fn(() => Promise.resolve()) }));

const ScreenOrientation = require('expo-screen-orientation');
const { isAndroidTablet, unlockTabletOrientation } = require('./tabletOrientation');

describe('tablet orientation (app-shell O2)', () => {
  beforeEach(() => ScreenOrientation.unlockAsync.mockClear());

  it('treats a shortest screen side of 600dp or more as a tablet', () => {
    expect(isAndroidTablet({ width: 800, height: 1280 })).toBe(true);
    expect(isAndroidTablet({ width: 412, height: 915 })).toBe(false);
  });

  it('unlocks only Android tablets', () => {
    expect(unlockTabletOrientation('android', { width: 800, height: 1280 })).toBe(true);
    expect(unlockTabletOrientation('android', { width: 412, height: 915 })).toBe(false);
    expect(unlockTabletOrientation('ios', { width: 1024, height: 1366 })).toBe(false);
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
  });
});
