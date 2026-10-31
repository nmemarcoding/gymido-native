import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import EndCoachingDialog from './EndCoachingDialog';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => 0, useKeyboardOverlap: () => 0 }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('../../../shared/components/BlurLayer', () => () => null);
let mockFontScale = 1;
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 3, fontScale: mockFontScale }),
}));

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockFontScale = 1;
  mockWidth = 390;
});

// T-170 step 4: the confirm / cancel pair is a row only on a tablet at <= 1.3.
describe('EndCoachingDialog text scale branch', () => {
  it.each([
    [390, 1, false],
    [390, 1.3, false],
    [390, 1.31, false],
    [390, 2, false],
    [1024, 1, true],
    [1024, 1.15, true],
    [1024, 1.3, true],
    [1024, 1.31, false],
    [1024, 2, false],
  ])('width %s, fontScale %s: row = %s', (width, scale, row) => {
    mockWidth = width;
    mockFontScale = scale;
    let tree;
    act(() => {
      tree = create(<EndCoachingDialog isOpen onClose={() => {}} onConfirm={() => {}} title="End coaching?" description="Sure?" confirmLabel="End" testID="end" />);
    });
    mounted.push(tree);
    const actions = tree.root.find((n) => n.props.testID === 'end-actions' && typeof n.type === 'string');
    expect(StyleSheet.flatten(actions.props.style).flexDirection).toBe(row ? 'row' : 'column-reverse');
  });
});
