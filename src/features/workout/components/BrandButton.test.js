jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import PillButton from '../../../shared/components/PillButton';
import Spinner from '../../../shared/components/Spinner';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import BrandButton, { outerLayout } from './BrandButton';

// §4.1: the retired v1 HeroButton is the flat gold primary Button.

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const pressableOf = (tree) => tree.root.findAll((node) => typeof node.type !== 'string' && node.props.accessibilityRole && typeof node.props.style !== 'undefined' && node.props.onPress !== undefined)[0];
const styleAt = (tree, pressed) => StyleSheet.flatten(pressableOf(tree).props.style({ pressed }));

describe('BrandButton', () => {
  it('renders the primary Button with its label, testID and role', () => {
    const tree = render(<BrandButton testID="workout-hero-start" label="START TODAY'S WORKOUT" onPress={() => {}} />);
    const button = tree.root.findByType(PillButton);
    expect(button.props).toMatchObject({ variant: 'primary', title: "START TODAY'S WORKOUT", testID: 'workout-hero-start' });
    expect(pressableOf(tree).props.accessibilityRole).toBe('button');
    expect(tree.root.findByType(Text).props.children).toBe("START TODAY'S WORKOUT");
  });

  it('default: flat gold, on-gold label, the gold glow, a pill', () => {
    const tree = render(<BrandButton label="Resume" onPress={() => {}} />);
    expect(styleAt(tree, false)).toMatchObject({ backgroundColor: colors.gold, boxShadow: shadows.goldGlow, borderRadius: radii.full, minHeight: 52 });
    expect(StyleSheet.flatten(tree.root.findByType(Text).props.style).color).toBe(colors.onGold);
  });

  it('pressed: gold kept (§8.6 state rule; PillButton draws the ink overlay)', () => {
    const tree = render(<BrandButton label="Resume" onPress={() => {}} />);
    expect(styleAt(tree, true).backgroundColor).toBe(colors.gold);
  });

  it('a press calls onPress', () => {
    const onPress = jest.fn();
    const tree = render(<BrandButton label="Resume" onPress={onPress} />);
    act(() => pressableOf(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: 0.5, not pressable', () => {
    const tree = render(<BrandButton label="Resume" disabled onPress={() => {}} />);
    expect(pressableOf(tree).props.disabled).toBe(true);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(styleAt(tree, false).opacity).toBe(0.5);
  });

  it('loading: 0.5, busy, a spinner in the on-gold ink', () => {
    const tree = render(<BrandButton label="START TODAY'S WORKOUT" loading onPress={() => {}} />);
    expect(pressableOf(tree).props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(styleAt(tree, false).opacity).toBe(0.5);
    expect(tree.root.findByType(Spinner).props.color).toBe(colors.onGold);
  });

  it('keeps the v1 style prop for outer layout, but the Button owns shape and type', () => {
    const tree = render(
      <BrandButton
        label="START TODAY'S WORKOUT"
        onPress={() => {}}
        style={{ marginTop: 20, borderRadius: 24, paddingVertical: 16, height: 44 }}
        labelStyle={{ fontSize: 12, fontWeight: '700' }}
      />
    );
    const style = styleAt(tree, false);
    expect(style.marginTop).toBe(20);
    expect(style.borderRadius).toBe(radii.full);
    expect(style.paddingVertical).toBeUndefined();
    expect(style.height).toBeUndefined();
    const label = StyleSheet.flatten(tree.root.findByType(Text).props.style);
    expect(label.fontWeight).toBeUndefined();
    expect(label.fontSize).toBe(16);
  });

  it('a size passes through (cta = 60 with the one gold glow, T-86)', () => {
    const tree = render(<BrandButton label="Go home" size="cta" onPress={() => {}} />);
    // DECLARED (T-86): was shadows.goldGlowLarge (retired).
    expect(styleAt(tree, false)).toMatchObject({ minHeight: 60, boxShadow: shadows.goldGlow });
    expect(shadows.goldGlow).toBe('0px 10px 24px -12px rgba(255, 194, 26, 0.4)');
  });

  it('never clips (Android blank-render class)', () => {
    const tree = render(<BrandButton label="Resume" onPress={() => {}} style={{ overflow: 'visible' }} />);
    expect(styleAt(tree, true).overflow).not.toBe('hidden');
    expect(outerLayout(undefined)).toBeUndefined();
  });
});
