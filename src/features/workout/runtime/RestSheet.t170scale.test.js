import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import RestSheet from './RestSheet';

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Rect: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
});
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

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockFontScale = 1;
  mockWidth = 390;
});

// T-170 step 4: the phone live-large-text rule (width < 304 x fontScale): the
// body scrolls and Skip stretches, with no one-line limit on its label.
describe('RestSheet text scale branch', () => {
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
        <RestSheet
          timer={{ setId: 1, secondsLeft: 60, totalSeconds: 90 }}
          hero={{ mode: 'next', left: 2, name: 'Bench Press' }}
          onMinimize={() => {}}
          onAdjust={() => {}}
          onSkip={() => {}}
          window={{ width, height: 844 }}
          insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
        />,
      );
    });
    mounted.push(tree);
    const scroll = tree.root.findAll((n) => n.props.testID === 'rest-sheet-scroll');
    expect(scroll.length > 0).toBe(stacked);
    const skip = tree.root.findAll((n) => n.props.testID === 'rest-timer-skip' && typeof n.props.style === 'function')[0];
    expect(StyleSheet.flatten(skip.props.style({ pressed: false })).alignSelf).toBe(stacked ? 'stretch' : undefined);
    const skipText = skip.findAll((n) => n.type === 'Text')[0];
    expect(skipText.props.numberOfLines).toBe(stacked ? undefined : 1);
    expect(skipText.props.maxFontSizeMultiplier).toBe(1.3);
  });
});
