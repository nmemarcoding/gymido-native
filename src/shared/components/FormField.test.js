import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font, layout, radii, textScale } from '../theme/tokens';
import FormField, { FIELD_HEIGHT, FIELD_VARIANTS, UNIT_GUTTER_FALLBACK, fieldBoxStyle, unitGutter } from './FormField';

// RN-SPEC-v2-foundation §4.5 text fields (look only; behaviour is v1's).

const flat = (style) => StyleSheet.flatten(style) ?? {};
const host = (tree, testID) => tree.root.find((node) => node.props.testID === testID && typeof node.type === 'string');
const input = (tree) => tree.root.find((node) => node.props.testID === 'field' && node.type === 'TextInput');
// The bordered wrapper is the nearest host View above the TextInput.
function box(tree) {
  let node = input(tree).parent;
  while (node && node.type !== 'View') node = node.parent;
  return flat(node.props.style);
}

function render(props = {}) {
  let tree;
  act(() => {
    tree = create(<FormField testID="field" label="Current weight" value="" onChangeText={() => {}} {...props} />);
  });
  return tree;
}

describe('FormField (v2 §4.5)', () => {
  it('default: one size 52 / radius 20, surface fill, 1 px hairline-strong, 16 px text, faint placeholder', () => {
    const tree = render({ placeholder: 'e.g. 82' });
    const b = box(tree);
    expect(FIELD_HEIGHT).toBe(52);
    expect(b.minHeight).toBe(52);
    expect(b.borderRadius).toBe(radii.lg);
    expect(b.borderRadius).toBe(20);
    expect(b.borderWidth).toBe(1);
    expect(b.borderColor).toBe(colors.hairlineStrong);
    expect(b.backgroundColor).toBe(colors.surface);
    expect(b.outlineWidth).toBeUndefined();
    const text = flat(input(tree).props.style);
    expect(text.fontSize).toBe(16);
    expect(text.fontFamily).toBe(font(400).fontFamily);
    expect(text.fontWeight).toBeUndefined();
    expect(text.color).toBe(colors.textPrimary);
    expect(text.minHeight).toBe(50);
    expect(text.height).toBeUndefined();
    expect(text.paddingHorizontal).toBe(16);
    expect(input(tree).props.placeholderTextColor).toBe(colors.textFaint);
  });

  it('label: 13/500 text-secondary, 8 above the field; a caller labelStyle still wins', () => {
    const tree = render();
    const label = tree.root.findAll((node) => node.type === Text && node.props.children === 'Current weight')[0];
    const style = flat(label.props.style);
    expect(style.fontSize).toBe(13);
    expect(style.fontFamily).toBe(font(500).fontFamily);
    expect(style.color).toBe(colors.textSecondary);
    expect(style.marginBottom).toBe(8);

    const custom = render({ labelStyle: { fontSize: 14 } });
    const customLabel = custom.root.findAll((node) => node.type === Text && node.props.children === 'Current weight')[0];
    expect(flat(customLabel.props.style).fontSize).toBe(14);
  });

  it('OptionalLabel: " (optional)" draws in text-faint 400; the accessible label is unchanged', () => {
    const tree = render({ label: 'Message (optional)' });
    const optional = tree.root.findAll((node) => node.type === Text && node.props.children === ' (optional)')[0];
    expect(flat(optional.props.style).color).toBe(colors.textFaint);
    expect(flat(optional.props.style).fontFamily).toBe(font(400).fontFamily);
    expect(input(tree).props.accessibilityLabel).toBe('Message (optional)');
  });

  it('focus: 1 px gold border + 4 px gold 18 % ring, text 500; blur restores; the caller handlers still run', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const tree = render({ onFocus, onBlur });
    act(() => input(tree).props.onFocus({}));
    let b = box(tree);
    expect(b.borderColor).toBe(colors.gold);
    expect(b.borderWidth).toBe(1);
    expect(b.outlineWidth).toBe(4);
    expect(b.outlineColor).toBe(colors.goldFocus);
    expect(flat(input(tree).props.style).fontFamily).toBe(font(500).fontFamily);
    expect(onFocus).toHaveBeenCalledTimes(1);

    act(() => input(tree).props.onBlur({}));
    b = box(tree);
    expect(b.borderColor).toBe(colors.hairlineStrong);
    expect(b.outlineWidth).toBeUndefined();
    expect(flat(input(tree).props.style).fontFamily).toBe(font(400).fontFamily);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('error: danger-text border; 13 px danger-text message announced (alert + polite live region); the input is described by it', () => {
    const tree = render({ error: 'First name is required' });
    expect(box(tree).borderColor).toBe(colors.dangerText);
    const message = tree.root.findAll((node) => node.type === Text && node.props.children === 'First name is required')[0];
    expect(message.props.accessibilityRole).toBe('alert');
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    const style = flat(message.props.style);
    expect(style.fontSize).toBe(13);
    expect(style.color).toBe(colors.dangerText);
    expect(input(tree).props.accessibilityHint).toBe('First name is required');
  });

  it('error + focus: the border stays danger-text with the danger ring', () => {
    const tree = render({ error: 'Required' });
    act(() => input(tree).props.onFocus({}));
    const b = box(tree);
    expect(b.borderColor).toBe(colors.dangerText);
    expect(b.outlineWidth).toBe(4);
    expect(b.outlineColor).toBe(colors.dangerFocus);
  });

  it('no error: no message and no hint', () => {
    const tree = render();
    expect(input(tree).props.accessibilityHint).toBeUndefined();
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'alert')).toHaveLength(0);
  });

  it('helper: 12 px text-muted below the field', () => {
    const tree = render({ helperText: 'Commas work: 82,5 = 82.5' });
    const helper = tree.root.findAll((node) => node.type === Text && node.props.children === 'Commas work: 82,5 = 82.5')[0];
    expect(flat(helper.props.style).fontSize).toBe(12);
    expect(flat(helper.props.style).color).toBe(colors.textMuted);
  });

  it('disabled: opacity 0.5 and not editable', () => {
    const tree = render({ editable: false });
    expect(box(tree).opacity).toBe(0.5);
    expect(input(tree).props.editable).toBe(false);
  });

  it('unit suffix: 15 px text-faint at right 16, field right padding 48, hidden from screen readers', () => {
    const tree = render({ unit: 'kg' });
    const suffix = host(tree, 'field-unit');
    expect(flat(suffix.props.style).right).toBe(16);
    expect(suffix.props.accessibilityElementsHidden).toBe(true);
    expect(suffix.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(suffix.props.pointerEvents).toBe('none');
    const text = tree.root.findAll((node) => node.type === Text && node.props.children === 'kg')[0];
    expect(flat(text.props.style).fontSize).toBe(15);
    expect(flat(text.props.style).color).toBe(colors.textFaint);
    expect(flat(input(tree).props.style).paddingRight).toBe(48);
  });

  it('no unit: no suffix and the default right padding', () => {
    const tree = render();
    expect(tree.root.findAll((node) => node.props.testID === 'field-unit')).toHaveLength(0);
    expect(flat(input(tree).props.style).paddingRight).toBeUndefined();
  });

  it('comma decimals still accepted: the raw text reaches the caller unchanged (the caller parses it)', () => {
    const onChangeText = jest.fn();
    const tree = render({ onChangeText, keyboardType: 'decimal-pad', unit: 'kg' });
    act(() => input(tree).props.onChangeText('82,5'));
    expect(onChangeText).toHaveBeenCalledWith('82,5');
    expect(input(tree).props.keyboardType).toBe('decimal-pad');
  });

  it('textarea: padding 14 16, 16/24, top aligned; height from rows', () => {
    const tree = render({ multiline: true, rows: 5 });
    const style = flat(input(tree).props.style);
    expect(style.paddingVertical).toBe(14);
    expect(style.paddingHorizontal).toBe(16);
    expect(style.lineHeight).toBe(24);
    expect(style.minHeight).toBe(5 * 24 + 28);
    expect(style.height).toBeUndefined();
    expect(input(tree).props.textAlignVertical).toBe('top');
  });

  it('fieldBoxStyle carries no height, so a sized Select/DateInput box keeps its own', () => {
    expect(flat(fieldBoxStyle({ focused: false, error: false, disabled: false })).minHeight).toBeUndefined();
  });
});

describe('FormField caret (UX Phase 1 review)', () => {
  it('draws a gold caret and selection, never the platform blue', () => {
    expect(input(render()).props).toMatchObject({ selectionColor: '#FFC21A', cursorColor: '#FFC21A' });
  });
});

describe('FormField unit suffix gutter (UX §8.7 U13)', () => {
  const unitText = (tree) => tree.root.findAll((node) => node.type === Text && node.props.children === 'kg')[0];
  const layoutUnit = (tree, width) =>
    act(() => {
      host(tree, 'field-unit').props.onLayout({ nativeEvent: { layout: { width, height: 20, x: 0, y: 0 } } });
    });

  it('before the suffix is measured: the 1× gutter (48)', () => {
    expect(UNIT_GUTTER_FALLBACK).toBe(48);
    expect(flat(input(render({ unit: 'kg' })).props.style).paddingRight).toBe(48);
  });

  it.each([
    // [text scale, the suffix width the text measures at that scale]
    [1, 17],
    [2, 34],
    // AX5 (3.1): the suffix stops growing at its 1.6 cap (17 × 1.6 ≈ 27.2).
    [3.1, 27.2],
  ])('at fontScale %f the gutter = inset 16 + measured width + gap 16', (_scale, width) => {
    const tree = render({ unit: 'kg' });
    layoutUnit(tree, width);
    expect(flat(input(tree).props.style).paddingRight).toBe(16 + Math.ceil(width) + layout.suffixGap);
    expect(layout.suffixGap).toBe(16);
  });

  it('grows with the suffix: a wider suffix never touches the typed text', () => {
    const tree = render({ unit: 'kg' });
    layoutUnit(tree, 17);
    const small = flat(input(tree).props.style).paddingRight;
    layoutUnit(tree, 40);
    const large = flat(input(tree).props.style).paddingRight;
    expect(large - small).toBe(23);
    // The suffix's left edge (inset + width) sits a full gap from the text.
    expect(large - (16 + 40)).toBe(16);
  });

  it('the suffix text caps at 1.6× (textScale.suffix), never the 2.0 body cap', () => {
    const tree = render({ unit: 'kg' });
    expect(textScale.suffix).toBe(1.6);
    expect(unitText(tree).props.maxFontSizeMultiplier).toBe(1.6);
  });

  it('unitGutter: zero/unknown widths fall back to 48', () => {
    expect(unitGutter(0)).toBe(48);
    expect(unitGutter(undefined)).toBe(48);
    expect(unitGutter(20)).toBe(52);
  });

  it('re-measuring the same width keeps the gutter (no extra render loop)', () => {
    const tree = render({ unit: 'kg' });
    layoutUnit(tree, 20);
    layoutUnit(tree, 20);
    expect(flat(input(tree).props.style).paddingRight).toBe(52);
  });
});

describe('FormField variants (kit 2: well, MyPlanCreate pill / raised)', () => {
  it('lists the four variants', () => {
    expect(FIELD_VARIANTS).toEqual(['default', 'well', 'pill', 'raised']);
  });

  it('default is unchanged: surface, radius 20, hairline-strong', () => {
    expect(box(render({ variant: 'default' }))).toMatchObject({ backgroundColor: colors.surface, borderRadius: radii.lg, borderColor: colors.hairlineStrong });
  });

  it('well (TabletCreateProfile): surfaceWell, radius 16, hairline-strong edge, 52 tall', () => {
    expect(box(render({ variant: 'well' }))).toMatchObject({ backgroundColor: colors.surfaceWell, borderRadius: radii.md, borderColor: colors.hairlineStrong, minHeight: FIELD_HEIGHT });
  });

  it('pill (MyPlanCreate phone): fill-subtle 0.04, pill radius, input padded 18', () => {
    const tree = render({ variant: 'pill' });
    expect(box(tree)).toMatchObject({ backgroundColor: colors.fillWell, borderRadius: radii.full });
    expect(colors.fillWell).toBe('rgba(255, 255, 255, 0.04)');
    expect(flat(input(tree).props.style).paddingHorizontal).toBe(18);
  });

  it('pill textarea keeps radius 16 and the textarea padding', () => {
    const tree = render({ variant: 'pill', multiline: true });
    expect(box(tree).borderRadius).toBe(radii.md);
    expect(flat(input(tree).props.style).paddingHorizontal).toBe(16);
  });

  it('raised (MyPlanCreate tablet): surfaceRaised, radius 16, the 0.12 edge', () => {
    expect(box(render({ variant: 'raised' }))).toMatchObject({ backgroundColor: colors.surfaceRaised, borderRadius: radii.md, borderColor: colors.hairlineButton });
    expect(colors.hairlineButton).toBe('rgba(255, 255, 255, 0.12)');
  });

  it.each(['well', 'pill', 'raised'])('%s focus: gold edge + the 0.18 gold ring', (variant) => {
    const tree = render({ variant });
    act(() => input(tree).props.onFocus({}));
    expect(box(tree)).toMatchObject({ borderColor: colors.gold, outlineWidth: 4, outlineColor: colors.goldFocus });
    expect(colors.goldFocus).toBe('rgba(255, 194, 26, 0.18)');
  });

  it.each(['well', 'pill', 'raised'])('%s error: the danger-text edge', (variant) => {
    expect(box(render({ variant, error: 'Required' })).borderColor).toBe(colors.dangerText);
  });

  it.each(['well', 'pill', 'raised'])('%s disabled: opacity 0.5', (variant) => {
    expect(box(render({ variant, editable: false })).opacity).toBe(0.5);
  });

  it('an unknown variant draws the default box', () => {
    expect(box(render({ variant: 'nope' }))).toMatchObject({ backgroundColor: colors.surface, borderRadius: radii.lg });
  });

  it('fieldBoxStyle takes the variant (Select / DateInput share it)', () => {
    expect(flat(fieldBoxStyle({ variant: 'well' }))).toMatchObject({ backgroundColor: colors.surfaceWell });
    expect(flat(fieldBoxStyle({}))).toMatchObject({ backgroundColor: colors.surface });
  });
});
