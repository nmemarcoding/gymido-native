import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import Spinner from '../../../shared/components/Spinner';
import { colors, textScale } from '../../../shared/theme/tokens';
import SessionLoadingScreen, { RING, TILE } from './SessionLoadingScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

function render() {
  let tree;
  act(() => {
    tree = create(<SessionLoadingScreen />);
  });
  return tree;
}
const byId = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');

describe('SessionLoadingScreen (v2 §5 session variant)', () => {
  it('is one polite progressbar with the label, announced once', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const tree = render();
    const status = byId(tree, 'session-loading');
    expect(status.props).toMatchObject({
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: 'Restoring your session and preparing the app',
      accessibilityLiveRegion: 'polite',
    });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Restoring your session and preparing the app');
  });

  it('centres the 96 ring on the WINDOW centre, where the splash tile is', () => {
    const ring = StyleSheet.flatten(byId(render(), 'session-loading-ring').props.style);
    // The content starts below the 47 top inset: 844 / 2 − 47 − 48.
    expect(ring).toMatchObject({ width: RING, height: RING, top: 844 / 2 - 47 - RING / 2 });
    expect(ring.top + 47 + RING / 2).toBe(844 / 2);
  });

  it('draws the gold ring on a faint track around the solid gold G tile', () => {
    const tree = render();
    expect(tree.root.findByType(Spinner).props).toMatchObject({ size: 96, thickness: 4, color: '#FFC21A', track: 'rgba(255, 255, 255, 0.08)' });
    const g = tree.root.findAllByType(Text).find((node) => node.props.children === 'G');
    expect(StyleSheet.flatten(g.props.style)).toMatchObject({ fontFamily: 'Geist-Bold', fontSize: 26, color: '#0A0B0F' });
    expect(StyleSheet.flatten(g.parent.props.style)).toMatchObject({ width: TILE, height: TILE, borderRadius: 16, backgroundColor: '#FFC21A' });
  });

  it('puts the label 24 below the ring, centred, in text-secondary', () => {
    const tree = render();
    const label = tree.root.findAllByType(Text).find((node) => node.props.children === 'Restoring your session and preparing the app');
    const style = StyleSheet.flatten(label.props.style);
    expect(style).toMatchObject({ textAlign: 'center', maxWidth: 260, color: '#B4B9C3', top: 844 / 2 - 47 - 48 + 96 + 24 });
  });

  it("draws the board's own gold glow", () => {
    expect(render().root.find((node) => node.props.testID === 'ambient-glow')).toBeTruthy();
  });
});

describe('SessionLoadingScreen: UX §8.5 colour + §9 large text', () => {
  afterEach(() => {
    mockFontScale = 1;
  });

  it('the ring track is color-track (board white 0.08)', () => {
    expect(render().root.findByType(Spinner).props.track).toBe(colors.track);
  });

  it.each([1, 2])('fontScale %p: the label caps at textScale.body, keeps its place, never a fixed height or line limit', (fontScale) => {
    mockFontScale = fontScale;
    const tree = render();
    const label = byId(tree, 'session-loading-label');
    expect(label.props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(label.props.numberOfLines).toBeUndefined();
    const style = StyleSheet.flatten(label.props.style);
    expect(style.height).toBeUndefined();
    expect(style).toMatchObject({ fontSize: 15, lineHeight: 22, top: 844 / 2 - 47 - 48 + 96 + 24 });
    // The G glyph is fixed-geometry chrome inside the 52 tile.
    expect(tree.root.findAllByType(Text).find((node) => node.props.children === 'G').props.allowFontScaling).toBe(false);
  });
});
