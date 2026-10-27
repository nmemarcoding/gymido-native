jest.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, font, motion, radii, shadows } from '../theme/tokens';
import PillButton, { BUTTON_SIZES, BUTTON_VARIANTS, resolveSize, resolveVariant } from './PillButton';
import Spinner from './Spinner';

// RN-SPEC-v2-foundation §4.1 Button (pill) and the §9 button gate.

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const pressableOf = (tree) => tree.root.findAll((node) => typeof node.type !== 'string' && node.props.accessibilityRole && typeof node.props.style !== 'undefined' && node.props.onPress !== undefined)[0];
const restStyle = (tree) => StyleSheet.flatten(pressableOf(tree).props.style({ pressed: false }));
const pressedStyle = (tree) => StyleSheet.flatten(pressableOf(tree).props.style({ pressed: true }));
const labelStyle = (tree) => StyleSheet.flatten(tree.root.findByType(Text).props.style);

const button = (props) => render(<PillButton testID="btn" title="Save" onPress={() => {}} {...props} />);

describe('variants (§4.1 table)', () => {
  it('has exactly the five v2 variants and three sizes', () => {
    expect(BUTTON_VARIANTS).toEqual(['primary', 'secondary', 'ghost', 'danger', 'light']);
    expect(BUTTON_SIZES).toEqual(['default', 'compact', 'cta']);
  });

  it('primary: flat gold, on-gold text, the gold glow, no border', () => {
    const tree = button({ variant: 'primary' });
    expect(restStyle(tree)).toMatchObject({ backgroundColor: colors.gold, boxShadow: shadows.goldGlow, borderRadius: radii.full });
    expect(restStyle(tree).borderWidth).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.onGold);
    expect(colors.onGold).toBe('#0A0B0F');
  });

  it('primary pressed = goldDeep, glow kept', () => {
    const tree = button({ variant: 'primary' });
    expect(pressedStyle(tree)).toMatchObject({ backgroundColor: colors.goldDeep, boxShadow: shadows.goldGlow });
  });

  it('secondary (glass): 8 % fill, 1 px 12 % border, primary text, no shadow', () => {
    const tree = button({ variant: 'secondary' });
    expect(restStyle(tree)).toMatchObject({ backgroundColor: colors.fillButton, borderWidth: 1, borderColor: colors.hairlineButton });
    expect(colors.fillButton).toBe('rgba(255, 255, 255, 0.08)');
    expect(colors.hairlineButton).toBe('rgba(255, 255, 255, 0.12)');
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.textPrimary);
    expect(pressedStyle(tree).backgroundColor).toBe(colors.hairlineButton);
  });

  it('ghost: transparent, primary text, no border or shadow', () => {
    const tree = button({ variant: 'ghost' });
    expect(restStyle(tree).backgroundColor).toBe('transparent');
    expect(restStyle(tree).borderWidth).toBeUndefined();
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.textPrimary);
    expect(pressedStyle(tree).backgroundColor).toBe(colors.fillButton);
  });

  it('danger: color-danger fill with onDanger (white) text, no shadow', () => {
    const tree = button({ variant: 'danger' });
    expect(restStyle(tree).backgroundColor).toBe(colors.danger);
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.onDanger);
    expect(pressedStyle(tree)).toMatchObject({ backgroundColor: colors.danger, opacity: 0.85 });
  });

  it('light: the #F5F6F8 fill with on-light text, no shadow', () => {
    const tree = button({ variant: 'light' });
    expect(restStyle(tree).backgroundColor).toBe(colors.textPrimary);
    expect(colors.textPrimary).toBe('#F5F6F8');
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.onLight);
    expect(pressedStyle(tree).backgroundColor).toBe(colors.textStrong2);
  });

  it('only the primary carries a shadow', () => {
    BUTTON_VARIANTS.forEach((variant) => {
      const { boxShadow } = restStyle(button({ variant }));
      expect(boxShadow).toBe(variant === 'primary' ? shadows.goldGlow : undefined);
    });
  });

  it('keeps old / alternative names working and falls back to primary', () => {
    expect(resolveVariant('glass')).toBe('secondary');
    expect(resolveVariant('gold')).toBe('primary');
    expect(resolveVariant('brand')).toBe('primary');
    expect(resolveVariant('hero')).toBe('primary');
    expect(resolveVariant('destructive')).toBe('danger');
    expect(resolveVariant('nope')).toBe('primary');
    expect(resolveVariant(undefined)).toBe('primary');
    expect(restStyle(button({ variant: 'glass' })).backgroundColor).toBe(colors.fillButton);
  });
});

describe('sizes', () => {
  it('default: 52, padding 0 24, label-lg 16/600', () => {
    const tree = button({});
    expect(restStyle(tree)).toMatchObject({ minHeight: 52, paddingHorizontal: 24 });
    expect(labelStyle(tree)).toMatchObject({ ...font(600), fontSize: 16, lineHeight: 20 });
  });

  it('compact 44: 14/600, padding 0 18 (v1 "small" maps here)', () => {
    for (const size of ['compact', 'small']) {
      const tree = button({ size });
      expect(restStyle(tree)).toMatchObject({ minHeight: 44, paddingHorizontal: 18 });
      expect(labelStyle(tree)).toMatchObject({ ...font(600), fontSize: 14 });
    }
    expect(resolveSize('small')).toBe('compact');
  });

  it('cta 60: 17/700 and the large gold glow on the primary', () => {
    const tree = button({ size: 'cta' });
    expect(restStyle(tree)).toMatchObject({ minHeight: 60, boxShadow: shadows.goldGlowLarge });
    expect(labelStyle(tree)).toMatchObject({ ...font(700), fontSize: 17 });
    expect(resolveSize('large')).toBe('cta');
  });

  it('cta in another variant has no glow', () => {
    expect(restStyle(button({ size: 'cta', variant: 'secondary' })).boxShadow).toBeUndefined();
  });

  it('an unknown size falls back to default', () => {
    expect(resolveSize('huge')).toBe('default');
    expect(restStyle(button({ size: 'huge' })).minHeight).toBe(52);
  });

  it('never sets fontWeight next to the Geist family', () => {
    ['default', 'compact', 'cta'].forEach((size) => expect(labelStyle(button({ size })).fontWeight).toBeUndefined());
  });
});

describe('states', () => {
  it('default: pressable, full opacity, labelled by its title, presses call onPress', () => {
    const onPress = jest.fn();
    const tree = button({ onPress });
    const pressable = pressableOf(tree);
    expect(pressable.props.disabled).toBe(false);
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Save');
    expect(pressable.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(restStyle(tree).opacity).toBeUndefined();
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('an accessibilityLabel overrides the title', () => {
    expect(pressableOf(button({ accessibilityLabel: 'Save plan' })).props.accessibilityLabel).toBe('Save plan');
  });

  it('disabled: opacity 0.5, not pressable, no pressed look', () => {
    const tree = button({ disabled: true });
    expect(pressableOf(tree).props.disabled).toBe(true);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(restStyle(tree).opacity).toBe(0.5);
    expect(pressedStyle(tree)).toMatchObject({ backgroundColor: colors.gold, opacity: 0.5 });
  });

  it('loading: opacity 0.5, busy, not pressable, the caller label stays, a spinner in the text colour', () => {
    const tree = button({ loading: true, title: 'Saving…' });
    expect(pressableOf(tree).props.disabled).toBe(true);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(restStyle(tree).opacity).toBe(0.5);
    expect(tree.root.findByType(Text).props.children).toBe('Saving…');
    const spinner = tree.root.findByType(Spinner);
    expect(spinner.props.color).toBe(colors.onGold);
    // Spinners slow under reduced motion but never stop.
    expect(spinner.props.reducedMotionLoopMs).toBe(motion.spinnerReducedLoopMs);
  });

  it('loading on danger: the spinner takes the onDanger ink', () => {
    expect(button({ loading: true, variant: 'danger' }).root.findByType(Spinner).props.color).toBe(colors.onDanger);
  });

  it('no spinner when not loading', () => {
    expect(button({}).root.findAllByType(Spinner)).toHaveLength(0);
  });

  it('fullWidth stretches the pill and its label row', () => {
    const tree = button({ fullWidth: true });
    expect(restStyle(tree).alignSelf).toBe('stretch');
  });

  it('an icon renders before the label, in the label colour (render prop)', () => {
    const icon = jest.fn(() => <Text testID="btn-icon">+</Text>);
    const tree = button({ icon, variant: 'secondary' });
    expect(icon).toHaveBeenCalledWith({ color: colors.textPrimary });
    expect(tree.root.findAll((node) => node.props.testID === 'btn-icon')).not.toHaveLength(0);
  });

  it('the loading spinner replaces the icon', () => {
    const tree = button({ icon: <Text testID="btn-icon">+</Text>, loading: true });
    expect(tree.root.findAll((node) => node.props.testID === 'btn-icon')).toHaveLength(0);
  });

  it('never clips (Android: a rounded view that changes style must not clip)', () => {
    const tree = button({});
    expect(restStyle(tree).overflow).toBeUndefined();
    expect(pressedStyle(tree).overflow).toBeUndefined();
  });

  it('a layout style passes through', () => {
    expect(restStyle(button({ style: { marginTop: 20 } })).marginTop).toBe(20);
  });
});
