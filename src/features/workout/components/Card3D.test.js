import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import GradientFill from '../../../shared/components/GradientFill';
import Card3D from './Card3D';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const hostById = (tree, id) => tree.root.find((node) => typeof node.type === 'string' && node.props.testID === id);
const flat = (node) => StyleSheet.flatten(node.props.style);

describe('Card3D (v2: renders the v2 card; card-3d retired)', () => {
  it('keeps testID and children and draws the v2 surface: hairline, radius 24, no shadow', () => {
    const tree = render(
      <Card3D testID="workout-hero">
        <Text>Body</Text>
      </Card3D>,
    );
    const style = flat(hostById(tree, 'workout-hero'));
    expect(style).toMatchObject({ backgroundColor: '#15171D', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 24 });
    expect(style.boxShadow).toBeUndefined();
    expect(style.padding).toBeUndefined();
    expect(tree.root.findByType(Text).props.children).toBe('Body');
  });

  it('drops the v1 top sheen (no gradient on the default card)', () => {
    const tree = render(
      <Card3D>
        <Text>Body</Text>
      </Card3D>,
    );
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });

  it('applies the caller style on top (call sites keep their padding and layout)', () => {
    const tree = render(
      <Card3D testID="card" style={[{ padding: 20 }, { width: '48%' }]}>
        <Text>Body</Text>
      </Card3D>,
    );
    expect(flat(hostById(tree, 'card'))).toMatchObject({ padding: 20, width: '48%', borderRadius: 24 });
  });

  it('hero: gradient-card at radius 28, clipped', () => {
    const tree = render(
      <Card3D testID="card" hero>
        <Text>Body</Text>
      </Card3D>,
    );
    expect(flat(hostById(tree, 'card'))).toMatchObject({ borderRadius: 28, overflow: 'hidden' });
    const [fill] = tree.root.findAllByType(GradientFill);
    expect(fill.props).toMatchObject({ angle: 160, colors: ['#1E2129', '#14161C'] });
  });
});
