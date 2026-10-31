import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import SetArcCard from './SetArcCard';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Mock = ({ children, ...props }) => <View {...props}>{children}</View>;
  return { __esModule: true, default: Mock, Path: (props) => <View {...props} />, Rect: (props) => <View {...props} /> };
});
jest.mock('../../../shared/components/Select', () => {
  const { View } = require('react-native');
  return (props) => <View {...props} />;
});
let mockFontScale = 1;
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: mockFontScale }),
}));

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockFontScale = 1;
  mockWidth = 390;
});

const exercise = {
  id: 1,
  exercise_name_snapshot: 'Leg Press',
  sets: [1, 2, 3].map((n) => ({ id: 10 + n, set_number: n, is_completed: false, target_reps_min: 8, target_reps_max: 12 })),
};

// T-170 step 4: the phone live-large-text rule (width < 304 x fontScale).
describe('SetArcCard text scale branch', () => {
  it.each([
    [390, 1, false],
    [390, 1.15, false],
    [390, 1.28, false],
    [390, 1.29, true],
    [390, 1.3, true],
    [390, 1.31, true],
    [390, 2, true],
    [360, 1.18, false],
    [360, 1.19, true],
  ])('width %s, fontScale %s: stacked = %s', (width, scale, stacked) => {
    mockWidth = width;
    mockFontScale = scale;
    let tree;
    act(() => {
      tree = create(
        <SetArcCard
          exercise={exercise}
          set={exercise.sets[0]}
          draft={{ actualWeightValue: '100', actualWeightUnit: 'lb' }}
          reps="10"
          pendingSetIds={new Set()}
          onWeightChange={() => {}}
          onUnitChange={() => {}}
          onRepsChange={() => {}}
          onStep={() => {}}
          onSelectDone={() => {}}
          onUndo={() => {}}
        />,
      );
    });
    mounted.push(tree);
    ['set-cell-weight', 'set-cell-reps'].forEach((id) => {
      const cell = tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
      expect(StyleSheet.flatten(cell.props.style).alignSelf).toBe(stacked ? 'stretch' : undefined);
    });
    // The row holding both cells: the nearest host ancestor that sets a flex direction.
    let node = tree.root.findAll((n) => n.props.testID === 'set-cell-weight' && typeof n.type === 'string')[0].parent;
    while (node && !(typeof node.type === 'string' && node.props.style && node !== null && node.props.testID !== 'set-cell-weight' && 'gap' in (StyleSheet.flatten(node.props.style) ?? {}))) {
      node = node.parent;
    }
    expect(StyleSheet.flatten(node.props.style).flexDirection).toBe(stacked ? 'column' : 'row');
  });
});
