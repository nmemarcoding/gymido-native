import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, motion, radii, shadows, spacing, typography } from '../theme/tokens';
import Spinner from './Spinner';

// RN-SPEC-v2-foundation §4.1 Button (pill): five variants, flat fills. Only
// the gold primary carries the glow (one gold primary per screen); text on
// gold is always colors.onGold. Pressed gold = colors.goldDeep (UX, 26 Oct).
// The spec draws no pressed state for the other variants: they take the next
// step of their own fill family (see `pressed` below).
const VARIANTS = {
  primary: {
    rest: { backgroundColor: colors.gold },
    pressed: { backgroundColor: colors.goldDeep },
    text: colors.onGold,
    spinnerTrack: colors.onGoldSpinnerTrack,
    glow: true,
  },
  // "glass": white at 8 % with a 1 px white-at-12 % edge.
  secondary: {
    rest: { backgroundColor: colors.fillButton, borderWidth: 1, borderColor: colors.hairlineButton },
    pressed: { backgroundColor: colors.hairlineButton },
    text: colors.textPrimary,
    spinnerTrack: colors.hairlineButton,
  },
  ghost: {
    rest: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.fillButton },
    text: colors.textPrimary,
    spinnerTrack: colors.hairlineButton,
  },
  danger: {
    rest: { backgroundColor: colors.danger },
    pressed: { opacity: 0.85 },
    text: colors.onDanger,
    spinnerTrack: colors.hairlineButton,
  },
  // The light fill (the text-primary value) with on-light ink ("Skip rest").
  light: {
    rest: { backgroundColor: colors.textPrimary },
    pressed: { backgroundColor: colors.textStrong2 },
    text: colors.onLight,
    spinnerTrack: colors.onGoldSpinnerTrack,
  },
};

// Older / alternative names map onto the five v2 variants so call sites keep
// working; an unknown name falls back to primary.
const VARIANT_ALIASES = {
  glass: 'secondary',
  gold: 'primary',
  brand: 'primary',
  hero: 'primary',
  destructive: 'danger',
};

// Sizes: default 52, compact 44 (dense rows), cta 60 (the single bottom
// action). v1's `small` is compact; `large` is cta.
const SIZE_ALIASES = {
  small: 'compact',
  large: 'cta',
};

export const BUTTON_VARIANTS = Object.freeze(Object.keys(VARIANTS));
export const BUTTON_SIZES = Object.freeze(['default', 'compact', 'cta']);

export function resolveVariant(variant) {
  const name = VARIANT_ALIASES[variant] ?? variant;
  return VARIANTS[name] ? name : 'primary';
}

export function resolveSize(size) {
  const name = SIZE_ALIASES[size] ?? size;
  return BUTTON_SIZES.includes(name) ? name : 'default';
}

export default function PillButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  size = 'default',
  // Optional leading icon: a node, or ({ color }) => node (gap 8).
  icon,
  accessibilityLabel,
  testID,
  // Outer layout only (margins, width); BrandButton passes it through.
  style,
  // React 19: a plain prop, for callers that move accessibility focus here.
  ref,
}) {
  const inactive = disabled || loading;
  const look = VARIANTS[resolveVariant(variant)];
  const sizeName = resolveSize(size);
  const glow = look.glow ? (sizeName === 'cta' ? styles.glowLarge : styles.glow) : null;
  const iconNode = typeof icon === 'function' ? icon({ color: look.text }) : icon;

  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[sizeName],
        look.rest,
        glow,
        style,
        pressed && !inactive && look.pressed,
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
      ]}
    >
      <View style={[styles.row, fullWidth && styles.rowFullWidth]}>
        {loading ? (
          <Spinner
            size={sizeName === 'compact' ? 14 : 16}
            thickness={2}
            color={look.text}
            track={look.spinnerTrack}
            reducedMotionLoopMs={motion.spinnerReducedLoopMs}
          />
        ) : (
          iconNode ?? null
        )}
        {/* Android's high-quality line breaking can measure a bold label slightly
            short and clip its last word ("Add a day" → "Add a"). */}
        <Text textBreakStrategy="simple" style={[styles[`${sizeName}Label`], { color: look.text }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // minHeight (not height) so large Dynamic Type grows the pill instead of
  // clipping the label.
  base: {
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  default: {
    minHeight: 52,
    paddingHorizontal: spacing[6],
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: spacing['4_5'],
  },
  cta: {
    minHeight: 60,
    paddingHorizontal: spacing[6],
  },
  defaultLabel: typography.labelLg,
  compactLabel: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
  },
  ctaLabel: {
    ...font(700),
    fontSize: 17,
    lineHeight: 22,
  },
  glow: {
    boxShadow: shadows.goldGlow,
  },
  glowLarge: {
    boxShadow: shadows.goldGlowLarge,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  // Android can measure a shrink-wrapped label short inside a stretched
  // button and cut its last word; full-width buttons lay it out full width.
  rowFullWidth: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  inactive: {
    opacity: 0.5,
  },
});
