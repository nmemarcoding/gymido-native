import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, layout, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import GradientFill from './GradientFill';
import { CAP_BODY, useLargeTextReflow } from './largeText';

// RN-SPEC-v2-phase2 §D1 Ruling 2: ONE Retry style everywhere: glass secondary
// (white 8 % + 1 px white 12 %), 40 visual with a 44 hit area, 14/600.
// Loading: the label stays, disabled at 0.5, busy. Used by ErrorAlert and the
// Workout whole-page "Try again".
export const RETRY_HEIGHT = 40;
export const RETRY_SLOP = (layout.touchMin - RETRY_HEIGHT) / 2;

export function RetryButton({ title = 'Retry', onPress, loading = false, disabled = false, accessibilityLabel, testID, style, ref }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={{ top: RETRY_SLOP, bottom: RETRY_SLOP, left: 0, right: 0 }}
      onPress={onPress}
      style={({ pressed }) => [retryStyles.button, style, pressed && !inactive && retryStyles.pressed, inactive && retryStyles.inactive]}
    >
      <Text {...CAP_BODY} textBreakStrategy="simple" style={retryStyles.label}>
        {title}
      </Text>
    </Pressable>
  );
}

const retryStyles = StyleSheet.create({
  // minHeight so large Dynamic Type grows the pill instead of clipping it.
  button: {
    minHeight: RETRY_HEIGHT,
    minWidth: layout.touchMin,
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // As the kit's secondary button: the next step of the glass fill.
  pressed: {
    backgroundColor: colors.hairlineButton,
  },
  inactive: {
    opacity: 0.5,
  },
  label: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});

// RN-SPEC-v2-foundation §5 (inline; what loaded stays): a card in the danger
// tint, an icon tile, the failed part as the title, the server text under it,
// and the Retry (ruling 2) at the right only when `onRetry` is given (never
// for save failures). Role alert, announced on mount.
// `variant` (UX D component table): 'default' (the kit card), 'compact' (the
// Exercises board: surface fill, 40 tile, centred row) and 'generator' (the
// Generator board: danger-tint gradient over the surface, 48 tile).
// `retrying` shows the Retry's loading state; `retryTestID` names it.
export default function ErrorAlert({ title, description, onRetry, retrying = false, retryTestID, variant = 'default', style, testID, ref }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, description].filter(Boolean).join('. '));
  }, [title, description]);

  const name = VARIANT_STYLES[variant] ? variant : 'default';
  const look = VARIANT_STYLES[name];
  const compact = name !== 'default';
  // UX §9 rule 4: past 1.3× the trailing Retry drops below the text, full
  // width (the row wraps; the text keeps the line beside the icon).
  const stacked = useLargeTextReflow();

  return (
    <View ref={ref} testID={testID} accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.box, look.box, stacked && styles.boxStacked, style]}>
      {/* Mounted with the card (never added on a state change); SVG. */}
      {name === 'generator' ? <GradientFill angle={160} colors={[colors.dangerTextTint, colors.dangerTextFill]} /> : null}
      <View testID="error-alert-icon" style={[styles.iconTile, look.iconTile]}>
        <FeedbackIcon name="error" size={name === 'generator' ? 22 : 18} color={colors.dangerText} />
      </View>
      <View style={styles.text}>
        {title ? <Text {...CAP_BODY} style={[styles.title, compact && styles.titleCompact]}>{title}</Text> : null}
        {description ? <Text {...CAP_BODY} style={[styles.description, compact && styles.descriptionCompact]}>{description}</Text> : null}
      </View>
      {onRetry ? <RetryButton title="Retry" testID={retryTestID} onPress={onRetry} loading={retrying} style={stacked ? styles.retryStacked : styles.retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.dangerDotBorder,
    backgroundColor: colors.dangerDotTint,
    padding: spacing['4_5'],
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerTextTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...font(600),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  titleCompact: {
    lineHeight: 20,
  },
  description: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  retry: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  boxStacked: {
    flexWrap: 'wrap',
  },
  retryStacked: {
    width: '100%',
  },
});

const VARIANT_STYLES = {
  default: StyleSheet.create({ box: {}, iconTile: {} }),
  // Exercises board: padding 16, radius 24, surface, danger-text edge
  // (0.28 drawn → token dangerTextBorder 0.25), tile 40 radius 12.
  compact: StyleSheet.create({
    box: {
      alignItems: 'center',
      padding: spacing[4],
      backgroundColor: colors.surface,
      borderColor: colors.dangerTextBorder,
    },
    iconTile: { width: 40, height: 40, borderRadius: radii.sm },
  }),
  // Generator board: padding 18, radius 26 (no token → radius-xl 24), the
  // 160° danger tint (0.14 → 0.04 drawn; tokens 0.12 → 0.08) over the
  // surface, tile 48 radius 16.
  generator: StyleSheet.create({
    box: {
      alignItems: 'center',
      padding: spacing['4_5'],
      backgroundColor: colors.surface,
      borderColor: colors.dangerDotBorder,
      overflow: 'hidden',
    },
    iconTile: { width: 48, height: 48, borderRadius: radii.md },
  }),
};
