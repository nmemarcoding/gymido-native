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
// The pressed overlay the Pressable's children draw (§8.6 STATE RULE).
const overlayOf = (tree, pressed = true) => {
  const inner = render(<>{pressableOf(tree).props.children({ pressed })}</>);
  const found = inner.root.findAll((node) => typeof node.type === 'string' && node.props.testID === 'btn-pressed');
  return found.length ? StyleSheet.flatten(found[0].props.style) : null;
};
const labelStyle = (tree) => StyleSheet.flatten(tree.root.findByType(Text).props.style);

const button = (props) => render(<PillButton testID="btn" title="Save" onPress={() => {}} {...props} />);

describe('variants (§4.1 table)', () => {
  // DECLARED (27 Oct 2026, RN-SPEC-my-trainer MT1.6): was six variants; ink + inkTint added for the gold card.
  it('has exactly the eight v2 variants (goldTint for UX O ruling 4; ink / inkTint on a gold card) and three sizes', () => {
    expect(BUTTON_VARIANTS).toEqual(['primary', 'secondary', 'ghost', 'danger', 'light', 'goldTint', 'ink', 'inkTint']);
    expect(BUTTON_SIZES).toEqual(['default', 'compact', 'cta']);
  });

  it('primary: flat gold, on-gold text, the gold glow, no border', () => {
    const tree = button({ variant: 'primary' });
    expect(restStyle(tree)).toMatchObject({ backgroundColor: colors.gold, boxShadow: shadows.goldGlow, borderRadius: radii.full });
    expect(restStyle(tree).borderWidth).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.onGold);
    expect(colors.onGold).toBe('#0A0B0F');
  });

  it('primary pressed (§8.6 state rule): the gold stays, an ink 4 % overlay covers the pill, glow kept, never goldDeep', () => {
    const tree = button({ variant: 'primary' });
    expect(pressedStyle(tree)).toMatchObject({ backgroundColor: colors.gold, boxShadow: shadows.goldGlow });
    expect(overlayOf(tree)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.full, backgroundColor: colors.pressOverlayInk });
    expect(colors.pressOverlayInk).toBe('rgba(10, 11, 15, 0.04)');
    expect(overlayOf(tree, false)).toBeNull();
  });

  it('secondary (glass): 8 % fill, 1 px 12 % border, primary text, no shadow', () => {
    const tree = button({ variant: 'secondary' });
    expect(restStyle(tree)).toMatchObject({ backgroundColor: colors.fillButton, borderWidth: 1, borderColor: colors.hairlineButton });
    expect(colors.fillButton).toBe('rgba(255, 255, 255, 0.08)');
    expect(colors.hairlineButton).toBe('rgba(255, 255, 255, 0.12)');
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.textPrimary);
    // §8.6 state rule: the glass fill stays + the white 4 % overlay.
    expect(pressedStyle(tree)).toMatchObject({ backgroundColor: colors.fillButton, borderColor: colors.hairlineButton });
    expect(overlayOf(tree).backgroundColor).toBe(colors.pressOverlay);
  });

  it('ghost: transparent, primary text, no border or shadow', () => {
    const tree = button({ variant: 'ghost' });
    expect(restStyle(tree).backgroundColor).toBe('transparent');
    expect(restStyle(tree).borderWidth).toBeUndefined();
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.textPrimary);
    expect(pressedStyle(tree).backgroundColor).toBe('transparent');
    expect(overlayOf(tree).backgroundColor).toBe(colors.pressOverlay);
  });

  it('danger: color-danger fill with onDanger (white) text, no shadow', () => {
    const tree = button({ variant: 'danger' });
    expect(restStyle(tree).backgroundColor).toBe(colors.danger);
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.onDanger);
    // §8.6a 5: the solid danger button's pressed = dangerHover, no overlay.
    expect(pressedStyle(tree).backgroundColor).toBe(colors.dangerHover);
    expect(pressedStyle(tree).opacity).toBeUndefined();
    expect(overlayOf(tree)).toBeNull();
  });

  it('light: the #F5F6F8 fill with on-light text, no shadow', () => {
    const tree = button({ variant: 'light' });
    expect(restStyle(tree).backgroundColor).toBe(colors.textPrimary);
    expect(colors.textPrimary).toBe('#F5F6F8');
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.onLight);
    expect(pressedStyle(tree).backgroundColor).toBe(colors.textPrimary);
    expect(overlayOf(tree).backgroundColor).toBe(colors.pressOverlayInk);
  });

  it('goldTint (UX O ruling 4): gold text on the 14 % gold fill with the 1 px goldLine edge, no shadow', () => {
    const tree = button({ variant: 'goldTint' });
    expect(restStyle(tree)).toMatchObject({ backgroundColor: colors.goldTint, borderWidth: 1, borderColor: colors.goldLine, borderRadius: radii.full });
    expect(colors.goldTint).toBe('rgba(255, 194, 26, 0.14)');
    expect(colors.goldLine).toBe('rgba(255, 194, 26, 0.30)');
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(colors.gold);
    // §8.6 / §10 hover rule: the tint stays + the white 4 % overlay (a dark fill).
    expect(pressedStyle(tree)).toMatchObject({ backgroundColor: colors.goldTint, borderColor: colors.goldLine });
    expect(overlayOf(tree).backgroundColor).toBe(colors.pressOverlay);
    expect(overlayOf(tree, false)).toBeNull();
  });

  it.each([
    ['ink', colors.onGold, colors.gold, colors.pressOverlay],
    ['inkTint', colors.inkChip, colors.onGold, colors.pressOverlayInk],
  ])('%s (MT1.6, on a gold card): fill, text and the 4 %% overlay; no glow', (variant, fill, text, overlay) => {
    const tree = button({ variant });
    expect(restStyle(tree)).toMatchObject({ backgroundColor: fill, borderRadius: radii.full });
    expect(restStyle(tree).boxShadow).toBeUndefined();
    expect(labelStyle(tree).color).toBe(text);
    expect(overlayOf(tree).backgroundColor).toBe(overlay);
    expect(colors.inkChip).toBe('rgba(10, 11, 15, 0.12)');
  });

  it('goldTint loading: the spinner takes the gold ink on the goldLine track; disabled dims it', () => {
    const loading = button({ variant: 'goldTint', loading: true });
    expect(loading.root.findByType(Spinner).props).toMatchObject({ color: colors.gold, track: colors.goldLine });
    expect(restStyle(button({ variant: 'goldTint', disabled: true })).opacity).toBe(0.5);
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
    expect(overlayOf(tree)).toBeNull();
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

describe('pressed: the §8.6 STATE RULE on every variant', () => {
  it('no variant swaps to a new fill or uses goldDeep; only danger changes colour (dangerHover)', () => {
    BUTTON_VARIANTS.forEach((variant) => {
      const tree = button({ variant });
      const rest = restStyle(tree).backgroundColor;
      const pressed = pressedStyle(tree).backgroundColor;
      expect(pressed).not.toBe(colors.goldDeep);
      expect(pressed).toBe(variant === 'danger' ? colors.dangerHover : rest);
    });
  });

  it('ink overlay on the light fills, white overlay on the dark fills', () => {
    expect(overlayOf(button({ variant: 'primary' })).backgroundColor).toBe(colors.pressOverlayInk);
    expect(overlayOf(button({ variant: 'light' })).backgroundColor).toBe(colors.pressOverlayInk);
    expect(overlayOf(button({ variant: 'secondary' })).backgroundColor).toBe(colors.pressOverlay);
    expect(overlayOf(button({ variant: 'ghost' })).backgroundColor).toBe(colors.pressOverlay);
    expect(overlayOf(button({ variant: 'goldTint' })).backgroundColor).toBe(colors.pressOverlay);
  });

  it('loading: no pressed overlay (inactive)', () => {
    expect(overlayOf(button({ loading: true }))).toBeNull();
  });

  it('the overlay never takes touches and sits under the label', () => {
    const inner = render(<>{pressableOf(button({})).props.children({ pressed: true })}</>);
    const overlay = inner.root.find((node) => typeof node.type === 'string' && node.props.testID === 'btn-pressed');
    expect(overlay.props.pointerEvents).toBe('none');
    const order = inner.root.findAll((node) => typeof node.type === 'string' && (node.props.testID === 'btn-pressed' || node.type === 'Text'));
    expect(order[0].props.testID).toBe('btn-pressed');
  });

  it('a button without a testID still draws the overlay', () => {
    const tree = render(<PillButton title="Go" onPress={() => {}} />);
    const inner = render(<>{pressableOf(tree).props.children({ pressed: true })}</>);
    expect(inner.root.findAll((node) => typeof node.type === 'string' && node.props.testID === 'pill-pressed-overlay')).toHaveLength(1);
  });
});

// QA LOW (Create profile): a scroll swipe that STARTED on a sticky CTA (outside the ScrollView, so nothing took
// the touch away) fired onPress on release. A touch that travels more than ~10 px is a swipe, not a tap.
describe('swipe is not a press', () => {
  const touch = (x, y) => ({
    persist() {},
    currentTarget: { measure: jest.fn() },
    nativeEvent: { pageX: x, pageY: y, locationX: x, locationY: y, timestamp: Date.now(), touches: [], changedTouches: [] },
  });
  const hostOf = (tree) => tree.root.find((node) => typeof node.type === 'string' && typeof node.props.onResponderGrant === 'function');
  function gesture(tree, moves) {
    const host = hostOf(tree);
    act(() => {
      host.props.onResponderGrant(touch(100, 200));
    });
    moves.forEach(([x, y]) => act(() => host.props.onResponderMove(touch(x, y))));
    const [endX, endY] = moves.length ? moves[moves.length - 1] : [100, 200];
    act(() => {
      host.props.onResponderRelease(touch(endX, endY));
    });
  }

  it('press-in, a 40 px vertical move, release: onPress does NOT fire', () => {
    const onPress = jest.fn();
    const tree = button({ onPress });
    gesture(tree, [[100, 180], [100, 160]]);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a 40 px sideways move does not fire either', () => {
    const onPress = jest.fn();
    gesture(button({ onPress }), [[140, 200]]);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a tap (no move, or ≤ 10 px of jitter) still fires once', () => {
    const still = jest.fn();
    gesture(button({ onPress: still }), []);
    expect(still).toHaveBeenCalledTimes(1);
    const jitter = jest.fn();
    gesture(button({ onPress: jitter }), [[104, 206], [106, 208]]);
    expect(jitter).toHaveBeenCalledTimes(1);
  });

  it('after a cancelled swipe the next tap fires, and a11y activation (no touch) still fires', () => {
    const onPress = jest.fn();
    const tree = button({ onPress });
    gesture(tree, [[100, 150]]);
    expect(onPress).not.toHaveBeenCalled();
    gesture(tree, []);
    expect(onPress).toHaveBeenCalledTimes(1);
    gesture(tree, [[100, 150]]);
    act(() => pressableOf(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});
