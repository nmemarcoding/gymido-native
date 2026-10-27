import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, gradients, layout, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import GradientFill from './GradientFill';
import { CAP_BODY, useLargeTextReflow } from './largeText';

// RN-SPEC-v2-phase2 §D1 Ruling 2: ONE Retry style everywhere: glass secondary
// (white 8 % + 1 px white 12 %), 38 visual with a 44 hit area, 14/600
// (FINAL-AUDIT "Rulings for FE batch 1": Retry 38, 44 hit).
// Loading: the label stays, disabled at 0.5, busy. Used by ErrorAlert and the
// Workout whole-page "Try again".
export const RETRY_HEIGHT = 38;
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

// RN-SPEC-v2-foundation §5 (inline; what loaded stays) + FINAL-AUDIT
// "Rulings for FE batch 1" (2026-10-27): ONE ErrorAlert look app-wide (web +
// native). Radius 24, the gradient card (160°, gradients.card), a 1 px
// danger line (0.30), padding 20; a dangerTint icon tile, the failed part as
// the title, the message 14/20 secondary, and the glass Retry (38, 44 hit)
// UNDER the text, only when `onRetry` is given (never for save failures).
// Role alert, announced on mount. The old `variant` prop (compact /
// generator) is retired: it is accepted and ignored, so every caller draws
// the one look. `retrying` shows the Retry's loading state; `retryTestID`
// names it.
export default function ErrorAlert({ title, description, onRetry, retrying = false, retryTestID, style, testID, ref }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, description].filter(Boolean).join('. '));
  }, [title, description]);

  // UX §9 rule 4: past 1.3× the Retry takes the text column's full width.
  const stacked = useLargeTextReflow();

  return (
    <View ref={ref} testID={testID} accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.box, style]}>
      {/* Mounted with the card (never added on a state change); SVG. */}
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <View testID="error-alert-icon" style={styles.iconTile}>
        <FeedbackIcon name="error" size={18} color={colors.dangerText} />
      </View>
      <View testID="error-alert-text" style={styles.text}>
        {title ? <Text {...CAP_BODY} style={styles.title}>{title}</Text> : null}
        {description ? <Text {...CAP_BODY} style={styles.description}>{description}</Text> : null}
        {onRetry ? <RetryButton title="Retry" testID={retryTestID} onPress={onRetry} loading={retrying} style={[styles.retry, stacked && styles.retryStacked]} /> : null}
      </View>
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
    borderColor: colors.dangerLine,
    // Under the gradient until it has measured (its end stop's neighbour).
    backgroundColor: colors.surface,
    overflow: 'hidden',
    padding: spacing[5],
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerTint,
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
  description: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing[3],
  },
  retryStacked: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
