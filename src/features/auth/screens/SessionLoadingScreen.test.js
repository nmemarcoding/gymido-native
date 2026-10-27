import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import Spinner from '../../../shared/components/Spinner';
import { colors, textScale } from '../../../shared/theme/tokens';
import SessionLoadingScreen, {
  LABEL_GAP,
  RING,
  TABLET_GAP,
  TABLET_GLOW,
  TABLET_RING,
  TABLET_SPINNER,
  TABLET_TILE,
  TILE,
} from './SessionLoadingScreen';
import { gradients, shadows } from '../../../shared/theme/tokens';
import GradientFill from '../../../shared/components/GradientFill';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});
let mockFontScale = 1;
let mockWidth = 390;
let mockHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 3, fontScale: mockFontScale }),
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

  it('puts the label 28 below the ring (UX A gap 28), centred, in text-secondary', () => {
    const tree = render();
    const label = tree.root.findAllByType(Text).find((node) => node.props.children === 'Restoring your session and preparing the app');
    const style = StyleSheet.flatten(label.props.style);
    expect(style).toMatchObject({ textAlign: 'center', maxWidth: 260, color: '#B4B9C3', top: 844 / 2 - 47 - 48 + 96 + 28 });
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

  it.each([1, 2, 3.1])('fontScale %p: the label caps at textScale.body, keeps its place, never a fixed height or line limit', (fontScale) => {
    mockFontScale = fontScale;
    const tree = render();
    const label = byId(tree, 'session-loading-label');
    expect(label.props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(label.props.numberOfLines).toBeUndefined();
    const style = StyleSheet.flatten(label.props.style);
    expect(style.height).toBeUndefined();
    expect(style).toMatchObject({ fontSize: 15, lineHeight: 22, top: 844 / 2 - 47 - 48 + 96 + 28 });
    // The G glyph is fixed-geometry chrome inside the 52 tile.
    expect(tree.root.findAllByType(Text).find((node) => node.props.children === 'G').props.allowFontScaling).toBe(false);
  });
});

describe('SessionLoadingScreen: A4 tablet (board TabletSessionLoading)', () => {
  beforeEach(() => {
    mockWidth = 834;
    mockHeight = 1194;
  });
  afterEach(() => {
    mockWidth = 390;
    mockHeight = 844;
    mockFontScale = 1;
  });
  const flat = (node) => StyleSheet.flatten(node.props.style);
  const label = (tree) => byId(tree, 'session-loading-label');

  it('the phone structure: the whole container is the one polite progressbar, announced once', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    const tree = render();
    expect(byId(tree, 'session-loading').props).toMatchObject({
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: 'Restoring your session and preparing the app',
      accessibilityLiveRegion: 'polite',
    });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Restoring your session and preparing the app');
  });

  it('a centred column: the 260 loader, gap 44, the label', () => {
    const tree = render();
    expect(flat(byId(tree, 'session-loading'))).toMatchObject({ alignItems: 'center', justifyContent: 'center', gap: TABLET_GAP });
    expect(TABLET_GAP).toBe(44);
    expect(flat(byId(tree, 'session-loading-ring'))).toMatchObject({ width: TABLET_RING, height: TABLET_RING });
    expect(TABLET_RING).toBe(260);
    // No absolute offsets on tablet: the column centres itself.
    expect(flat(byId(tree, 'session-loading-ring')).top).toBeUndefined();
    expect(flat(label(tree)).top).toBeUndefined();
  });

  it('the ring: r 118, stroke 12 (248 across inside the 260 box), gold on color-track', () => {
    const spinner = render().root.findByType(Spinner);
    expect(TABLET_SPINNER).toBe(248);
    expect(spinner.props).toMatchObject({ size: 248, thickness: 12, color: colors.gold, track: colors.track });
    // Spinner radius = size / 2 − stroke / 2 = the board's 118.
    expect(spinner.props.size / 2 - spinner.props.thickness / 2).toBe(118);
  });

  it('the 120 tile: SOLID gold (U3), radius 38, shadow-gold-glow-lg (U11), "G" 60/700 on-gold', () => {
    const tree = render();
    expect(flat(byId(tree, 'session-loading-tile'))).toMatchObject({
      width: TABLET_TILE,
      height: TABLET_TILE,
      borderRadius: 38,
      backgroundColor: colors.gold,
      boxShadow: shadows.goldGlowLarge,
    });
    expect(TABLET_TILE).toBe(120);
    expect(byId(tree, 'session-loading-tile').findAllByType(GradientFill)).toHaveLength(0);
    const g = tree.root.findAllByType(Text).find((node) => node.props.children === 'G');
    expect(flat(g)).toMatchObject({ fontFamily: 'Geist-Bold', fontSize: 60, letterSpacing: -2.4, color: colors.onGold });
    expect(flat(g).fontWeight).toBeUndefined();
    expect(g.props.allowFontScaling).toBe(false);
  });

  it('the label: 20/28 500 text-strong-2, centred, max 420', () => {
    expect(flat(label(render()))).toMatchObject({
      fontFamily: 'Geist-Medium',
      fontSize: 20,
      lineHeight: 28,
      color: colors.textStrong2,
      textAlign: 'center',
      maxWidth: 420,
    });
  });

  it("the board's glow geometry (55% 38% at 50% 45%) in the glow-gold-orb colours, from the first render", () => {
    expect(TABLET_GLOW.radial).toEqual({ cx: 0.5, cy: 0.45, rx: 0.55, ry: 0.38 });
    expect(TABLET_GLOW.colors).toBe(gradients.heroGlow.colors);
    const glow = render().root.find((node) => node.props.testID === 'ambient-glow');
    expect(glow.findByType(GradientFill).props.radial).toEqual(TABLET_GLOW.radial);
  });

  it.each([1, 2, 3.1])('fontScale %p: the label caps at textScale.body, no fixed height or line limit; the G never scales', (fontScale) => {
    mockFontScale = fontScale;
    const tree = render();
    expect(label(tree).props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(label(tree).props.numberOfLines).toBeUndefined();
    expect(flat(label(tree)).height).toBeUndefined();
    expect(flat(byId(tree, 'session-loading-ring'))).toMatchObject({ width: 260, height: 260 });
    expect(tree.root.findAllByType(Text).find((node) => node.props.children === 'G').props.allowFontScaling).toBe(false);
  });

  it('phone below 768 keeps the 96 ring and the 52 tile', () => {
    mockWidth = 767;
    const tree = render();
    expect(tree.root.findByType(Spinner).props).toMatchObject({ size: RING, thickness: 4 });
    expect(flat(byId(tree, 'session-loading-tile'))).toMatchObject({ width: TILE, height: TILE });
    expect(LABEL_GAP).toBe(28);
  });

  it('landscape tablet (1194 x 834) uses the tablet layout too', () => {
    mockWidth = 1194;
    mockHeight = 834;
    expect(render().root.findByType(Spinner).props.size).toBe(TABLET_SPINNER);
  });
});
