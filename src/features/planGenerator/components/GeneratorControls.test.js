import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import GradientFill from '../../../shared/components/GradientFill';
import { colors, font, gradients, textScale } from '../../../shared/theme/tokens';
import { Callout, Checkbox, Choice, OptionPill, WhyLine } from './GeneratorControls';

// Generator controls (RN-SPEC-PLAN-GENERATOR §G1.2 behaviour, unchanged) in
// the v2 look: RN-SPEC-v2-foundation §4.4 / §4.6 / §5 and the
// "GeneratorControls" board.

const flat = (style) => StyleSheet.flatten(style) ?? {};
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.children === 'function')[0];
const styleOf = (tree, id) => flat(pressable(tree, id).props.style);
// The Pressable's content in a given pressed state (its children function).
const contentOf = (tree, id, pressed) => {
  let inner;
  act(() => {
    inner = create(<>{pressable(tree, id).props.children({ pressed })}</>);
  });
  return inner;
};
const overlayOf = (inner) => inner.root.findAll((node) => node.props?.testID === 'press-overlay' && node.type === 'View')[0];
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

  it('pressed (off): the rest fill + the white 4 % overlay (§8.6 state rule); disabled: opacity 0.5 and not pressable', () => {
    const rest = choice();
    expect(overlayOf(contentOf(rest, 'goal', false))).toBeUndefined();
    const overlay = overlayOf(contentOf(rest, 'goal', true));
    expect(flat(overlay.props.style)).toMatchObject({ backgroundColor: colors.pressOverlay, position: 'absolute' });
    expect(styleOf(rest, 'goal').backgroundColor).toBe(colors.surface);
    expect(overlayOf(contentOf(choice({ selected: true }), 'goal', true))).toBeUndefined();
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
    // §8.6 state rule: pressed gold = gold + the ink 4 % overlay (was gold-deep).
    expect(flat(overlayOf(contentOf(tree, 'days', true)).props.style).backgroundColor).toBe(colors.pressOverlayInk);
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
    expect(style.backgroundColor).toBe(colors.infoFaint);
    expect(style.borderColor).toBe(colors.infoLine);
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
    expect(wrap(tree).backgroundColor).toBe(colors.warningFaint);
    expect(wrap(tree).borderColor).toBe(colors.warningLine);
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

describe('Phase 2 tokens: board colours on the §8.5 ladder', () => {
  it('Choice off: gradient-card layer from the first render; selected swaps the same layer to gold-faint', () => {
    const off = render(<Choice testID="goal" label="Get stronger" selected={false} onPress={() => {}} />);
    const inner = contentOf(off, 'goal', false);
    const fill = inner.root.findByType(GradientFill);
    expect(fill.props).toMatchObject({ angle: gradients.card.angle, colors: gradients.card.colors });
    const on = render(<Choice testID="goal" label="Get stronger" selected onPress={() => {}} />);
    expect(contentOf(on, 'goal', false).root.findByType(GradientFill).props.colors).toEqual([colors.goldFaint, colors.goldFaint]);
    expect(styleOf(on, 'goal').backgroundColor).toBe('rgba(255, 194, 26, 0.08)');
    expect(styleOf(off, 'goal').overflow).toBe('hidden');
  });

  it('Choice off ring: 1.5 px hairline-bright; on: gold', () => {
    const off = render(<Choice testID="goal" label="A" selected={false} onPress={() => {}} />);
    const slot = off.root.find((node) => node.props.testID === 'choice-check-slot' && node.type === 'View');
    expect(flat(slot.props.style)).toMatchObject({ borderWidth: 1.5, borderColor: colors.hairlineBright });
    const on = render(<Choice testID="goal" label="A" selected onPress={() => {}} />);
    const disc = on.root.find((node) => node.props.testID === 'choice-check' && node.type === 'View');
    expect(flat(disc.props.style).borderColor).toBe(colors.gold);
  });

  it('OptionPill rest pressed: white 4 % overlay over the glass', () => {
    const tree = render(<OptionPill testID="days" label="4 days" selected={false} onPress={() => {}} />);
    expect(flat(overlayOf(contentOf(tree, 'days', true)).props.style).backgroundColor).toBe(colors.pressOverlay);
    expect(overlayOf(contentOf(tree, 'days', false))).toBeUndefined();
    expect(styleOf(tree, 'days').backgroundColor).toBe(colors.fillButton);
  });

  it('teal callout: teal-faint fill, teal-line edge, teal-text copy', () => {
    const tree = render(
      <Callout tone="teal" testID="note">
        Add a day.
      </Callout>
    );
    const style = flat(tree.root.find((node) => node.props.testID === 'note' && node.type === 'View').props.style);
    expect(style).toMatchObject({ backgroundColor: 'rgba(79, 216, 196, 0.08)', borderColor: 'rgba(79, 216, 196, 0.30)' });
    expect(flat(text(tree, 'Add a day.').props.style).color).toBe('#7FE6D6');
  });
});

describe('UX §9 large text', () => {
  it('every label scales to 2× and is never truncated (no numberOfLines)', () => {
    const trees = [
      render(<Choice testID="goal" label="Get stronger" hint="Heavier lifts" selected onPress={() => {}} />),
      render(<OptionPill testID="days" label="4 days" selected onPress={() => {}} />),
    ];
    trees.forEach((tree, index) => {
      const inner = contentOf(tree, index === 0 ? 'goal' : 'days', false);
      const labels = inner.root.findAllByType(Text).filter((node) => node.props.children !== '✓');
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach((node) => {
        expect(node.props.maxFontSizeMultiplier).toBe(textScale.body);
        expect(node.props.numberOfLines).toBeUndefined();
      });
    });
    const callout = render(<Callout testID="note">Note.</Callout>);
    expect(text(callout, 'Note.').props.maxFontSizeMultiplier).toBe(textScale.body);
    const why = render(<WhyLine text="because." />);
    expect(text(why, 'Why this: ').parent.parent.props.maxFontSizeMultiplier).toBe(textScale.body);
  });

  it('pills grow with a wrapped label: min-height 40 (no fixed height), the label shrinks to wrap', () => {
    const tree = render(<OptionPill testID="days" label="A very long option label" selected={false} onPress={() => {}} />);
    const style = styleOf(tree, 'days');
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBe(40);
    const label = contentOf(tree, 'days', false).root.findAllByType(Text).find((node) => node.props.children === 'A very long option label');
    expect(flat(label.props.style).flexShrink).toBe(1);
  });

  it('the choice check disc caps at 1.2 (fixed 24 geometry)', () => {
    const tree = render(<Choice testID="goal" label="A" selected onPress={() => {}} />);
    expect(text(tree, '✓').props.maxFontSizeMultiplier).toBe(textScale.badge);
  });
});
