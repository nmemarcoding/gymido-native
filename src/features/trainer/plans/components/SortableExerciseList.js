import { StyleSheet, View } from 'react-native';
import { NestableDraggableFlatList } from 'react-native-draggable-flatlist';

import { spacing } from '../../../../shared/theme/tokens';
import ExerciseCard from './ExerciseCard';

// E7 (spec §B7). Only the grip starts a drag: a touch on it arms the drag,
// which begins once the finger moves 6 px; touches elsewhere scroll the page.
// The grip also offers "Move up" / "Move down" accessibility actions. Every
// drop goes through `onMove(from, to)`. The rows are a list; each name reads
// "exercise n of N" (a11y ruling, 27 Oct). The helper line lives with the
// section head (PlanScreen). v2 cards: ExerciseCard.
export default function SortableExerciseList({
  exercises,
  setsByExercise,
  capabilities,
  look = 'member',
  setsToggle = false,
  onMove,
  onAddSet,
  onDeleteExercise,
  onEditSet,
  onDeleteSet,
}) {
  return (
    <View testID="plan-exercise-list" accessibilityRole="list">
      <NestableDraggableFlatList
        data={exercises}
        keyExtractor={(exercise) => String(exercise.id)}
        activationDistance={6}
        ItemSeparatorComponent={Separator}
        onDragEnd={({ from, to }) => onMove(from, to)}
        renderItem={({ item, drag, isActive }) => (
          <ExerciseCard
            exercise={item}
            // ⚠B-6: no "Exercise #id" fallback here, so a nameless row reads "undefined".
            name={item.exercise?.name || item.name}
            index={exercises.findIndex((exercise) => exercise.id === item.id)}
            count={exercises.length}
            sets={setsByExercise[item.id] ?? []}
            capabilities={capabilities}
            look={look}
            setsToggle={setsToggle}
            isActive={isActive}
            drag={drag}
            onMove={onMove}
            onAddSet={onAddSet}
            onDeleteExercise={onDeleteExercise}
            onEditSet={onEditSet}
            onDeleteSet={onDeleteSet}
          />
        )}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  separator: {
    height: spacing[3],
  },
});
