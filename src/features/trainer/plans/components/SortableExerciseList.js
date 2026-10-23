import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NestableDraggableFlatList } from 'react-native-draggable-flatlist';

import PillButton from '../../../../shared/components/PillButton';
import { breakpoints, colors, radii, shadows } from '../../../../shared/theme/tokens';
import { formatExerciseSummary } from '../planFormat';
import ExerciseThumb from './ExerciseThumb';
import SetList from './SetList';

// E7 (spec §B7). Only the grip starts a drag: a touch on it arms the drag,
// which begins once the finger moves 6 px; touches elsewhere scroll the page.
// The grip also offers "Move up" / "Move down" accessibility actions. Every
// drop goes through `onMove(from, to)`.
export default function SortableExerciseList({
  exercises,
  setsByExercise,
  capabilities,
  onMove,
  onAddSet,
  onDeleteExercise,
  onEditSet,
  onDeleteSet,
}) {
  return (
    <View>
      <Text style={styles.hint}>Drag the grip handle to reorder exercises.</Text>
      <NestableDraggableFlatList
        data={exercises}
        keyExtractor={(exercise) => String(exercise.id)}
        activationDistance={6}
        ItemSeparatorComponent={Separator}
        onDragEnd={({ from, to }) => onMove(from, to)}
        renderItem={({ item, drag, isActive }) => (
          <SortableRow
            exercise={item}
            index={exercises.findIndex((exercise) => exercise.id === item.id)}
            count={exercises.length}
            sets={setsByExercise[item.id] ?? []}
            capabilities={capabilities}
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

function SortableRow({
  exercise,
  index,
  count,
  sets,
  capabilities,
  isActive,
  drag,
  onMove,
  onAddSet,
  onDeleteExercise,
  onEditSet,
  onDeleteSet,
}) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  // ⚠B-6: no "Exercise #id" fallback here, so a nameless row reads "undefined".
  const name = exercise.exercise?.name || exercise.name;

  return (
    <View testID={`plan-exercise-${exercise.id}`} style={[styles.row, isActive && styles.rowActive]}>
      <View style={wide ? styles.mainWide : styles.mainPhone}>
        <View style={styles.left}>
          <Pressable
            testID={`plan-exercise-grip-${exercise.id}`}
            onPressIn={drag}
            accessibilityRole="adjustable"
            accessibilityLabel={`Drag to reorder ${name}`}
            accessibilityActions={[
              { name: 'moveUp', label: 'Move up' },
              { name: 'moveDown', label: 'Move down' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'moveUp' && index > 0) {
                onMove(index, index - 1);
              } else if (event.nativeEvent.actionName === 'moveDown' && index < count - 1) {
                onMove(index, index + 1);
              }
            }}
            style={styles.grip}
          >
            <Text style={styles.gripText}>⠿</Text>
          </Pressable>
          <Text style={styles.badge}>{index + 1}</Text>
          <RowThumb exercise={exercise} />
          <View style={styles.text}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
              {name}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.summary}>
              {formatExerciseSummary(exercise)}
            </Text>
          </View>
        </View>
        {capabilities.addSet || capabilities.deleteExercise ? (
          <View style={styles.actions}>
            {capabilities.addSet ? (
              <PillButton
                testID={`plan-exercise-add-set-${exercise.id}`}
                title="Add set"
                variant="secondary"
                onPress={() => onAddSet(exercise)}
              />
            ) : null}
            {capabilities.deleteExercise ? (
              <PillButton
                testID={`plan-exercise-delete-${exercise.id}`}
                title="Delete"
                variant="danger"
                onPress={() => onDeleteExercise(exercise)}
              />
            ) : null}
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
}

// 56×56: the exercise thumbnail, else a tile with the muscle code's first
// three characters (or "EX").
function RowThumb({ exercise }) {
  if (exercise.exercise?.thumbnail?.url) {
    return (
      <View style={styles.thumbFrame}>
        <ExerciseThumb exercise={exercise.exercise} size={56} framed={false} />
      </View>
    );
  }
  const code = exercise.exercise?.primary_muscle_group?.code;
  return (
    <View style={[styles.thumbFrame, styles.thumbTile]}>
      <Text numberOfLines={1} textBreakStrategy="simple" style={styles.thumbText}>{code ? code.slice(0, 3) : 'EX'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  separator: {
    height: 12,
  },
  row: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 16,
  },
  rowActive: {
    zIndex: 1,
    opacity: 0.8,
    boxShadow: shadows.soft,
  },
  mainPhone: {
    flexDirection: 'column',
    gap: 12,
  },
  mainWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    flexShrink: 1,
  },
  grip: {
    flexShrink: 0,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  gripText: {
    fontSize: 16,
    lineHeight: 16,
    color: colors.textMuted,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  thumbFrame: {
    width: 56,
    height: 56,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    backgroundColor: colors.background,
    boxShadow: shadows.insetSoft,
  },
  thumbTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summary: {
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
