import { act, create } from 'react-test-renderer';

import PillButton from '../../../shared/components/PillButton';
import { LeaveWorkoutDialog } from './SessionDialogs';

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Path: Mock, Rect: Mock, Circle: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock, G: Mock };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const trees = [];
afterEach(() => {
  mockWidth = 390;
  mockFontScale = 1;
  act(() => trees.splice(0).forEach((tree) => tree.unmount()));
});

// T-170 step 4: the button pair stacks past 1.3 (tablet); the phone is always stacked, verb first.
describe('SessionDialogs text scale branch', () => {
  it.each([
    [390, 1, false],
    [390, 1.15, false],
    [390, 1.3, false],
    [390, 1.31, false],
    [390, 2, false],
    [834, 1, true],
    [834, 1.15, true],
    [834, 1.3, true],
    [834, 1.31, false],
    [834, 2, false],
  ])('width %s, fontScale %s: pair in a row = %s', (width, scale, row) => {
    mockWidth = width;
    mockFontScale = scale;
    let tree;
    act(() => {
      tree = create(<LeaveWorkoutDialog open onStay={() => {}} onLeave={() => {}} />);
    });
    trees.push(tree);
    const buttons = tree.root.findAllByType(PillButton);
    expect(buttons.map((b) => b.props.title)).toEqual(row ? ['Stay', 'Leave'] : ['Leave', 'Stay']);
    buttons.forEach((b) => expect(Boolean(b.props.fullWidth)).toBe(!row));
  });
});
