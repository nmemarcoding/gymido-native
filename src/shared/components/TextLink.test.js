const ReactNative = require('react-native');
import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font, textScale } from '../theme/tokens';
import TextLink from './TextLink';

// RN-SPEC-v2-foundation §4.8 TextLink: 14/600 gold, min-height 44, optional "→".

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const pressableOf = (tree) => tree.root.findAll((node) => typeof node.type !== 'string' && node.props.accessibilityRole && typeof node.props.style !== 'undefined' && node.props.onPress !== undefined)[0];
const textOf = (tree, pressed = false) => {
  const child = pressableOf(tree).props.children({ pressed });
  return child;
};

describe('TextLink', () => {
  it('default: 14/600 gold, no underline, a link role and its label', () => {
    const tree = render(<TextLink testID="all-plans" label="← All plans" onPress={() => {}} />);
    const text = tree.root.findByType(Text);
    expect(StyleSheet.flatten(text.props.style)).toEqual({ ...font(600), fontSize: 14, lineHeight: 20, color: colors.gold });
    expect(text.props.children).toBe('← All plans');
    const pressable = pressableOf(tree);
    expect(pressable.props.accessibilityRole).toBe('link');
    expect(pressable.props.accessibilityLabel).toBe('← All plans');
    expect(pressable.props.testID).toBe('all-plans');
  });

  it('min-height 44 is the touch area (no vertical hitSlop needed)', () => {
    const tree = render(<TextLink label="Edit" onPress={() => {}} />);
    const pressable = pressableOf(tree);
    expect(StyleSheet.flatten(pressable.props.style)).toMatchObject({ minHeight: 44, justifyContent: 'center' });
    expect(pressable.props.hitSlop).toEqual({ left: 8, right: 8 });
  });

  it('pressed: underlined', () => {
    const tree = render(<TextLink label="Edit" onPress={() => {}} />);
    expect(StyleSheet.flatten(textOf(tree, true).props.style).textDecorationLine).toBe('underline');
    expect(StyleSheet.flatten(textOf(tree, false).props.style).textDecorationLine).toBeUndefined();
  });

  it('arrow: appends a decorative "→" kept out of the accessible name', () => {
    const tree = render(<TextLink label="Start" arrow onPress={() => {}} />);
    expect(tree.root.findByType(Text).props.children).toBe('Start →');
    expect(pressableOf(tree).props.accessibilityLabel).toBe('Start');
  });

  it('an accessibilityLabel overrides the label', () => {
    const tree = render(<TextLink label="← Back" accessibilityLabel="Back to client" onPress={() => {}} />);
    expect(pressableOf(tree).props.accessibilityLabel).toBe('Back to client');
  });

  it('a press calls onPress', () => {
    const onPress = jest.fn();
    const tree = render(<TextLink label="Edit" onPress={onPress} />);
    act(() => pressableOf(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('never sets fontWeight next to the Geist family', () => {
    const tree = render(<TextLink label="Edit" onPress={() => {}} />);
    expect(StyleSheet.flatten(tree.root.findByType(Text).props.style).fontWeight).toBeUndefined();
  });
});

describe('TextLink large text (UX §9 rule 2: no truncation)', () => {
  afterEach(() => jest.restoreAllMocks());
  const LONG = 'See every plan your trainer assigned to you this month';

  it.each([1, 2, 3.1])('fontScale %f: never cut to one line, wraps instead, capped at the body 2.0', (fontScale) => {
    jest.spyOn(ReactNative, 'useWindowDimensions', 'get').mockReturnValue(() => ({ width: 390, height: 844, scale: 3, fontScale }));
    const tree = render(<TextLink label={LONG} arrow onPress={() => {}} />);
    [false, true].forEach((pressed) => {
      const text = textOf(tree, pressed);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expect(text.props.adjustsFontSizeToFit).toBeUndefined();
      expect(text.props.maxFontSizeMultiplier).toBe(textScale.body);
      expect(text.props.textBreakStrategy).toBe('simple');
      expect(text.props.children).toBe(`${LONG} →`);
    });
    // The pressable shrinks inside a row so the label can wrap; it grows from 44.
    const link = StyleSheet.flatten(pressableOf(tree).props.style);
    expect(link).toMatchObject({ flexShrink: 1, minHeight: 44 });
    expect(link.height).toBeUndefined();
  });
});
