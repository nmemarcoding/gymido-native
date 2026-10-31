// T-170 (LIVE-WORKOUT-SPEC v2.3.1 §5.4, D-T170-2): the phone live workout leaves
// the fit for large text by the web rule (width < 19rem = 304 × fontScale);
// tablets keep the app reflow (fontScale > 1.3, §8). §0.1: one Fit display cap.
import { create, act } from 'react-test-renderer';

import { CAP_FIT, FIT_CAP, LIVE_LARGE_TEXT_WIDTH, isLiveLargeText, useLiveLargeText } from './largeText';

let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: mockFontScale }),
}));

describe('§5.4 live large-text trigger (D-T170-2)', () => {
  it('is the web (width < 19rem) rule: 19 × 16 = 304 per unit of text scale', () => {
    expect(LIVE_LARGE_TEXT_WIDTH).toBe(304);
  });

  // §5.4 thresholds: 360 → 1.184 · 390 → 1.283 · 440 → 1.447 (and the §9.1 cells).
  it.each([
    [360, 1, false],
    [360, 1.15, false],
    [360, 1.18, false],
    [360, 1.19, true],
    [360, 1.3, true],
    [360, 2, true],
    [375, 1.23, false],
    [375, 1.24, true],
    [390, 1.12, false],
    [390, 1.24, false],
    [390, 1.28, false],
    [390, 1.29, true],
    [390, 1.35, true],
    [440, 1.44, false],
    [440, 1.45, true],
  ])('%i wide at %s → large text %s', (width, scale, large) => {
    expect(isLiveLargeText(width, scale)).toBe(large);
  });

  function readHook(tablet) {
    let value;
    function Probe() {
      value = useLiveLargeText(tablet);
      return null;
    }
    act(() => {
      create(<Probe />);
    });
    return value;
  }

  it('phones use the width rule (390 at 1.3: large; the old > 1.3 rule said fit)', () => {
    mockWidth = 390;
    mockFontScale = 1.3;
    expect(readHook(false)).toBe(true);
    mockFontScale = 1.28;
    expect(readHook(false)).toBe(false);
  });

  it('tablets keep the app reflow above 1.3 (§8: no large-text mode by width)', () => {
    mockWidth = 834;
    mockFontScale = 1.3;
    expect(readHook(true)).toBe(false);
    mockFontScale = 1.31;
    expect(readHook(true)).toBe(true);
    mockFontScale = 2;
    expect(readHook(true)).toBe(true);
  });
});

describe('§0.1 Fit display role', () => {
  it('caps at 1.3 and is one frozen role', () => {
    expect(FIT_CAP).toBe(1.3);
    expect(CAP_FIT).toEqual({ maxFontSizeMultiplier: 1.3 });
    expect(Object.isFrozen(CAP_FIT)).toBe(true);
  });
});
