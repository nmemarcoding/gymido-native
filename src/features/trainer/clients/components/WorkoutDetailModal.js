import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import { colors, radii } from '../../../../shared/theme/tokens';
import { getClientWorkout } from '../api/clientsApi';
import { formatDuration, formatTarget, formatTrainerDateTime, formatVolume, plural } from '../clientFormat';
import { TrainerStatusBadge } from './ClientsUi';

// C2a (trainer clients spec §C5.1), open while `workoutId` is set.
// Lifecycle pairing: the request starts on the open edge (or an id change)
// and goes stale on close / unmount / id change; stale responses are ignored.
export default function WorkoutDetailModal({ clientUserId, workoutId, onClose }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (workoutId === null) {
      return undefined;
    }
    let current = true;
    setState({ status: 'loading' });
    getClientWorkout(clientUserId, workoutId)
      .then((result) => current && setState({ status: 'loaded', ...result }))
      .catch((failure) => {
        if (current) {
          const message = getStatus(failure) === 404 ? 'This workout is no longer available.' : getServerMessage(failure);
          setState({ status: 'error', message });
        }
      });
    return () => {
      current = false;
    };
  }, [clientUserId, workoutId]);

  const workout = state.status === 'loaded' ? state.workout : null;

  return (
    <AppModal
      testID="workout-detail-modal"
      isOpen={workoutId !== null}
      onClose={onClose}
      title="Workout detail"
      description={workout?.started_at ? formatTrainerDateTime(workout.started_at) : 'What your client did in this session.'}
      size="2xl"
      footer={
        // Phone: full width; tablet: the board's Close at the right.
        <ModalActions>
          <PillButton testID="workout-detail-close" title="Close" variant="secondary" onPress={onClose} />
        </ModalActions>
      }
    >
      {renderBody()}
    </AppModal>
  );

  function renderBody() {
    if (state.status === 'loading') {
      return <Loader label="Loading workout" style={styles.loader} />;
    }
    if (state.status === 'error') {
      return <ErrorAlert title="Could not load this workout" description={state.message} />;
    }
    const duration = formatDuration(workout?.duration_seconds);
    return (
      <View style={styles.body}>
        <View style={styles.summary}>
          <TrainerStatusBadge status={workout?.status === 'completed' ? 'active' : 'pending'} label={workout?.status} />
          {duration ? <Text style={styles.meta}>{duration}</Text> : null}
          {workout?.total_volume != null ? <Text style={styles.meta}>{formatVolume(workout.total_volume)} volume</Text> : null}
        </View>
        {workout?.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Their notes</Text>
            <Text style={styles.notesText}>{workout.notes}</Text>
          </View>
        ) : null}
        {state.exercises.length === 0 ? (
          <EmptyState title="No exercises logged" message="They started this workout but didn’t log any exercises." />
        ) : (
          <View style={styles.exercises}>
            {state.exercises.map((exercise) => (
              <ExerciseBox key={exercise.id} exercise={exercise} />
            ))}
          </View>
        )}
      </View>
    );
  }
}

function ExerciseBox({ exercise }) {
  const sets = exercise.sets ?? [];
  return (
    <View style={styles.exercise}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.exercise?.name || exercise.exercise_name_snapshot || 'Exercise'}</Text>
        <Text style={styles.setCount}>
          {sets.length} {plural(sets.length, 'set', 'sets')}
        </Text>
      </View>
      {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
      {sets.length === 0 ? (
        <Text style={styles.noSets}>No sets logged.</Text>
      ) : (
        <View style={styles.sets}>
          {sets.map((set, index) => {
            const target = formatTarget(set.target_reps_min, set.target_reps_max);
            const weight =
              set.actual_weight_value != null
                ? `${set.actual_weight_value} ${set.actual_weight_unit || set.target_weight_unit || ''}`.trim()
                : '—';
            return (
              <View key={set.id ?? index} style={[styles.setRow, index > 0 && styles.setDivider]}>
                <Text style={[styles.setCell, styles.setNumber]}>#{set.set_number}</Text>
                <Text style={[styles.setCell, styles.setFlex]}>
                  {set.actual_reps ?? '—'} reps
                  {target !== null && target !== undefined ? <Text style={styles.muted}> / {target} target</Text> : null}
                </Text>
                <Text style={[styles.setCell, styles.setFlex]}>{weight}</Text>
                <Text style={set.is_completed ? styles.done : styles.skipped}>{set.is_completed ? 'Done' : 'Skipped'}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 40,
  },
  body: {
    gap: 20,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  meta: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  notes: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  notesLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  notesText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  exercises: {
    gap: 12,
  },
  exercise: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  setCount: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  exerciseNotes: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  noSets: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  sets: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  setDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setCell: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  setNumber: {
    width: 48,
    fontWeight: '700',
  },
  setFlex: {
    flex: 1,
  },
  muted: {
    color: colors.textMuted,
  },
  done: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.success700,
  },
  skipped: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
