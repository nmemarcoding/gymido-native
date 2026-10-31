import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { CompletionPopup, DiscardDialog, ExactAlarmDialog, FinishEarlyDialog, SpeakIntroDialog } from './RuntimeOverlays';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockWidth > 700 ? 1194 : 844, scale: 2, fontScale: mockFontScale }),
}));

const mounted = [];
afterEach(() => {
  mockWidth = 390;
  mockFontScale = 1;
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
const host = (tree, id) => tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
const flat = (node) => StyleSheet.flatten(node.props.style) ?? {};

const POPUP = { planName: 'Upper / Lower Split', durationSeconds: 3130, totalVolume: 9820, totalReps: 142, completedSets: 15, totalSets: 15, completedExercises: 5, totalExercises: 5 };

// T-170 step 4: reflow (fontScale > 1.3) on the workout overlays.
// [width, fontScale, reflow]
const CASES = [
  [390, 1, false],
  [390, 1.15, false],
  [390, 1.3, false],
  [390, 1.31, true],
  [390, 2, true],
  [834, 1, false],
  [834, 1.3, false],
  [834, 1.31, true],
  [834, 2, true],
];

describe('RuntimeOverlays text scale branches', () => {
  it.each(CASES)('width %s, fontScale %s: CompletionPopup stats reflow = %s', (width, scale, reflow) => {
    mockWidth = width;
    mockFontScale = scale;
    const tree = render(<CompletionPopup popup={POPUP} onClose={() => {}} />);
    expect(flat(host(tree, 'completion-stats')).flexDirection).toBe(reflow ? 'column' : 'row');
  });

  describe.each([
    // Discard / Finish early always stack on a phone (verb first, ND6); the tablet stacks past 1.3.
    ['DiscardDialog', (p) => <DiscardDialog open onKeep={() => {}} onDiscard={() => {}} {...p} />, true],
    ['FinishEarlyDialog', (p) => <FinishEarlyDialog open message="Some sets are not done." onKeep={() => {}} onFinish={() => {}} {...p} />, true],
    ['ExactAlarmDialog', (p) => <ExactAlarmDialog open onNotNow={() => {}} onOpenSettings={() => {}} {...p} />],
    ['SpeakIntroDialog', (p) => <SpeakIntroDialog open onKeepOn={() => {}} onTurnOff={() => {}} onOpenAnnounceSettings={() => {}} {...p} />],
  ])('%s', (_name, make, phoneAlwaysStacked = false) => {
    it.each(CASES)('width %s, fontScale %s: action pair stacked = %s', (width, scale, reflow) => {
      mockWidth = width;
      mockFontScale = scale;
      const tree = render(make({}));
      const actions = host(tree, 'sheet-actions');
      expect(actions).toBeTruthy();
      expect(flat(actions).flexDirection).toBe(reflow || (phoneAlwaysStacked && width < 768) ? undefined : 'row');
    });
  });
});
