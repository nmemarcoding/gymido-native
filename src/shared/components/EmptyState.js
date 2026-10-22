import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../theme/tokens';
import PillButton from './PillButton';

// Trainer plans spec §A3.5. With `actionLabel` (trainer clients spec) a
// secondary button follows, mt 20.
export default function EmptyState({ title, message, actionLabel, onAction, actionTestID, style }) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel ? (
        <View style={styles.action}>
          <PillButton testID={actionTestID} title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  action: {
    marginTop: 20,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
