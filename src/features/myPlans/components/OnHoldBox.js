import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../../shared/theme/tokens';
import { ON_HOLD_TAIL } from '../myPlanFormat';

// §M1 / §M3.3: shown on a 403 (chosen by status, never by text).
export default function OnHoldBox({ message }) {
  return (
    <View testID="my-plans-on-hold" accessibilityRole="summary" accessibilityLiveRegion="polite" style={styles.box}>
      <Text style={styles.title}>Your plans are on hold</Text>
      {message ? <Text style={styles.body}>{message}</Text> : null}
      <Text style={styles.body}>{ON_HOLD_TAIL}</Text>
    </View>
  );
}

// Box shared by the on-hold box and M3's "This is your current plan".
export const statusBoxStyles = StyleSheet.create({
  box: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});

const styles = statusBoxStyles;
