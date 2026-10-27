import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { Body, Eyebrow, Heading } from './Typography';

// The three native typography primitives (RN-SPEC-v2-foundation §2, board
// "Typography (native)"), rendered.
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree.root.findByType(Text);
}
const flat = (node) => StyleSheet.flatten(node.props.style);

describe('Typography primitives (v2)', () => {
  it('Eyebrow: caption 12/600 gold, sentence case (no tracked caps)', () => {
    const text = render(<Eyebrow>Active plan</Eyebrow>);
    expect(text.props.children).toBe('Active plan');
    expect(flat(text)).toEqual({ fontFamily: 'Geist-SemiBold', fontSize: 12, lineHeight: 16, color: '#FFC21A' });
    expect(flat(text).textTransform).toBeUndefined();
  });

  it('Heading: title-md 24/28 700 −0.03 em, text-primary, an accessibility header', () => {
    const text = render(<Heading>Sign-in failed</Heading>);
    expect(text.props.accessibilityRole).toBe('header');
    expect(flat(text)).toEqual({ fontFamily: 'Geist-Bold', fontSize: 24, lineHeight: 28, letterSpacing: -0.72, color: '#F5F6F8' });
  });

  it('Body: body 15/22 in text-secondary', () => {
    expect(flat(render(<Body>4 days / week</Body>))).toEqual({ fontFamily: 'Geist-Regular', fontSize: 15, lineHeight: 22, letterSpacing: 0, color: '#B4B9C3' });
  });

  it('lets the caller override the style', () => {
    expect(flat(render(<Body style={{ color: '#9BA1AD' }}>x</Body>)).color).toBe('#9BA1AD');
  });
});
