import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../theme/tokens';
import PillButton from './PillButton';

// Trainer plans spec §A3.5. Shows "Retry" only when `onRetry` is given.
export default function ErrorAlert({ title, description, onRetry, style, testID }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, description].filter(Boolean).join('. '));
  }, [title, description]);

  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.box, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {onRetry ? (
        <View style={styles.retry}>
          <PillButton title="Retry" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.errorFill,
    padding: 16,
    boxShadow: shadows.soft,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  description: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.errorText,
  },
  retry: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
});
