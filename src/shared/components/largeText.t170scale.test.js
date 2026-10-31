import { act, create } from 'react-test-renderer';

import { isLiveLargeText, useLargeTextReflow, useLiveLargeText } from './largeText';

let mockFontScale = 1;
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale }),
}));

afterEach(() => {
  mockFontScale = 1;
  mockWidth = 390;
});

function probe(hook) {
  let value;
  const Probe = () => {
    value = hook();
    return null;
  };
  let tree;
  act(() => {
    tree = create(<Probe />);
  });
  act(() => tree.unmount());
  return value;
}

// T-170 step 4: the three shared large-text rules at the boundary scales.
describe('useLargeTextReflow (fontScale > 1.3)', () => {
  it.each([
    [1, false],
    [1.15, false],
    [1.3, false],
    [1.31, true],
    [2, true],
  ])('fontScale %s -> %s', (scale, expected) => {
    mockFontScale = scale;
    expect(probe(() => useLargeTextReflow())).toBe(expected);
  });
});

describe('isLiveLargeText / useLiveLargeText (phone: width < 304 x fontScale; tablet: fontScale > 1.3)', () => {
  it.each([
    [360, 1, false],
    [360, 1.15, false],
    [360, 1.18, false],
    [360, 1.19, true],
    [360, 1.3, true],
    [360, 1.31, true],
    [360, 2, true],
    [390, 1, false],
    [390, 1.15, false],
    [390, 1.28, false],
    [390, 1.29, true],
    [390, 1.3, true],
    [390, 1.31, true],
    [390, 2, true],
  ])('phone width %s, fontScale %s -> %s', (width, scale, expected) => {
    expect(isLiveLargeText(width, scale)).toBe(expected);
    mockWidth = width;
    mockFontScale = scale;
    expect(probe(() => useLiveLargeText(false))).toBe(expected);
  });

  it.each([
    [1, false],
    [1.15, false],
    [1.3, false],
    [1.31, true],
    [2, true],
  ])('tablet (width 834), fontScale %s -> %s', (scale, expected) => {
    mockWidth = 834;
    mockFontScale = scale;
    expect(probe(() => useLiveLargeText(true))).toBe(expected);
  });
});
