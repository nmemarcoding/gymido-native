import { BlurView } from 'expo-blur';
import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import BlurLayer from './BlurLayer';
import GlassSurface, { BLUR_MIN_ANDROID_API, usesSolidGlass } from './GlassSurface';

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
