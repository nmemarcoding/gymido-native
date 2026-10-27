import { BlurView } from 'expo-blur';
import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import BlurLayer from './BlurLayer';
import { blur, colors } from '../theme/tokens';
import GlassSurface, { BLUR_MIN_ANDROID_API, GLASS_TONES, usesSolidGlass } from './GlassSurface';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const fill = (tree, id) => StyleSheet.flatten(tree.root.find((node) => node.props.testID === `${id}-fill` && typeof node.type === 'string').props.style);

describe('GlassSurface (v2 glass chrome)', () => {
  it('blurs, then lays the glass colour, the strong hairline edge and the float shadow', () => {
    const tree = render(
      <GlassSurface testID="bar" radius={33}>
        <Text>Today</Text>
      </GlassSurface>
    );
    expect(tree.root.findAllByType(BlurView)).toHaveLength(1);
    expect(fill(tree, 'bar').backgroundColor).toBe('rgba(30, 33, 41, 0.72)');
    const surface = StyleSheet.flatten(tree.root.find((node) => node.props.testID === 'bar' && typeof node.type === 'string').props.style);
    expect(surface).toMatchObject({ borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)', borderRadius: 33, boxShadow: '0px 16px 40px rgba(0, 0, 0, 0.5)' });
    expect(tree.root.findByType(Text).props.children).toBe('Today');
  });

  it('uses the denser 0.85 glass for toasts and menus', () => {
    expect(fill(render(<GlassSurface testID="toast" tone="toast" />), 'toast').backgroundColor).toBe('rgba(30, 33, 41, 0.85)');
  });

  it('draws the solid glass with no blur when forced', () => {
    const tree = render(<GlassSurface testID="bar" solid />);
    expect(tree.root.findAllByType(BlurView)).toHaveLength(0);
    expect(fill(tree, 'bar').backgroundColor).toBe('rgba(30, 33, 41, 0.96)');
  });

  it('can drop the float shadow', () => {
    const tree = render(<GlassSurface testID="pill" shadow={false} />);
    const surface = StyleSheet.flatten(tree.root.find((node) => node.props.testID === 'pill' && typeof node.type === 'string').props.style);
    expect(surface.boxShadow).toBeUndefined();
  });

  it('falls back to solid glass only on Android before API 31', () => {
    expect(BLUR_MIN_ANDROID_API).toBe(31);
    expect(usesSolidGlass({ OS: 'android', Version: 30 })).toBe(true);
    expect(usesSolidGlass({ OS: 'android', Version: 31 })).toBe(false);
    expect(usesSolidGlass({ OS: 'android', Version: 35 })).toBe(false);
    expect(usesSolidGlass({ OS: 'ios', Version: '17.0' })).toBe(false);
  });
});

describe('BlurLayer', () => {
  it('blurs with the dark tint by default (v2 is dark only)', () => {
    const blur = render(<BlurLayer />).root.findByType(BlurView);
    expect(blur.props.tint).toBe('dark');
    expect(blur.props.intensity).toBe(20);
  });

  it('takes another tint when asked', () => {
    expect(render(<BlurLayer tint="light" blurPx={24} />).root.findByType(BlurView).props).toMatchObject({ tint: 'light', intensity: 60 });
  });
});

describe('GlassSurface tones (UX §8.4 / §8.7, kit 2)', () => {
  const blurOf = (tree) => tree.root.findByType(BlurLayer).props.blurPx;

  it.each([
    ['glass', colors.glass, blur.glass],
    ['toast', colors.glassToast, blur.glass],
    ['glassStrong', colors.glassStrong, blur.glassStrong],
    ['onPhoto', colors.onPhoto, blur.onPhoto],
    ['scrimStrong', colors.scrimStrong, blur.scrimStrong],
  ])('%s: its fill over its blur radius', (tone, fillColor, radius) => {
    const tree = render(<GlassSurface testID="g" tone={tone} />);
    expect(fill(tree, 'g').backgroundColor).toBe(fillColor);
    expect(blurOf(tree)).toBe(radius);
  });

  it('U4 the loading disc tone: scrim-strong 0.72 + blur 16', () => {
    expect(colors.scrimStrong).toBe('rgba(10, 11, 15, 0.72)');
    expect(blur.scrimStrong).toBe(16);
    expect(GLASS_TONES.scrimStrong).toMatchObject({ fill: colors.scrimStrong, blurPx: 16 });
  });

  it('glassStrong 24 and onPhoto 12 come from blur.*', () => {
    expect(blur.glassStrong).toBe(24);
    expect(blur.onPhoto).toBe(12);
  });

  it('`blurPx` overrides the tone radius', () => {
    expect(blurOf(render(<GlassSurface testID="g" tone="onPhoto" blurPx={8} />))).toBe(8);
  });

  it('`fill` overrides the tone fill over the blur', () => {
    const tree = render(<GlassSurface testID="g" tone="onPhoto" fill={colors.onPhotoStrong} />);
    expect(fill(tree, 'g').backgroundColor).toBe(colors.onPhotoStrong);
    expect(blurOf(tree)).toBe(blur.onPhoto);
  });

  it.each([
    ['glass', colors.glassSolid],
    ['toast', colors.glassSolid],
    ['glassStrong', colors.glassSolid],
    ['onPhoto', colors.onPhoto],
    ['scrimStrong', colors.scrimStrong],
  ])('solid fallback, %s: no blur, draws %s', (tone, solidFill) => {
    const tree = render(<GlassSurface testID="g" tone={tone} solid fill={colors.hairline} />);
    expect(tree.root.findAllByType(BlurLayer)).toHaveLength(0);
    // The solid fallback ignores `fill` and keeps the tone's solid colour.
    expect(fill(tree, 'g').backgroundColor).toBe(solidFill);
  });

  it('an unknown tone falls back to glass', () => {
    const tree = render(<GlassSurface testID="g" tone="nope" />);
    expect(fill(tree, 'g').backgroundColor).toBe(colors.glass);
    expect(blurOf(tree)).toBe(blur.glass);
  });
});
