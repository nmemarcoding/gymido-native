import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import PillButton from './PillButton';

// RN-SPEC-v2-foundation §5 (inline; what loaded stays): a card in the danger
// tint, a 36 px icon tile, the failed part as the title, the server text
// under it, and a compact glass "Retry" at the right only when `onRetry` is
// given (never for save failures). Role alert.
export default function ErrorAlert({ title, description, onRetry, style, testID }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, description].filter(Boolean).join('. '));
  }, [title, description]);

  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.box, style]}>
      <View style={styles.iconTile}>
        <FeedbackIcon name="error" size={18} color={colors.dangerText} />
      </View>
      <View style={styles.text}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {onRetry ? (
        <View style={styles.retry}>
          {/* Default size until PillButton has the 38 px compact size with a
              44 hit area (its own restyle); "small" today is under 44. */}
          <PillButton title="Retry" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
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
  description: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  retry: {
    flexShrink: 0,
    alignSelf: 'center',
  },
});
