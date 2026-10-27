import { StyleSheet, Text, View } from 'react-native';

import PillButton from '../../../../shared/components/PillButton';
import { colors, radii, shadows } from '../../../../shared/theme/tokens';
import { exerciseName, formatExerciseSummary } from '../planFormat';
import SetList from './SetList';

// Spec §A5.6: the exercise list when `reorderExercises` is off.
export default function StaticExerciseList({ exercises, setsByExercise, capabilities, onAddSet, onEditSet, onDeleteSet }) {
  return (
    <View style={styles.list}>
      {exercises.map((exercise) => {
        const sets = setsByExercise[exercise.id] ?? [];
        return (
          <View key={exercise.id} testID={`plan-exercise-${exercise.id}`} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.left}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
                  {exerciseName(exercise)}
                </Text>
                <Text style={styles.summary}>{formatExerciseSummary(exercise)}</Text>
              </View>
              {capabilities.addSet ? (
                <View style={styles.actions}>
                  <PillButton
                    testID={`plan-exercise-add-set-${exercise.id}`}
                    title="Add set"
                    variant="secondary"
                    onPress={() => onAddSet(exercise)}
                  />
                </View>
              ) : null}
            </View>
            <SetList
              exercise={exercise}
              sets={sets}
              capabilities={capabilities}
              onEditSet={onEditSet}
              onDeleteSet={onDeleteSet}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summary: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
