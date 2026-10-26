jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { Dimensions, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import Card from './Card';

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
  it('is the web surface card: transparent 1px border, radius 23.2, shadow-soft, padding 20', () => {
    const tree = render(
      <Card>
        <Text>Body</Text>
      </Card>,
    );
    const style = flat(tree.root.findByType(Text).parent);
    expect(style).toMatchObject({
      backgroundColor: '#ffffff',
      borderColor: 'transparent',
      borderWidth: 1,
      borderRadius: 23.2,
      padding: 20,
      boxShadow: '0px 8px 24px rgba(11, 29, 58, 0.08)',
    });
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
    expect(flat(body.parent)).toMatchObject({ padding: 20, paddingHorizontal: 24 });
  });

  it('renders the optional header: 20 bold title, 14 subtitle, border/70 divider', () => {
    const tree = render(
      <Card title="Recent logs" subtitle="The latest entries you added.">
        <Text>Body</Text>
      </Card>,
    );
    const [title, subtitle] = tree.root.findAllByType(Text);
    expect(title.props.accessibilityRole).toBe('header');
    expect(flat(title)).toMatchObject({ fontSize: 20, fontWeight: '700', letterSpacing: -0.5 });
    expect(flat(subtitle)).toMatchObject({ fontSize: 14, marginTop: 4, color: '#4b5563' });
    expect(flat(title.parent)).toMatchObject({
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(229, 231, 235, 0.70)',
    });
    expect(flat(tree.root.findAllByType(Text)[2].parent)).toMatchObject({ padding: 20 });
  });
});
