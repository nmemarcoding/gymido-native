import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font } from '../../../shared/theme/tokens';
import { Callout, Checkbox, Choice, OptionPill, WhyLine } from './GeneratorControls';

// Generator controls (RN-SPEC-PLAN-GENERATOR §G1.2 behaviour, unchanged) in
// the v2 look: RN-SPEC-v2-foundation §4.4 / §4.6 / §5 and the
// "GeneratorControls" board.

const flat = (style) => StyleSheet.flatten(style) ?? {};
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.style === 'function')[0];
const styleOf = (tree, id, pressed = false) => flat(pressable(tree, id).props.style({ pressed }));
const text = (tree, value) => tree.root.findAll((node) => node.type === Text && node.props.children === value)[0];

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

describe('Choice (card radio)', () => {
  const choice = (props = {}) =>
    render(<Choice testID="goal" label="Get stronger" hint="Heavier lifts" selected={false} onPress={() => {}} {...props} />);

  it('off: surface + 1 px 0.08 border, min-height 56, radius 16, padding 10 14; the 24 px ✓ slot is reserved but empty', () => {
    const tree = choice();
    const style = styleOf(tree, 'goal');
    expect(style.minHeight).toBe(56);
    expect(style.borderRadius).toBe(16);
    expect(style.paddingHorizontal).toBe(14);
    expect(style.paddingVertical).toBe(10);
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.choiceBorder);
    expect(style.boxShadow).toBeUndefined();
    const slot = tree.root.find((node) => node.props.testID === 'choice-check-slot' && node.type === 'View');
    expect([flat(slot.props.style).width, flat(slot.props.style).height]).toEqual([24, 24]);
    expect(text(tree, '✓')).toBeUndefined();
  });

  it('selected: gold-tint-weak + the 1.5 px gold ring + the 24 px gold disc with ✓; label 15/600', () => {
    const tree = choice({ selected: true });
    const style = styleOf(tree, 'goal');
    expect(style.backgroundColor).toBe(colors.goldTintWeak);
    expect(style.borderColor).toBe(colors.gold);
    expect(style.boxShadow).toBe(`inset 0px 0px 0px 0.5px ${colors.gold}`);
    const disc = tree.root.find((node) => node.props.testID === 'choice-check' && node.type === 'View');
    expect(flat(disc.props.style).backgroundColor).toBe(colors.gold);
    expect(flat(disc.props.style).width).toBe(24);
    expect(flat(text(tree, '✓').props.style).color).toBe(colors.onGold);
    const label = flat(text(tree, 'Get stronger').props.style);
    expect(label.fontSize).toBe(15);
    expect(label.fontFamily).toBe(font(600).fontFamily);
    expect(flat(text(tree, 'Heavier lifts').props.style).color).toBe(colors.textMuted);
  });

  it('a11y unchanged: radio, "label, hint", {selected, checked, disabled}; press calls onPress', () => {
    const onPress = jest.fn();
    const tree = choice({ selected: true, onPress });
    const node = pressable(tree, 'goal');
    expect(node.props.accessibilityRole).toBe('radio');
    expect(node.props.accessibilityLabel).toBe('Get stronger, Heavier lifts');
    expect(node.props.accessibilityState).toEqual({ selected: true, checked: true, disabled: false });
    act(() => node.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pressed (off): the raised surface; disabled: opacity 0.5 and not pressable', () => {
    expect(styleOf(choice(), 'goal', true).backgroundColor).toBe(colors.surfaceRaised);
    const tree = choice({ disabled: true });
    expect(styleOf(tree, 'goal').opacity).toBe(0.5);
    expect(pressable(tree, 'goal').props.disabled).toBe(true);
  });
});

describe('OptionPill', () => {
  const pill = (props = {}) => render(<OptionPill testID="days" label="4 days" selected={false} onPress={() => {}} {...props} />);

  it('off: glass (0.08 fill + 1 px 0.12 border), 40 tall with a 44 hit area, padding 0 14, text-primary 14/600; ✓ slot reserved (invisible)', () => {
    const tree = pill();
    const style = styleOf(tree, 'days');
    expect(style.minHeight).toBe(40);
    expect(style.paddingHorizontal).toBe(14);
    expect(style.borderRadius).toBe(999);
    expect(style.backgroundColor).toBe(colors.fillButton);
    expect(style.borderColor).toBe(colors.hairlineButton);
    const slop = pressable(tree, 'days').props.hitSlop;
    expect(slop.top + 40 + slop.bottom).toBe(44);
    expect(flat(text(tree, '✓').props.style).opacity).toBe(0);
    const label = flat(text(tree, '4 days').props.style);
    expect(label.color).toBe(colors.textPrimary);
    expect(label.fontFamily).toBe(font(600).fontFamily);
  });

  it('selected: gold + on-gold text and a visible ✓; pressed = gold-deep', () => {
    const tree = pill({ selected: true });
    expect(styleOf(tree, 'days').backgroundColor).toBe(colors.gold);
    expect(styleOf(tree, 'days', true).backgroundColor).toBe(colors.goldDeep);
    expect(flat(text(tree, '✓').props.style).opacity).toBeUndefined();
    expect(flat(text(tree, '✓').props.style).color).toBe(colors.onGold);
    expect(flat(text(tree, '4 days').props.style).color).toBe(colors.onGold);
  });

  it('a11y unchanged: role/label/hint pass through, {selected, disabled}; disabled = 0.5, not pressable', () => {
    const tree = pill({ disabled: true, accessibilityRole: 'togglebutton', accessibilityHint: 'Focus areas', accessibilityLabel: 'Four days' });
    const node = pressable(tree, 'days');
    expect(node.props.accessibilityRole).toBe('togglebutton');
    expect(node.props.accessibilityHint).toBe('Focus areas');
    expect(node.props.accessibilityLabel).toBe('Four days');
    expect(node.props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(node.props.disabled).toBe(true);
    expect(styleOf(tree, 'days').opacity).toBe(0.5);
  });

  it('press calls onPress', () => {
    const onPress = jest.fn();
    const tree = pill({ onPress });
    act(() => pressable(tree, 'days').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Checkbox', () => {
  const box = (tree) => flat(tree.root.find((node) => node.type === 'View' && node.props.accessibilityElementsHidden).props.style);

  it('off: 24 × 24, radius 8, 1.5 px 0.28 border, no mark', () => {
    const tree = render(<Checkbox checked={false} />);
    const style = box(tree);
    expect([style.width, style.height, style.borderRadius]).toEqual([24, 24, 8]);
    expect(style.borderWidth).toBe(1.5);
    expect(style.borderColor).toBe(colors.checkboxBorder);
    expect(style.backgroundColor).toBeUndefined();
    expect(tree.root.findAll((node) => node.props.testID === 'checkbox-mark')).toHaveLength(0);
  });

  it('on: gold fill + the on-gold ✓ (14 px SVG with explicit size); decorative', () => {
    const tree = render(<Checkbox checked />);
    expect(box(tree).backgroundColor).toBe(colors.gold);
    const mark = tree.root.findAll((node) => node.props.testID === 'checkbox-mark')[0];
    expect([mark.props.width, mark.props.height]).toEqual([14, 14]);
    expect(tree.root.find((node) => node.type === 'View' && node.props.accessibilityElementsHidden).props.importantForAccessibility).toBe(
      'no-hide-descendants'
    );
  });
});

describe('Callout', () => {
  const wrap = (tree) => flat(tree.root.find((node) => node.props.testID === 'note' && node.type === 'View').props.style);

  it('info: info fill 0.10 + border 0.25, radius 16, padding 12 14, 13/18 text-strong-2; role passes through', () => {
    const tree = render(
      <Callout tone="info" testID="note" role="note">
        Keep the knees happy.
      </Callout>
    );
    const style = wrap(tree);
    expect(style.backgroundColor).toBe(colors.infoTint);
    expect(style.borderColor).toBe(colors.infoBorder);
    expect(style.borderRadius).toBe(16);
    expect([style.paddingVertical, style.paddingHorizontal]).toEqual([12, 14]);
    const body = flat(text(tree, 'Keep the knees happy.').props.style);
    expect([body.fontSize, body.lineHeight, body.color]).toEqual([13, 18, colors.textStrong2]);
    expect(tree.root.find((node) => node.props.testID === 'note' && node.type === 'View').props.role).toBe('note');
  });

  it('warning: warning fill 0.08 + border 0.28', () => {
    const tree = render(
      <Callout tone="warning" testID="note">
        Locked.
      </Callout>
    );
    expect(wrap(tree).backgroundColor).toBe(colors.warningFill);
    expect(wrap(tree).borderColor).toBe(colors.warningBorder);
  });
});

describe('WhyLine', () => {
  it('reads as one sentence; 13/18 text-secondary with "Why this:" 600 in gold', () => {
    const tree = render(<WhyLine text="a heavy press to start." />);
    const row = tree.root.find((node) => node.type === 'View' && node.props.accessible);
    expect(row.props.accessibilityLabel).toBe('Why this: a heavy press to start.');
    const label = flat(text(tree, 'Why this: ').props.style);
    expect(label.color).toBe(colors.gold);
    expect(label.fontFamily).toBe(font(600).fontFamily);
    const body = flat(text(tree, 'Why this: ').parent.parent.props.style);
    expect([body.fontSize, body.lineHeight, body.color]).toEqual([13, 18, colors.textSecondary]);
  });
});
