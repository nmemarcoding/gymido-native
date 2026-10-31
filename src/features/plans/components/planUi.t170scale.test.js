import { act, create } from 'react-test-renderer';

import { useReflow } from './planUi';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

afterEach(() => {
  mockFontScale = 1;
});

// T-170 step 4: useReflow is fontScale > 1.3.
describe('planUi useReflow', () => {
  it.each([
    [1, false],
    [1.15, false],
    [1.3, false],
    [1.31, true],
    [2, true],
  ])('fontScale %s -> %s', (scale, expected) => {
    mockFontScale = scale;
    let value;
    const Probe = () => {
      value = useReflow();
      return null;
    };
    let tree;
    act(() => {
      tree = create(<Probe />);
    });
    act(() => tree.unmount());
    expect(value).toBe(expected);
  });
});
