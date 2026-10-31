import { Platform, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import TabletRail from './TabletRail';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./shellUiStore', () => ({ closePanel: jest.fn() }));
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 834, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

const realOS = Platform.OS;
afterEach(() => {
  mockFontScale = 1;
  Platform.OS = realOS;
});

// T-170 step 4: the icons-only branch (fontScale > 1.3) at the boundary scales.
describe('TabletRail text scale branches', () => {
  it.each([
    [1, false],
    [1.15, false],
    [1.3, false],
    [1.31, true],
    [2, true],
  ])('fontScale %s: iconsOnly = %s', (scale, iconsOnly) => {
    mockFontScale = scale;
    Platform.OS = 'android';
    let tree;
    act(() => {
      tree = create(<TabletRail mode="member" path="/" />);
    });
    const items = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('rail-') && typeof n.props.style === 'function');
    expect(items.length).toBeGreaterThan(1);
    items.forEach((t) => {
      expect(t.props.accessibilityLabel).toBeTruthy();
      expect(Boolean(t.props.accessibilityShowsLargeContentViewer)).toBe(iconsOnly);
      expect(typeof t.props.onLongPress).toBe(iconsOnly ? 'function' : 'undefined');
      let inner;
      act(() => {
        inner = create(<>{t.props.children({ pressed: false })}</>);
      });
      expect(inner.root.findAllByType(Text).length).toBe(iconsOnly ? 0 : 1);
    });
  });
});
