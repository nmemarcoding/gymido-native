import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { trainerDisplayName } from '../../myTrainer/myTrainerFormat';

// TR1.3: the whole card is one pressable; "View profile" is part of it.
export default function TrainerCard({ trainer, onPress, style }) {
  const name = trainerDisplayName(trainer);
  return (
    <Pressable
      testID={`trainers-card-${trainer.user_id}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, View profile`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      <Text style={styles.eyebrow}>Trainer</Text>
      <Text textBreakStrategy="simple" numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      {trainer.bio ? (
        <Text numberOfLines={3} ellipsizeMode="tail" style={styles.bio}>
          {trainer.bio}
        </Text>
      ) : (
        <Text style={[styles.bio, styles.noBio]}>No bio yet.</Text>
      )}
      <Text style={styles.view}>View profile</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
  },
  cardPressed: {
    borderColor: colors.brandPressedBorder,
    backgroundColor: colors.surfaceMuted,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  name: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  bio: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  noBio: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  view: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
});
