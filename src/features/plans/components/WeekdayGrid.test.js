import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font } from '../../../shared/theme/tokens';
import WeekdayGrid from './WeekdayGrid';

// RN-SPEC-plans §4.6 behaviour (unchanged) in the v2 weekday-chip look
// (RN-SPEC-v2-foundation §4.4).

const flat = (style) => StyleSheet.flatten(style) ?? {};
const chip = (tree, id) => tree.root.findAll((node) => node.props.testID === `day-${id}` && typeof node.props.style === 'function')[0];
const chipStyle = (tree, id, pressed = false) => flat(chip(tree, id).props.style({ pressed }));
const texts = (tree, value) => tree.root.findAll((node) => node.type === Text && node.props.children === value);

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<WeekdayGrid selected={[1, 3]} onToggle={() => {}} testIDPrefix="day" {...props} />);
  });
  return tree;
}

describe('WeekdayGrid', () => {
  it('seven chips, gap 8, each up to 52 × 52 and never under 44, radius 16', () => {
    const tree = render();
    const grid = flat(chip(tree, 1).parent.parent.props.style);
    expect([1, 2, 3, 4, 5, 6, 7].every((id) => chip(tree, id))).toBe(true);
    const style = chipStyle(tree, 2);
    expect(style.minHeight).toBe(52);
    expect(style.maxWidth).toBe(52);
    expect(style.borderRadius).toBe(16);
    expect(grid.gap === 8 || flat(chip(tree, 1).parent.props.style).gap === 8).toBe(true);
  });

  it('off: 0.05 fill + 1 px 0.10 border + text-secondary 13/500, no ✓', () => {
    const tree = render();
    const style = chipStyle(tree, 2);
    expect(style.backgroundColor).toBe(colors.fillChip);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.hairlineStrong);
    const label = flat(texts(tree, 'Tue')[0].props.style);
    expect(label.fontSize).toBe(13);
    expect(label.fontFamily).toBe(font(500).fontFamily);
    expect(label.color).toBe(colors.textSecondary);
    expect(chip(tree, 2).props.accessibilityState).toEqual({ selected: false });
  });

  it('on: gold + on-gold 600 + ring-selected + an 11/700 ✓ at top 4 / right 6, hidden from screen readers', () => {
    const tree = render();
    const style = chipStyle(tree, 1);
    expect(style.backgroundColor).toBe(colors.gold);
    expect(style.borderWidth).toBe(1);
    expect(style.boxShadow).toContain(colors.ground);
    expect(style.boxShadow).toContain(`0px 0px 0px 1px ${colors.gold}`);
    const label = flat(texts(tree, 'Mon')[0].props.style);
    expect(label.fontFamily).toBe(font(600).fontFamily);
    expect(label.color).toBe(colors.onGold);
    const checks = texts(tree, '✓');
    expect(checks).toHaveLength(2);
    const check = flat(checks[0].props.style);
    expect(check.fontSize).toBe(11);
    expect(check.fontFamily).toBe(font(700).fontFamily);
    expect(check.fontWeight).toBeUndefined();
    expect([check.top, check.right]).toEqual([4, 6]);
    expect(checks[0].props.accessibilityElementsHidden).toBe(true);
    expect(chip(tree, 1).props.accessibilityState).toEqual({ selected: true });
  });

  it('pressed (off): a stronger glass fill', () => {
    expect(chipStyle(render(), 2, true).backgroundColor).toBe(colors.fillButton);
  });

  it('a tap toggles that day; the Selected line is unchanged (short and full names)', () => {
    const onToggle = jest.fn();
    const tree = render({ onToggle });
    act(() => chip(tree, 5).props.onPress());
    expect(onToggle).toHaveBeenCalledWith(5);
    expect(texts(tree, 'Selected: Mon, Wed')).toHaveLength(1);
    expect(texts(render({ fullNames: true }), 'Selected: Monday, Wednesday')).toHaveLength(1);
    expect(texts(render({ selected: [] }), 'Selected: None yet')).toHaveLength(1);
  });
});
