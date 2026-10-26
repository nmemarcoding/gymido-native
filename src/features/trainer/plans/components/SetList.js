import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../../shared/theme/tokens';
import { exerciseName, formatSetSummary } from '../planFormat';

// The set lines of an exercise (spec §A5.6) with the Part B per-set
// Edit / Delete text buttons (§B8).
export default function SetList({ exercise, sets, capabilities, onEditSet, onDeleteSet }) {
  if (sets.length === 0) {
    return null;
  }
  const name = exerciseName(exercise);
  const hasControls = capabilities.editSet || capabilities.deleteSet;

  return (
    <View style={styles.sets}>
      {sets.map((set) => (
        <View key={set.id} testID={`plan-set-${set.id}`} style={styles.setRow}>
          <Text style={styles.setNumber}>Set {set.set_number}</Text>
          <Text style={styles.setSummary}>{formatSetSummary(set)}</Text>
          {hasControls ? (
            <View style={styles.controls}>
              {capabilities.editSet ? (
                <TextButton
                  testID={`plan-set-edit-${set.id}`}
                  label="Edit"
                  accessibilityLabel={`Edit set ${set.set_number} of ${name}`}
                  color={colors.brand700}
                  onPress={() => onEditSet(exercise, set)}
                />
              ) : null}
              {capabilities.deleteSet ? (
                <TextButton
                  testID={`plan-set-delete-${set.id}`}
                  label="Delete"
                  accessibilityLabel={`Delete set ${set.set_number} of ${name}`}
                  color={colors.danger700}
                  onPress={() => onDeleteSet(exercise, set)}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TextButton({ label, accessibilityLabel, color, onPress, testID }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={6}>
      {({ pressed }) => (
        <Text style={[styles.textButton, { color }, pressed && styles.textButtonPressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sets: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setNumber: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  setSummary: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  controls: {
    marginLeft: 'auto',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  textButton: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  textButtonPressed: {
    textDecorationLine: 'underline',
  },
});
