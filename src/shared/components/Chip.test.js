import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font } from '../theme/tokens';
import Chip, { CHIP_HEIGHT, CHIP_HIT_SLOP } from './Chip';

// RN-SPEC-v2-foundation §4.4 filter chip.

const flat = (style) => StyleSheet.flatten(style) ?? {};
const pressable = (tree) => tree.root.findAll((node) => node.props.testID === 'chip' && typeof node.props.style === 'function')[0];
const styleOf = (tree, pressed = false) => {
  const { style } = pressable(tree).props;
  return flat(typeof style === 'function' ? style({ pressed }) : style);
};
const labelStyle = (tree, text) => flat(tree.root.findAll((node) => node.type === Text && node.props.children === text)[0].props.style);

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<Chip testID="chip" label="Chest" onPress={() => {}} {...props} />);
  });
  return tree;
}

describe('Chip', () => {
  it('off: 38 tall, padding 0 16, radius full, 0.05 fill + 1 px 0.10 border, 14/500 text-strong-2', () => {
    const tree = render();
    const style = styleOf(tree);
    expect(CHIP_HEIGHT).toBe(38);
    expect(style.minHeight).toBe(38);
    expect(style.paddingHorizontal).toBe(16);
    expect(style.borderRadius).toBe(999);
    expect(style.backgroundColor).toBe(colors.fillChip);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.hairlineStrong);
    const text = labelStyle(tree, 'Chest');
    expect(text.fontSize).toBe(14);
    expect(text.fontFamily).toBe(font(500).fontFamily);
    expect(text.color).toBe(colors.textStrong2);
  });

  it('on: the light fill + on-light 600; selected state exposed', () => {
    const tree = render({ selected: true });
    const style = styleOf(tree);
    expect(style.backgroundColor).toBe(colors.textPrimary);
    expect(style.borderWidth).toBe(1);
    const text = labelStyle(tree, 'Chest');
    expect(text.fontFamily).toBe(font(600).fontFamily);
    expect(text.color).toBe(colors.onLight);
    expect(pressable(tree).props.accessibilityState).toEqual({ selected: true, disabled: false });
  });

  it('44 hit area via hitSlop (3 + 38 + 3)', () => {
    const tree = render();
    expect(pressable(tree).props.hitSlop).toBe(CHIP_HIT_SLOP);
    expect(CHIP_HIT_SLOP.top + CHIP_HEIGHT + CHIP_HIT_SLOP.bottom).toBe(44);
  });

  it('pressed (off): a stronger glass fill; pressed (on) keeps the light fill', () => {
    expect(styleOf(render(), true).backgroundColor).toBe(colors.hairlineButton);
    expect(styleOf(render({ selected: true }), true).backgroundColor).toBe(colors.textPrimary);
  });

  it('press calls onPress; disabled = opacity 0.5, not pressable, state exposed', () => {
    const onPress = jest.fn();
    const tree = render({ onPress });
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);

    const off = render({ disabled: true });
    expect(styleOf(off).opacity).toBe(0.5);
    expect(pressable(off).props.disabled).toBe(true);
    expect(pressable(off).props.accessibilityState).toEqual({ selected: false, disabled: true });
  });

  it('role, label and hint pass through (default role button, label = text)', () => {
    const tree = render();
    expect(pressable(tree).props.accessibilityRole).toBe('button');
    expect(pressable(tree).props.accessibilityLabel).toBe('Chest');
    const custom = render({ accessibilityRole: 'togglebutton', accessibilityLabel: 'Chest filter', accessibilityHint: 'Muscle group' });
    expect(pressable(custom).props.accessibilityRole).toBe('togglebutton');
    expect(pressable(custom).props.accessibilityLabel).toBe('Chest filter');
    expect(pressable(custom).props.accessibilityHint).toBe('Muscle group');
  });
});
