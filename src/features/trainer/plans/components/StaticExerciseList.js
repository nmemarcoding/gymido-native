import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { exerciseName, formatExerciseSummary } from '../planFormat';
import { positionLabel } from './ExerciseCard';
import SetList from './SetList';

// Spec §A5.6: the exercise list when `reorderExercises` is off (a catalog
// plan, or an add-only own plan). v2 look (phase6 O, catalog view): a
// surface card, name 14/700, summary 14 secondary, the set rows; a list
// whose names read "exercise n of N".
export default function StaticExerciseList({ exercises, setsByExercise, capabilities, onAddSet, onEditSet, onDeleteSet }) {
  return (
    <View testID="plan-exercise-list" accessibilityRole="list" style={styles.list}>
      {exercises.map((exercise, index) => {
        const sets = setsByExercise[exercise.id] ?? [];
        const name = exerciseName(exercise);
        return (
          <View key={exercise.id} testID={`plan-exercise-${exercise.id}`} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.left}>
                <Text {...CAP_BODY} accessibilityLabel={positionLabel(name, index, exercises.length)} style={styles.name}>
                  {name}
                </Text>
                <Text {...CAP_BODY} style={styles.summary}>
                  {formatExerciseSummary(exercise)}
                </Text>
              </View>
              {capabilities.addSet ? (
                <PillButton
                  testID={`plan-exercise-add-set-${exercise.id}`}
                  title="Add set"
                  variant="secondary"
                  size="compact"
                  onPress={() => onAddSet(exercise)}
                />
              ) : null}
            </View>
            <SetList exercise={exercise} sets={sets} capabilities={capabilities} divided onEditSet={onEditSet} onDeleteSet={onDeleteSet} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing[3],
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  left: {
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  summary: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
