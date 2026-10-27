import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import GradientFill from './GradientFill';
import Screen, { AmbientGlow, resolveGlow } from './Screen';
import { gradients } from '../theme/tokens';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];

describe('Screen v2 ground', () => {
  it('paints the ground colour and keeps the app-root testID and children', () => {
    const tree = render(
      <Screen>
        <Text>Hello</Text>
      </Screen>
    );
    expect(StyleSheet.flatten(host(tree, 'app-root').props.style).backgroundColor).toBe('#0A0B0F');
    expect(tree.root.findByType(Text).props.children).toBe('Hello');
  });

  it('draws no glow by default', () => {
    const tree = render(<Screen />);
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
    expect(host(tree, 'ambient-glow')).toBeUndefined();
  });

  it('glow: the gold ambient radial, full-screen behind the content, never touchable', () => {
    const tree = render(<Screen glow />);
    const fill = tree.root.findByType(GradientFill);
    expect(fill.props.radial).toEqual(gradients.goldAmbient.radial);
    expect(fill.props.colors).toEqual(['rgba(255, 194, 26, 0.20)', 'rgba(255, 194, 26, 0)']);
    const layer = host(tree, 'ambient-glow');
    expect(layer.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    // Painted first, so it sits behind the content.
    expect(host(tree, 'app-root').props.children[0].type).toBe(AmbientGlow);
  });

  it('glow can take a board-specific radial spec', () => {
    const spec = { radial: { cx: 0.85, cy: -0.08, rx: 1.2, ry: 0.55 }, colors: ['rgba(255, 194, 26, 0.20)', 'rgba(255, 194, 26, 0)'], stops: [0, 0.6] };
    expect(resolveGlow(spec)).toBe(spec);
    expect(render(<AmbientGlow glow={spec} />).root.findByType(GradientFill).props.radial).toBe(spec.radial);
  });

  it('resolveGlow: off for false/undefined, the token for true', () => {
    expect(resolveGlow(false)).toBeNull();
    expect(resolveGlow(undefined)).toBeNull();
    expect(resolveGlow(true)).toBe(gradients.goldAmbient);
  });
});
