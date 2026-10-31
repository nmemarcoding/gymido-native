import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import EmptyState from './EmptyState';

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Rect: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
});
jest.mock('./GradientFill', () => () => null);
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

afterEach(() => {
  mockFontScale = 1;
});

const SCALES = [
  [1, false],
  [1.15, false],
  [1.3, false],
  [1.31, true],
  [2, true],
];

function render(el) {
  let tree;
  act(() => {
    tree = create(el);
  });
  return tree;
}

// T-170 step 4: the reflow branch (fontScale > 1.3) of EmptyState.
describe('EmptyState text scale branches', () => {
  it.each(SCALES)('fontScale %s: action stacked = %s', (scale, stacked) => {
    mockFontScale = scale;
    const tree = render(<EmptyState actionLabel="Go" onAction={() => {}} actionTestID="go" />);
    const action = tree.root.find((n) => n.props.testID === 'empty-state-action' && typeof n.type === 'string');
    expect(StyleSheet.flatten(action.props.style).alignSelf).toBe(stacked ? 'stretch' : undefined);
  });
});
