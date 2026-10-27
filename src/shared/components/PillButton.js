import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, motion, radii, shadows, spacing, typography } from '../theme/tokens';
import { CAP_BODY } from './largeText';
import Spinner from './Spinner';

// RN-SPEC-v2-foundation §4.1 Button (pill): five variants + goldTint, flat fills. Only
// the gold primary carries the glow (one gold primary per screen); text on
// gold is always colors.onGold.
// Pressed (UX §8.6 STATE RULE): the rest colour stays and a 4 % overlay View
// covers the pill: pressOverlayInk (ink) on the light fills (gold, light),
// pressOverlay (white) on the dark ones (secondary, ghost, goldTint). Never a new alpha
// step and never goldDeep. The one exception (§8.6a 5): the solid danger
// button turns colors.dangerHover.
const VARIANTS = {
  primary: {
    rest: { backgroundColor: colors.gold },
    overlay: colors.pressOverlayInk,
    text: colors.onGold,
    spinnerTrack: colors.onGoldSpinnerTrack,
    glow: true,
  },
  // "glass": white at 8 % with a 1 px white-at-12 % edge.
  secondary: {
    rest: { backgroundColor: colors.fillButton, borderWidth: 1, borderColor: colors.hairlineButton },
    overlay: colors.pressOverlay,
    text: colors.textPrimary,
    spinnerTrack: colors.hairlineButton,
  },
  ghost: {
    rest: { backgroundColor: 'transparent' },
    overlay: colors.pressOverlay,
    text: colors.textPrimary,
    spinnerTrack: colors.hairlineButton,
  },
  danger: {
    rest: { backgroundColor: colors.danger },
    pressed: { backgroundColor: colors.dangerHover },
    text: colors.onDanger,
    spinnerTrack: colors.hairlineButton,
  },
  // The light fill (the text-primary value) with on-light ink ("Skip rest").
  light: {
    rest: { backgroundColor: colors.textPrimary },
    overlay: colors.pressOverlayInk,
    text: colors.onLight,
    spinnerTrack: colors.onGoldSpinnerTrack,
  },
  // Gold text on the 14 % gold tint with the 1 px goldLine edge (UX O ruling
  // 4: assign-mode "Assign"). A dark fill, so the white 4 % overlay.
  goldTint: {
    rest: { backgroundColor: colors.goldTint, borderWidth: 1, borderColor: colors.goldLine },
    overlay: colors.pressOverlay,
    text: colors.gold,
    spinnerTrack: colors.goldLine,
  },
  // ON a gold card (RN-SPEC-my-trainer MT1.6, 27 Oct 2026): `ink` = the solid
  // ink pill with gold text (the white overlay, a dark fill); `inkTint` = ink
  // at 12 % with ink text (the ink overlay, it shows the gold).
  ink: {
    rest: { backgroundColor: colors.onGold },
    overlay: colors.pressOverlay,
    text: colors.gold,
    spinnerTrack: colors.goldLine,
  },
  inkTint: {
    rest: { backgroundColor: colors.inkChip },
    overlay: colors.pressOverlayInk,
    text: colors.onGold,
    spinnerTrack: colors.onGoldSpinnerTrack,
  },
};

// Older / alternative names map onto the v2 variants so call sites keep
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

// QA LOW (Create profile): the sticky CTA bars sit OUTSIDE the ScrollView, so
// a scroll swipe that starts on the button isn't taken by the scroll and
// Pressable fires onPress on release (still inside the hit rect + retention).
// A touch that travels more than this from where it went down is a swipe,
// never a press. Accessibility activation (no touch) is unaffected.
export const TAP_MOVE_LIMIT = 10;

const touchPoint = (event) => {
  const native = event?.nativeEvent ?? {};
  const touch = native.touches?.[0] ?? native.changedTouches?.[0] ?? native;
  return typeof touch.pageX === 'number' && typeof touch.pageY === 'number' ? { x: touch.pageX, y: touch.pageY } : null;
};

/**
 * The swipe guard for any Pressable that sits outside a scroll view: spread
 * the handlers onto the Pressable and wrap its onPress with `guard`.
 */
export function useSwipeGuard() {
  const start = useRef(null);
  const moved = useRef(false);
  return {
    onPressIn: (event) => {
      start.current = touchPoint(event);
      moved.current = false;
    },
    onPressMove: (event) => {
      const at = touchPoint(event);
      if (start.current && at && Math.hypot(at.x - start.current.x, at.y - start.current.y) > TAP_MOVE_LIMIT) {
        moved.current = true;
      }
    },
    guard: (handler) => (event) => {
      const swiped = moved.current;
      start.current = null;
      moved.current = false;
      if (!swiped && handler) {
        handler(event);
      }
    },
  };
}

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
  // UX §9 rule 2: a label never truncates; it wraps (2 lines at the 2.0 cap
  // for any real label) and the pill grows from a 52 minimum, padding
  // unchanged. A compact pill that wraps also takes the 52 minimum.
  const [wrapped, setWrapped] = useState(false);
  const swipe = useSwipeGuard();
  const onTextLayout = (event) => {
    const next = (event?.nativeEvent?.lines?.length ?? 1) > 1;
    if (next !== wrapped) {
      setWrapped(next);
    }
  };

  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={swipe.onPressIn}
      onPressMove={swipe.onPressMove}
      onPress={swipe.guard(onPress)}
      style={({ pressed }) => [
        styles.base,
        styles[sizeName],
        wrapped && sizeName === 'compact' && styles.wrapped,
        look.rest,
        glow,
        style,
        pressed && !inactive && look.pressed,
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed && !inactive && look.overlay ? (
            <View
              testID={testID ? `${testID}-pressed` : 'pill-pressed-overlay'}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: look.overlay }]}
            />
          ) : null}
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
            <Text
              {...CAP_BODY}
              textBreakStrategy="simple"
              onTextLayout={onTextLayout}
              style={[styles[`${sizeName}Label`], styles.label, { color: look.text }]}
            >
              {title}
            </Text>
          </View>
        </>
      )}
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
  // A wrapped compact label (large text) grows from 52, like the default
  // size (default is already 52, cta stays 60).
  wrapped: {
    minHeight: 52,
  },
  // Wraps inside the row and centres each line (§9: labels wrap, never
  // truncate). No numberOfLines: nothing is ever cut off.
  label: {
    flexShrink: 1,
    textAlign: 'center',
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
  // Vertical padding only shows once a label wraps at large text (one line
  // at 1× sits well inside the minimum height).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    maxWidth: '100%',
    paddingVertical: spacing[2],
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
  // The pressed overlay takes the pill's shape (no clipping on the pill
  // itself: a rounded Android view that changes style must not clip).
  overlay: {
    borderRadius: radii.full,
  },
});
