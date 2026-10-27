jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import Card, { CardSurface } from './Card';
import GradientFill from './GradientFill';

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const flat = (node) => StyleSheet.flatten(node.props.style);

let windowWidth;
beforeEach(() => {
  windowWidth = 390;
  jest.spyOn(Dimensions, 'get').mockImplementation(() => ({ width: windowWidth, height: 1000, scale: 2, fontScale: 1 }));
});
afterEach(() => jest.restoreAllMocks());

describe('Card (design system v1 P8)', () => {
  it('is the v2 card: surface, 1px hairline border, radius 24, no shadow, padding 18', () => {
    const tree = render(
      <Card>
        <Text>Body</Text>
      </Card>,
    );
    const style = flat(tree.root.findByType(Text).parent);
    // v2 P1-05 (declared look-only change): surface #15171D, radius-xl 24,
    // and v1's shadow-soft is retired (no shadow on dark).
    // v2 kit card (declared look-only change): 1px color-hairline border
    // (was transparent) and padding 18 (was 20), RN-SPEC-v2 §4.8.
    expect(style).toMatchObject({
      backgroundColor: '#15171D',
      borderColor: 'rgba(255, 255, 255, 0.07)',
      borderWidth: 1,
      borderRadius: 24,
      padding: 18,
    });
    // (declared) the retired shadow is now absent rather than `undefined`.
    expect(style.boxShadow).toBeUndefined();
    expect(style.paddingHorizontal).toBeUndefined();
  });

  it('widens only the side padding to 24 from 640', () => {
    windowWidth = 640;
    const tree = render(
      <Card title="Recent logs">
        <Text>Body</Text>
      </Card>,
    );
    const [title, body] = tree.root.findAllByType(Text);
    expect(flat(title.parent)).toMatchObject({ paddingVertical: 16, paddingHorizontal: 24 });
    // v2 kit card (declared): padding 18 (was 20); the 24 sides stay.
    expect(flat(body.parent)).toMatchObject({ padding: 18, paddingHorizontal: 24 });
  });

  it('renders the optional header: 20 bold title, 14 subtitle, border/70 divider', () => {
    const tree = render(
      <Card title="Recent logs" subtitle="The latest entries you added.">
        <Text>Body</Text>
      </Card>,
    );
    const [title, subtitle] = tree.root.findAllByType(Text);
    expect(title.props.accessibilityRole).toBe('header');
    // v2 kit card (declared): Geist Bold via font(700) replaces fontWeight '700'.
    expect(flat(title)).toMatchObject({ fontSize: 20, fontFamily: 'Geist-Bold', letterSpacing: -0.5 });
    expect(flat(title).fontWeight).toBeUndefined();
    // v2 P1-05 (declared): text-secondary is #B4B9C3 on dark.
    expect(flat(subtitle)).toMatchObject({ fontSize: 14, marginTop: 4, color: '#B4B9C3' });
    expect(flat(title.parent)).toMatchObject({
      // v2 kit card (declared): 18 to line up with the body (was 20).
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderBottomWidth: 1,
      // v2 P1-05 (declared): color-hairline.
      borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    });
    expect(flat(tree.root.findAllByType(Text)[2].parent)).toMatchObject({ padding: 18 });
  });

  it('draws no gradient on the default card', () => {
    const tree = render(
      <Card>
        <Text>Body</Text>
      </Card>,
    );
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });

  it('hero: gradient-card through GradientFill from the first render, radius 28, clipped', () => {
    const tree = render(
      <Card hero>
        <Text>Body</Text>
      </Card>,
    );
    const fills = tree.root.findAllByType(GradientFill);
    expect(fills).toHaveLength(1);
    expect(fills[0].props).toMatchObject({ angle: 160, colors: ['#1E2129', '#14161C'] });
    const style = flat(tree.root.findByType(Text).parent);
    expect(style).toMatchObject({ borderRadius: 28, overflow: 'hidden', padding: 18, borderColor: 'rgba(255, 255, 255, 0.07)' });
  });

  it('hero with a header keeps the title, the divider and the gradient', () => {
    const tree = render(
      <Card hero title="Today">
        <Text>Body</Text>
      </Card>,
    );
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(1);
    const [title] = tree.root.findAllByType(Text);
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('a caller style still wins over the card frame', () => {
    const tree = render(
      <Card style={{ padding: 0, borderRadius: 12 }}>
        <Text>Body</Text>
      </Card>,
    );
    expect(flat(tree.root.findByType(Text).parent)).toMatchObject({ padding: 0, borderRadius: 12 });
  });
});

describe('CardSurface (the bare v2 card)', () => {
  it('is the surface with a hairline and radius 24, no padding, no gradient', () => {
    const tree = render(
      <CardSurface testID="surface">
        <Text>Body</Text>
      </CardSurface>,
    );
    const node = tree.root.find((n) => n.type === View && n.props.testID === 'surface');
    const style = flat(node);
    expect(style).toMatchObject({ backgroundColor: '#15171D', borderColor: 'rgba(255, 255, 255, 0.07)', borderWidth: 1, borderRadius: 24 });
    expect(style.padding).toBeUndefined();
    expect(style.boxShadow).toBeUndefined();
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(0);
  });

  it('hero draws gradient-card at radius 28 behind the children', () => {
    const tree = render(
      <CardSurface testID="surface" hero>
        <Text>Body</Text>
      </CardSurface>,
    );
    const node = tree.root.find((n) => n.type === View && n.props.testID === 'surface');
    expect(flat(node)).toMatchObject({ borderRadius: 28, overflow: 'hidden' });
    // The fill is the first child, so the content draws above it.
    const json = tree.toJSON();
    expect(json.children[0].props.pointerEvents).toBe('none');
    expect(json.children[1].type).toBe('Text');
    expect(tree.root.findAllByType(GradientFill)).toHaveLength(1);
  });
});
