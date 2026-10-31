import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { BrowsingBar, SessionChrome, SessionStats, SetEditor } from './RuntimeParts';

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Rect: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
let mockFontScale = 1;
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const trees = [];
afterEach(() => {
  mockFontScale = 1;
  mockWidth = 390;
  act(() => trees.splice(0).forEach((tree) => tree.unmount()));
});
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  trees.push(tree);
  return tree;
}
const host = (tree, id) => tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};

// T-170 step 4. Phone (LIVE-WORKOUT-SPEC §5.4): stacked = width < 304 x fontScale.
// Tablet: stacked = fontScale > 1.3. [width, fontScale, tablet, stacked]
const CASES = [
  [390, 1, false, false],
  [390, 1.15, false, false],
  [390, 1.28, false, false],
  [390, 1.29, false, true],
  [390, 1.3, false, true],
  [390, 1.31, false, true],
  [390, 2, false, true],
  [360, 1.18, false, false],
  [360, 1.19, false, true],
  [360, 2, false, true],
  [834, 1, true, false],
  [834, 1.15, true, false],
  [834, 1.3, true, false],
  [834, 1.31, true, true],
  [834, 2, true, true],
];

describe.each([['BrowsingBar'], ['SessionStats'], ['SessionChrome'], ['SetEditor']])('%s text scale branch', (name) => {
  it.each(CASES)('width %s, fontScale %s, tablet %s: stacked = %s', (width, scale, tablet, stacked) => {
    mockWidth = width;
    mockFontScale = scale;
    if (name === 'BrowsingBar') {
      const tree = render(<BrowsingBar onResume={() => {}} tablet={tablet} />);
      expect(flat(host(tree, 'browsing-bar')).flexDirection).toBe(stacked ? 'column' : 'row');
      const resume = tree.root.findAll((n) => n.props.testID === 'browsing-resume' && typeof n.type !== 'string')[0];
      expect(Boolean(resume.props.fullWidth)).toBe(stacked);
    } else if (name === 'SessionStats') {
      const tree = render(<SessionStats time="12:00" volume="1,000" volumeUnit="lb" reps="30" tablet={tablet} />);
      const stats = flat(host(tree, 'session-stats'));
      expect(stats.flexDirection).toBe(stacked ? 'column' : 'row');
      // Stacked: the label and value share a text per cell (value carries the unit).
      const value = tree.root.findAll((n) => n.type === 'Text' && [].concat(n.props.children).join('').includes('lb'));
      expect(value.length).toBeGreaterThan(0);
    } else if (name === 'SessionChrome') {
      const tree = render(
        <SessionChrome planName="Upper / Lower Split" completedSets={4} totalSets={15} exerciseCount={5} elapsed={1122} onExit={() => {}} onAll={() => {}} tablet={tablet} />,
      );
      const chrome = host(tree, 'session-chrome');
      // Stacked: three rows (Exit/All, timer/Complete, plan); fit: one row.
      const rows = chrome.children.filter((c) => typeof c !== 'string');
      const plan = host(tree, 'session-plan');
      expect(rows.length).toBe(stacked ? 4 : 2);
      if (!tablet) expect(flat(plan).alignSelf).toBe(stacked ? 'stretch' : undefined);
    } else {
      const exercise = {
        id: 1,
        exercise_name_snapshot: 'Bench',
        exercise: { id: 7, primary_muscle_group: { name: 'Chest', code: 'CHEST' } },
        sets: [{ id: 12, set_number: 1, is_completed: false, target_reps_min: 8, target_reps_max: 10, rest_seconds_planned: 90 }],
      };
      const tree = render(
        <SetEditor
          exercise={exercise}
          set={exercise.sets[0]}
          draft={{ actualWeightValue: '135', actualWeightUnit: 'lb' }}
          reps="10"
          lastTime="Last time 135 x 10"
          pendingSetIds={new Set()}
          onWeightChange={() => {}}
          onUnitChange={() => {}}
          onRepsChange={() => {}}
          onStep={() => {}}
          onToggleSet={() => {}}
          tablet={tablet}
        />,
      );
      const header = host(tree, 'set-row-12');
      expect(flat(header).flexDirection).toBe(stacked ? 'column' : 'row');
      const cells = flat(header.parent.parent.findAll((n) => typeof n.type === 'string' && flat(n).gap !== undefined && flat(n).marginTop !== undefined && flat(n).flexDirection)[0]);
      // Weight and Reps cells go one under the other for the tablet or when stacked.
      expect(cells.flexDirection).toBe(tablet || stacked ? 'column' : 'row');
    }
  });
});
