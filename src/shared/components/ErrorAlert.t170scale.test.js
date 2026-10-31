import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ErrorAlert from './ErrorAlert';

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

// T-170 step 4: the Retry takes the text column's full width past 1.3.
describe('ErrorAlert text scale branches', () => {
  it.each(SCALES)('fontScale %s: Retry stacked = %s', (scale, stacked) => {
    mockFontScale = scale;
    const tree = render(<ErrorAlert title="Failed" description="Oops" onRetry={() => {}} retryTestID="retry" />);
    const retry = tree.root.findAll((n) => n.props.testID === 'retry')[0];
    expect(retry).toBeTruthy();
    const styles = tree.root.findAll((n) => n.props.testID === 'retry').map((n) => StyleSheet.flatten(n.props.style) ?? {});
    expect(styles.some((s) => s.alignSelf === 'stretch')).toBe(stacked);
  });
});
