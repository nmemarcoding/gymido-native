import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import GradientFill from '../../../shared/components/GradientFill';
import { colors, font, gradients, muscle, radii, textScale } from '../../../shared/theme/tokens';
import { Callout, Checkbox, Choice, MuscleLabel, OptionPill, PillRow, ProgressSegments, WhyLine, ChoiceList } from './GeneratorControls';

// Generator controls (RN-SPEC-PLAN-GENERATOR §G1.2 behaviour, unchanged) in
// the v2 look: RN-SPEC-v2-foundation §4.4 / §4.6 / §5 and the
// "GeneratorControls" board.

const flat = (style) => StyleSheet.flatten(style) ?? {};
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.children === 'function')[0];
// v2 J: the Choice's style is a function of `pressed`; read its rest state
// (or a given pressed state).
const styleOf = (tree, id, pressed = false) => {
  const style = pressable(tree, id).props.style;
  return flat(typeof style === 'function' ? style({ pressed }) : style);
};
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

describe('Choice (card radio), v2 Phase 4 J', () => {
  const choice = (props = {}) =>
    render(<Choice testID="goal" label="Get stronger" hint="Heavier lifts" selected={false} onPress={() => {}} {...props} />);

  it('off (plain): gradient-card + 1 px 0.08 edge, min-height 72, radius-2xl, padding 0 18; the 30 px ✓ slot is reserved but empty', () => {
    const tree = choice();
    const style = styleOf(tree, 'goal');
    expect(style).toMatchObject({ minHeight: 72, borderRadius: radii.xxl, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.choiceBorder, overflow: 'hidden' });
    expect(style.boxShadow).toBeUndefined();
    const slot = tree.root.find((node) => node.props.testID === 'choice-check-slot' && node.type === 'View');
    expect(flat(slot.props.style)).toMatchObject({ width: 30, height: 30, borderWidth: 1.5, borderColor: colors.hairlineBright });
    expect(tree.root.findAll((node) => node.props.testID === 'icon-check')).toHaveLength(0);
    const label = flat(text(tree, 'Get stronger').props.style);
    expect([label.fontSize, label.lineHeight, label.fontFamily]).toEqual([18, 22, font(700).fontFamily]);
  });

  it('with an icon tile (step 1): min-height 88, label 20/24/700, a 52 tile (radius 16) on fill-glass; teal tone on teal-tint', () => {
    const tree = choice({ renderIcon: ({ color }) => <Text testID="glyph">{color}</Text> });
    expect(styleOf(tree, 'goal').minHeight).toBe(88);
    expect(flat(text(tree, 'Get stronger').props.style)).toMatchObject({ fontSize: 20, lineHeight: 24 });
    const tile = tree.root.find((node) => node.props.testID === 'choice-icon-tile' && node.type === 'View');
    expect(flat(tile.props.style)).toMatchObject({ width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.fillGlass });
    expect(tile.props.accessibilityElementsHidden).toBe(true);
    expect(text(tree, colors.textStrong2)).toBeDefined();
    const teal = choice({ renderIcon: ({ color }) => <Text>{color}</Text>, iconTone: 'teal' });
    expect(flat(teal.root.find((node) => node.props.testID === 'choice-icon-tile' && node.type === 'View').props.style).backgroundColor).toBe(colors.tealTint);
    expect(text(teal, colors.teal)).toBeDefined();
    const on = choice({ selected: true, renderIcon: ({ color }) => <Text>{color}</Text> });
    expect(flat(on.root.find((node) => node.props.testID === 'choice-icon-tile' && node.type === 'View').props.style).backgroundColor).toBe(colors.gold);
    expect(text(on, colors.onGold)).toBeDefined();
  });

  it('selected: gradient-gold-select + the 2 px gold ring (no glow) + the 30 px gold disc with ✓', () => {
    const tree = choice({ selected: true });
    const style = styleOf(tree, 'goal');
    expect(style.borderColor).toBe(colors.gold);
    expect(style.boxShadow).toBe(`inset 0px 0px 0px 1px ${colors.gold}`);
    const fill = contentOf(tree, 'goal', false).root.findByType(GradientFill);
    expect(fill.props).toMatchObject({ angle: gradients.goldSelect.angle, colors: gradients.goldSelect.colors });
    const disc = tree.root.find((node) => node.props.testID === 'choice-check' && node.type === 'View');
    expect(flat(disc.props.style)).toMatchObject({ backgroundColor: colors.gold, width: 30 });
    expect(disc.findAll((node) => node.props.testID === 'icon-check').length).toBeGreaterThan(0);
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

  it('pressed: the white 4 % overlay + scale 0.98; selected pressed turns the ring gold-deep', () => {
    const rest = choice();
    expect(overlayOf(contentOf(rest, 'goal', false))).toBeUndefined();
    expect(flat(overlayOf(contentOf(rest, 'goal', true)).props.style)).toMatchObject({ backgroundColor: colors.pressOverlay, position: 'absolute' });
    expect(styleOf(rest, 'goal', true).transform).toEqual([{ scale: 0.98 }]);
    expect(styleOf(rest, 'goal', false).transform).toBeUndefined();
    const on = choice({ selected: true });
    expect(styleOf(on, 'goal', true).borderColor).toBe(colors.goldDeep);
  });

  it('disabled (a preset with enabled:false): dashed 0.12 edge, no fill, muted label + hint 12/500, opacity 0.5, not pressable, ✓ slot kept', () => {
    const tree = choice({ disabled: true, hint: 'Not available yet' });
    const style = styleOf(tree, 'goal');
    expect(style).toMatchObject({ borderStyle: 'dashed', borderColor: colors.hairlineButton, backgroundColor: 'transparent', opacity: 0.5 });
    expect(pressable(tree, 'goal').props.disabled).toBe(true);
    expect(contentOf(tree, 'goal', false).root.findAllByType(GradientFill)).toHaveLength(0);
    expect(flat(text(tree, 'Get stronger').props.style).color).toBe(colors.textMuted);
    expect(flat(text(tree, 'Not available yet').props.style)).toMatchObject({ fontSize: 12, fontFamily: font(500).fontFamily });
    expect(tree.root.findAll((node) => node.props.testID === 'choice-check-slot' && node.type === 'View')).toHaveLength(1);
  });

  it('ChoiceList with a label is a named radio group (dated change 27 Oct)', () => {
    const tree = render(
      <ChoiceList label="Main goal" testID="goals">
        <Text>x</Text>
      </ChoiceList>
    );
    const group = tree.root.find((node) => node.props.testID === 'goals' && node.type === 'View');
    expect(group.props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Main goal' });
    expect(flat(group.props.style).gap).toBe(10);
  });
});

describe('OptionPill', () => {
  const pill = (props = {}) => render(<OptionPill testID="days" label="4 days" selected={false} onPress={() => {}} {...props} />);
  const checkSlot = (tree, on) => tree.root.find((node) => node.props.testID === (on ? 'pill-check' : 'pill-check-slot') && node.type === 'View');

  it('default: glass (0.08 fill + 1 px 0.12 border), 40 tall with a 44 hit area, padding 0 14, text-primary 14/600; ✓ slot reserved (invisible)', () => {
    const tree = pill();
    const style = styleOf(tree, 'days');
    expect(style.minHeight).toBe(40);
    expect(style.paddingHorizontal).toBe(14);
    expect(style.borderRadius).toBe(999);
    expect(style.backgroundColor).toBe(colors.fillButton);
    expect(style.borderColor).toBe(colors.hairlineButton);
    const slop = pressable(tree, 'days').props.hitSlop;
    expect(slop.top + 40 + slop.bottom).toBe(44);
    expect(flat(checkSlot(tree, false).props.style).opacity).toBe(0);
    const label = flat(text(tree, '4 days').props.style);
    expect(label.color).toBe(colors.textPrimary);
    expect(label.fontFamily).toBe(font(600).fontFamily);
  });

  it('selected: flat gold (no shadow) + on-gold text and a visible ✓; pressed = the ink 4 % overlay', () => {
    const tree = pill({ selected: true });
    expect(styleOf(tree, 'days').backgroundColor).toBe(colors.gold);
    expect(styleOf(tree, 'days').boxShadow).toBeUndefined();
    expect(flat(overlayOf(contentOf(tree, 'days', true)).props.style).backgroundColor).toBe(colors.pressOverlayInk);
    expect(flat(checkSlot(tree, true).props.style).opacity).toBeUndefined();
    expect(flat(text(tree, '4 days').props.style).color).toBe(colors.onGold);
  });

  it('large (steps 3–4): 52 tall, min-width 96, padding 0 20, 16/600; as a radio it carries checked', () => {
    const tree = pill({ size: 'large', accessibilityRole: 'radio', selected: true });
    expect(styleOf(tree, 'days')).toMatchObject({ minHeight: 52, minWidth: 96, paddingHorizontal: 20 });
    expect(flat(text(tree, '4 days').props.style)).toMatchObject({ fontSize: 16 });
    expect(pressable(tree, 'days').props.accessibilityState).toEqual({ selected: true, checked: true, disabled: false });
    expect(pressable(tree, 'days').props.hitSlop.top).toBe(0);
  });

  it('focus (phone 46) / focusTablet (44): off = surface + 0.12 edge + text-strong-2 500; on = gold + on-gold 700', () => {
    const phone = pill({ size: 'focus' });
    expect(styleOf(phone, 'days')).toMatchObject({ minHeight: 46, paddingHorizontal: 18, backgroundColor: colors.surface, borderColor: colors.hairlineButton });
    expect(flat(text(phone, '4 days').props.style)).toMatchObject({ fontSize: 14, color: colors.textStrong2, fontFamily: font(500).fontFamily });
    const on = pill({ size: 'focus', selected: true });
    expect(styleOf(on, 'days').backgroundColor).toBe(colors.gold);
    expect(flat(text(on, '4 days').props.style)).toMatchObject({ color: colors.onGold, fontFamily: font(700).fontFamily });
    const tablet = pill({ size: 'focusTablet' });
    expect(styleOf(tablet, 'days').minHeight).toBe(44);
    expect(flat(text(tablet, '4 days').props.style).fontSize).toBe(15);
  });

  it('reason (38, 44 hit): on = the light fill + on-light 600; off = transparent + hairline-strong + text-strong-2', () => {
    const off = pill({ size: 'reason' });
    expect(styleOf(off, 'days')).toMatchObject({ minHeight: 38, paddingHorizontal: 14, backgroundColor: 'transparent', borderColor: colors.hairlineStrong });
    expect(pressable(off, 'days').props.hitSlop.top).toBe(3);
    const on = pill({ size: 'reason', selected: true });
    expect(styleOf(on, 'days').backgroundColor).toBe(colors.textPrimary);
    expect(flat(text(on, '4 days').props.style)).toMatchObject({ color: colors.onLight, fontFamily: font(600).fontFamily });
    expect(flat(overlayOf(contentOf(on, 'days', true)).props.style).backgroundColor).toBe(colors.pressOverlayInk);
  });

  it('a11y unchanged: role/label/hint pass through, {selected, disabled}; disabled = 0.5, not pressable, no overlay', () => {
    const tree = pill({ disabled: true, accessibilityRole: 'togglebutton', accessibilityHint: 'Focus areas', accessibilityLabel: 'Four days' });
    const node = pressable(tree, 'days');
    expect(node.props.accessibilityRole).toBe('togglebutton');
    expect(node.props.accessibilityHint).toBe('Focus areas');
    expect(node.props.accessibilityLabel).toBe('Four days');
    expect(node.props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(node.props.disabled).toBe(true);
    expect(styleOf(tree, 'days').opacity).toBe(0.5);
    expect(overlayOf(contentOf(tree, 'days', true))).toBeUndefined();
  });

  it('press calls onPress', () => {
    const onPress = jest.fn();
    const tree = pill({ onPress });
    act(() => pressable(tree, 'days').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('PillRow with a label is a named radio group; gap passes through', () => {
    const tree = render(
      <PillRow label="Days a week" gap={10} testID="row">
        <Text>x</Text>
      </PillRow>
    );
    const row = tree.root.find((node) => node.props.testID === 'row' && node.type === 'View');
    expect(row.props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Days a week' });
    expect(flat(row.props.style)).toMatchObject({ gap: 10, flexWrap: 'wrap' });
  });
});

describe('ProgressSegments and MuscleLabel (v2 J)', () => {
  it('6 segments, done/current gold, the rest hairline-button; phone 4 tall gap 5, tablet 5 tall gap 6; read once as "Step n of 6"', () => {
    const phone = render(<ProgressSegments step={2} total={6} label="Step 2 of 6" />);
    const bar = phone.root.find((node) => node.props.testID === 'generator-progress' && node.type === 'View');
    expect(bar.props).toMatchObject({ accessible: true, accessibilityLabel: 'Step 2 of 6', accessibilityValue: { min: 0, max: 6, now: 2 } });
    expect(flat(bar.props.style).gap).toBe(5);
    const on = phone.root.findAll((node) => node.props.testID === 'progress-segment-on' && node.type === 'View');
    const off = phone.root.findAll((node) => node.props.testID === 'progress-segment-off' && node.type === 'View');
    expect([on.length, off.length]).toEqual([2, 4]);
    expect(flat(on[0].props.style)).toMatchObject({ height: 4, flex: 1, backgroundColor: colors.gold });
    expect(flat(off[0].props.style).backgroundColor).toBe(colors.hairlineButton);
    const tablet = render(<ProgressSegments step={6} total={6} tablet label="Step 6 of 6" />);
    expect(flat(tablet.root.find((node) => node.props.testID === 'generator-progress' && node.type === 'View').props.style).gap).toBe(6);
    const all = tablet.root.findAll((node) => node.props.testID === 'progress-segment-on' && node.type === 'View');
    expect(all).toHaveLength(6);
    expect(flat(all[0].props.style).height).toBe(5);
  });

  it('MuscleLabel: text-muted 12 with a 6 px muscle-colour dot first; unknown muscle → a muted dot; no name → nothing', () => {
    const tree = render(<MuscleLabel name="Chest" code="CHEST" />);
    const dot = tree.root.find((node) => node.props.testID === 'muscle-dot' && node.type === 'View');
    expect(flat(dot.props.style)).toMatchObject({ width: 6, height: 6, backgroundColor: muscle.chest });
    expect(flat(text(tree, 'Chest').props.style)).toMatchObject({ color: colors.textMuted, fontSize: 12 });
    const unknown = render(<MuscleLabel name="Other" code="SOMETHING" />);
    expect(flat(unknown.root.find((node) => node.props.testID === 'muscle-dot' && node.type === 'View').props.style).backgroundColor).toBe(colors.textMuted);
    expect(render(<MuscleLabel name="" code="CHEST" />).toJSON()).toBeNull();
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

  it('info (Look 4): info-faint fill + info-line edge, radius 16, padding 12 14, the info icon, 13/19 text-primary; role passes through', () => {
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
    expect([body.fontSize, body.lineHeight, body.color]).toEqual([13, 19, colors.textPrimary]);
    expect(tree.root.find((node) => node.props.testID === 'note' && node.type === 'View').props.role).toBe('note');
    const icon = tree.root.find((node) => node.type === FeedbackIcon);
    expect(icon.props).toMatchObject({ name: 'info', color: colors.info });
    expect(style.flexDirection).toBe('row');
  });

  it('warning: warning tint 0.14 + line 0.30 + the "!" icon (never colour alone)', () => {
    const tree = render(
      <Callout tone="warning" testID="note">
        Locked.
      </Callout>
    );
    expect(wrap(tree).backgroundColor).toBe(colors.warningTint);
    expect(wrap(tree).borderColor).toBe(colors.warningLine);
    expect(tree.root.find((node) => node.type === FeedbackIcon).props).toMatchObject({ name: 'warning', color: colors.warning });
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
  it('Choice off: gradient-card layer from the first render; selected swaps the same layer to gradient-gold-select', () => {
    const off = render(<Choice testID="goal" label="Get stronger" selected={false} onPress={() => {}} />);
    const fill = contentOf(off, 'goal', false).root.findByType(GradientFill);
    expect(fill.props).toMatchObject({ angle: gradients.card.angle, colors: gradients.card.colors });
    const on = render(<Choice testID="goal" label="Get stronger" selected onPress={() => {}} />);
    expect(contentOf(on, 'goal', false).root.findByType(GradientFill).props.colors).toEqual(gradients.goldSelect.colors);
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

  it('the choice ✓ is an SVG (fixed 30 geometry, no text to scale)', () => {
    const tree = render(<Choice testID="goal" label="A" selected onPress={() => {}} />);
    const disc = tree.root.find((node) => node.props.testID === 'choice-check' && node.type === 'View');
    expect(disc.findAllByType(Text)).toHaveLength(0);
  });
});
