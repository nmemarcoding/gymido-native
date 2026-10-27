import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font } from '../theme/tokens';
import SegmentedSwitch from './SegmentedSwitch';

// RN-SPEC-v2-foundation §4.7 segmented switch.

const SEGMENTS = [
  { value: 'cm', label: 'cm', testID: 'unit-cm' },
  { value: 'ft_in', label: 'ft/in', testID: 'unit-ft_in' },
];
const flat = (style) => StyleSheet.flatten(style) ?? {};
const segment = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const segStyle = (tree, id, pressed = false) => flat(segment(tree, id).props.style({ pressed }));
const textStyle = (tree, text) => flat(tree.root.findAll((node) => node.type === Text && node.props.children === text)[0].props.style);
const track = (tree) => flat(tree.root.find((node) => node.props.testID === 'switch' && node.type === 'View').props.style);

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<SegmentedSwitch testID="switch" accessibilityLabel="Height unit" segments={SEGMENTS} value="cm" onChange={() => {}} {...props} />);
  });
  return tree;
}

describe('SegmentedSwitch', () => {
  it('track: surface + 1 px hairline, padding 4, radius full; the group is labelled', () => {
    const tree = render();
    const style = track(tree);
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.hairline);
    expect(style.padding).toBe(4);
    expect(style.borderRadius).toBe(999);
    expect(tree.root.find((node) => node.props.testID === 'switch' && node.type === 'View').props.accessibilityLabel).toBe('Height unit');
  });

  it('selected: the light fill + on-light 600; unselected: transparent + text-secondary 500; state exposed', () => {
    const tree = render();
    expect(segStyle(tree, 'unit-cm').backgroundColor).toBe(colors.textPrimary);
    expect(segStyle(tree, 'unit-ft_in').backgroundColor).toBeUndefined();
    expect(textStyle(tree, 'cm').fontFamily).toBe(font(600).fontFamily);
    expect(textStyle(tree, 'cm').color).toBe(colors.onLight);
    expect(textStyle(tree, 'ft/in').fontFamily).toBe(font(500).fontFamily);
    expect(textStyle(tree, 'ft/in').color).toBe(colors.textSecondary);
    expect(segment(tree, 'unit-cm').props.accessibilityState).toEqual({ selected: true });
    expect(segment(tree, 'unit-ft_in').props.accessibilityState).toEqual({ selected: false });
    expect(segment(tree, 'unit-cm').props.accessibilityRole).toBe('button');
  });

  // 27 Oct 2026 (RN-SPEC-MEMBER-PLANS / TRAINER-PLANS audit b2): the tablet set editor's selected unit is gold.
  it('selectedTone="gold": the selected segment is the gold fill + on-gold 600; the rest unchanged', () => {
    const tree = render({ selectedTone: 'gold' });
    expect(segStyle(tree, 'unit-cm').backgroundColor).toBe(colors.gold);
    expect(textStyle(tree, 'cm')).toMatchObject({ color: colors.onGold, fontFamily: font(600).fontFamily });
    expect(segStyle(tree, 'unit-ft_in').backgroundColor).toBeUndefined();
    expect(textStyle(tree, 'ft/in').color).toBe(colors.textSecondary);
  });

  it('pressed (unselected): a faint glass fill', () => {
    expect(segStyle(render(), 'unit-ft_in', true).backgroundColor).toBe(colors.fillButton);
  });

  it('default size: segments 40 tall with a 44 hit area; segmentWidth is a minimum width', () => {
    const tree = render({ segmentWidth: 120 });
    const style = segStyle(tree, 'unit-cm');
    expect(style.minHeight).toBe(40);
    expect(style.minWidth).toBe(120);
    expect(style.width).toBeUndefined();
    const slop = segment(tree, 'unit-cm').props.hitSlop;
    expect(slop.top + 40 + slop.bottom).toBe(44);
    expect(textStyle(tree, 'cm').fontSize).toBe(14);
  });

  it('compact (height unit): segments 34 tall, 13 px, still a 44 hit area; segments share the width', () => {
    const tree = render({ compact: true });
    const style = segStyle(tree, 'unit-cm');
    expect(style.minHeight).toBe(34);
    expect(style.flexGrow).toBe(1);
    const slop = segment(tree, 'unit-cm').props.hitSlop;
    expect(slop.top + 34 + slop.bottom).toBe(44);
    expect(textStyle(tree, 'cm').fontSize).toBe(13);
  });

  it('a press reports the segment value', () => {
    const onChange = jest.fn();
    const tree = render({ onChange });
    act(() => segment(tree, 'unit-ft_in').props.onPress());
    expect(onChange).toHaveBeenCalledWith('ft_in');
  });

  it('never cuts a label off at large Dynamic Type: no line cap, font scaling on, centred', () => {
    const tree = render({ segmentWidth: 120 });
    const label = tree.root.findAll((node) => node.type === Text && node.props.children === 'cm')[0];
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.allowFontScaling).not.toBe(false);
    expect(textStyle(tree, 'cm').textAlign).toBe('center');
  });
});
