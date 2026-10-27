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

describe('WeekdayGrid detail variant (UX H Plan detail)', () => {
  const { StyleSheet: SS } = require('react-native');
  const { colors: c, radii: r } = require('../../../shared/theme/tokens');
  function renderDetail(selected = [1]) {
    let tree;
    act(() => {
      tree = create(<WeekdayGrid selected={selected} onToggle={() => {}} testIDPrefix="day" variant="detail" />);
    });
    return tree;
  }
  const chipOf = (tree, id) => tree.root.findAll((node) => node.props.testID === `day-${id}` && typeof node.props.style === 'function')[0];

  it('48 tall, no 52 cap, gap 6, hit area into the gap; idle fill-glass; selected gold', () => {
    const tree = renderDetail();
    const idle = SS.flatten(chipOf(tree, 2).props.style({ pressed: false }));
    expect(idle).toEqual(expect.objectContaining({ minHeight: 48, maxWidth: undefined, borderRadius: r.md, backgroundColor: c.fillGlass }));
    expect(SS.flatten(chipOf(tree, 1).props.style({ pressed: false })).backgroundColor).toBe(c.gold);
    expect(chipOf(tree, 2).props.hitSlop).toEqual({ top: 0, bottom: 0, left: 3, right: 3 });
    const grid = tree.root.find((node) => node.props.testID === 'day-grid' && typeof node.type === 'string');
    expect(SS.flatten(grid.props.style).gap).toBe(6);
  });

  it('labels 14/600 (selected on-gold, idle text-strong-2), the ✓ at 10, "Selected:" 13 muted', () => {
    const tree = renderDetail();
    const labels = tree.root.findAll((node) => node.type === 'Text' && (node.props.children === 'Mon' || node.props.children === 'Tue'));
    const [mon, tue] = labels.map((node) => SS.flatten(node.props.style));
    expect([mon.fontSize, mon.color]).toEqual([14, c.onGold]);
    expect([tue.fontSize, tue.color]).toEqual([14, c.textStrong2]);
    const check = tree.root.find((node) => node.type === 'Text' && node.props.children === '✓');
    expect(SS.flatten(check.props.style).fontSize).toBe(10);
    const selected = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Selected: Mon');
    expect(SS.flatten(selected.props.style)).toEqual(expect.objectContaining({ fontSize: 13, color: c.textMuted }));
  });

  it('the default variant is unchanged (52 cap)', () => {
    let tree;
    act(() => {
      tree = create(<WeekdayGrid selected={[]} onToggle={() => {}} testIDPrefix="day" />);
    });
    expect(SS.flatten(chipOf(tree, 1).props.style({ pressed: false })).maxWidth).toBe(52);
  });
});
