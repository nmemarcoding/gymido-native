import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getServerMessage, getStatus } from '../../../../shared/api/apiError';
import AppModal, { ModalActions, isTabletWidth } from '../../../../shared/components/AppModal';
import EmptyState from '../../../../shared/components/EmptyState';
import ErrorAlert from '../../../../shared/components/ErrorAlert';
import ExerciseImage from '../../../../shared/components/ExerciseImage';
import GlassSurface from '../../../../shared/components/GlassSurface';
import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, CAP_PILL, NAME_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../../shared/components/largeText';
import Loader from '../../../../shared/components/Loader';
import PillButton from '../../../../shared/components/PillButton';
import StatusPill from '../../../../shared/components/StatusPill';
import { convertWeight } from '../../../../shared/format/weight';
import { colors, font, gradients, radii, spacing, typography } from '../../../../shared/theme/tokens';
import { getClientWorkout } from '../api/clientsApi';
import { formatDuration, formatTarget, formatTrainerDateTime, formatVolume, plural } from '../clientFormat';

// The exercise card's image band: phone 104; tablet 130 (first card) / 110.
export const BAND_HEIGHT = Object.freeze({ phone: 104, tabletFirst: 130, tablet: 110 });

// v2 status pill: "completed" → success green ("Completed"); any other status
// is printed as is (first letter capitalised) on the neutral pill.
export function workoutStatusPill(status) {
  const text = String(status ?? '').trim();
  return {
    label: text ? `${text[0].toUpperCase()}${text.slice(1)}` : '',
    tone: text.toLowerCase() === 'completed' ? 'completed' : 'neutral',
  };
}

// RN-SPEC-v2-phase5 §4 VOLUME RULE: only `total_volume_kg`, converted to the
// CLIENT's profile unit (current → goal → kg), "{n} {unit} volume"; absent →
// hidden; never the raw `total_volume`.
export function volumeUnit(profile) {
  return profile?.current_weight_unit || profile?.goal_weight_unit || 'kg';
}

export function workoutVolumeText(workout, profile) {
  const kg = workout?.total_volume_kg;
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) {
    return null;
  }
  const unit = volumeUnit(profile);
  return `${formatVolume(convertWeight(kg, 'kg', unit))} ${unit} volume`;
}

// The set row as one accessible line: "Set 1, 8 reps, target 6-8, 185 lb, done".
export function setAccessibilityLabel(set, target, weight) {
  return [
    `Set ${set.set_number}`,
    `${set.actual_reps ?? 'no'} reps`,
    target !== null && target !== undefined ? `target ${target}` : null,
    weight === '—' ? 'no weight' : weight,
    set.is_completed ? 'done' : 'skipped',
  ]
    .filter(Boolean)
    .join(', ');
}

// C2a (trainer clients spec §C5.1), open while `workoutId` is set.
// Lifecycle pairing: the request starts on the open edge (or an id change)
// and goes stale on close / unmount / id change; stale responses are ignored.
// v2 (UX M §Client workout): `clientName` = the client-name eyebrow on tablet
// (the page passes the name it shows); `profile` = the client's profile, for
// the volume unit.
export default function WorkoutDetailModal({ clientUserId, workoutId, onClose, clientName, profile }) {
  const { width } = useWindowDimensions();
  const tablet = isTabletWidth(width);
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
      // M 3: the client-name eyebrow, tablet only (AppModal `eyebrow`).
      eyebrow={tablet && clientName ? clientName : undefined}
      title="Workout detail"
      description={workout?.started_at ? formatTrainerDateTime(workout.started_at) : 'What your client did in this session.'}
      size="2xl"
      // The board draws the × as well as the footer dismiss (UX, 28 Oct).
      footer={
        // Phone: full width; tablet: the board's Close at the right.
        <ModalActions>
          <PillButton testID="workout-detail-close" title="Close" variant="secondary" style={tablet ? undefined : styles.phoneFooterButton} onPress={onClose} />
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
    const volume = workoutVolumeText(workout, profile);
    const pill = workoutStatusPill(workout?.status);
    // Session detail `workout_plan_day?` (BE): absent for off-plan sessions →
    // no title (the dialog title stays "Workout detail").
    const dayTitle = workout?.workout_plan_day?.title || state.workout_plan_day?.title || null;
    const exercises = state.exercises ?? [];
    return (
      <View style={styles.body}>
        <View testID="workout-detail-summary" style={[styles.summary, tablet && styles.summaryTablet]}>
          {dayTitle && !tablet ? (
            <Text {...TITLE_TEXT} testID="workout-detail-day" style={styles.dayTitle}>
              {dayTitle}
            </Text>
          ) : null}
          {dayTitle && tablet ? (
            <View testID="workout-detail-day" style={styles.dayChip}>
              <Text {...CAP_PILL} style={styles.dayChipText}>
                {dayTitle}
              </Text>
            </View>
          ) : null}
          {pill.label ? <StatusPill testID="workout-detail-status" label={pill.label} tone={pill.tone} compact={!tablet} /> : null}
          {duration ? <Duration text={duration} /> : null}
          {volume ? (
            <Text {...CAP_BODY} testID="workout-detail-volume" style={styles.meta}>
              {volume}
            </Text>
          ) : null}
        </View>
        {workout?.notes ? (
          <View testID="workout-detail-notes" style={styles.notes}>
            <Text {...CAP_BODY} style={styles.notesLabel}>
              Their notes
            </Text>
            <Text {...CAP_BODY} style={styles.notesText}>
              {workout.notes}
            </Text>
          </View>
        ) : null}
        {exercises.length === 0 ? (
          <EmptyState title="No exercises logged" message="They started this workout but didn’t log any exercises." />
        ) : (
          <View style={tablet ? styles.exercisesTablet : styles.exercises}>
            {exercises.map((exercise, index) => (
              <ExerciseBox key={exercise.id ?? index} exercise={exercise} tablet={tablet} first={index === 0} />
            ))}
          </View>
        )}
      </View>
    );
  }
}

// "52 min": the number 20/700 + " min" 14 secondary, tabular; "45s" as one.
function Duration({ text }) {
  const match = /^(\d+)\s*(min)$/.exec(text);
  return (
    <Text {...CAP_BODY} testID="workout-detail-duration" style={styles.durationNumber}>
      {match ? match[1] : text}
      {match ? <Text style={styles.durationUnit}>{` ${match[2]}`}</Text> : null}
    </Text>
  );
}

function Check({ color }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Skip({ color }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M6 12h12" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function ExerciseBox({ exercise, tablet, first }) {
  const sets = exercise.sets ?? [];
  const name = exercise.exercise?.name || exercise.exercise_name_snapshot || 'Exercise';
  const band = tablet ? (first ? BAND_HEIGHT.tabletFirst : BAND_HEIGHT.tablet) : BAND_HEIGHT.phone;
  const setCount = `${sets.length} ${plural(sets.length, 'set', 'sets')}`;
  return (
    <View testID={`workout-detail-exercise-${exercise.id}`} style={styles.exercise}>
      {/* Exercise photo (BE: exercises[].exercise.thumbnail.url), else the
          §8.1 tile; never an empty frame. Alt is empty: the name sits on it. */}
      <ExerciseImage
        testID={`workout-detail-image-${exercise.id}`}
        exercise={exercise.exercise}
        name={name}
        size={band}
        accessibilityLabel=""
        style={[styles.band, { height: band }]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GradientFill angle={gradients.surfaceFade.angle} colors={gradients.surfaceFade.colors} />
        </View>
        <View style={[styles.bandText, tablet && styles.bandTextTablet]}>
          <Text {...NAME_TITLE_TEXT} style={tablet ? styles.exerciseNameTablet : styles.exerciseName}>
            {name}
          </Text>
          {tablet ? (
            <Text {...CAP_BODY} style={styles.setCountTablet}>
              {setCount}
            </Text>
          ) : (
            <GlassSurface tone="onPhoto" solid shadow={false} radius={radii.full} style={styles.setChip}>
              <Text {...CAP_PILL} style={styles.setChipText}>
                {setCount}
              </Text>
            </GlassSurface>
          )}
        </View>
      </ExerciseImage>
      <View style={[styles.exerciseBody, tablet && styles.exerciseBodyTablet]}>
        {exercise.notes ? (
          <Text {...CAP_BODY} style={[styles.exerciseNotes, tablet && styles.exerciseNotesTablet]}>
            {exercise.notes}
          </Text>
        ) : null}
        {sets.length === 0 ? (
          <Text {...CAP_BODY} style={styles.noSets}>
            No sets logged.
          </Text>
        ) : (
          <View style={styles.sets}>
            {sets.map((set, index) => (
              <SetRow key={set.id ?? index} set={set} tablet={tablet} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function SetRow({ set, tablet }) {
  const stacked = useLargeTextReflow();
  const target = formatTarget(set.target_reps_min, set.target_reps_max);
  const weight =
    set.actual_weight_value != null ? `${set.actual_weight_value} ${set.actual_weight_unit || set.target_weight_unit || ''}`.trim() : '—';
  const done = Boolean(set.is_completed);
  const cols = tablet ? COLS.tablet : COLS.phone;
  return (
    <View
      testID={`workout-detail-set-${set.id ?? set.set_number}`}
      accessible
      accessibilityLabel={setAccessibilityLabel(set, target, weight)}
      style={[styles.setRow, tablet && styles.setRowTablet, stacked && styles.setRowStacked]}
    >
      <Text {...CAP_BODY} style={[styles.setCell, styles.setNumber, tablet && styles.setCellTablet, !stacked && { width: cols.number }]}>
        #{set.set_number}
      </Text>
      <Text {...CAP_BODY} style={[styles.setCell, tablet && styles.setCellTablet, tablet && styles.reps, styles.setFlex]}>
        {set.actual_reps ?? '—'} reps
        {target !== null && target !== undefined ? <Text style={styles.target}> / {target} target</Text> : null}
      </Text>
      <Text {...CAP_BODY} style={[styles.setCell, styles.weight, tablet && styles.setCellTablet, !stacked && { width: cols.weight }]}>
        {weight}
      </Text>
      <View style={[styles.result, !stacked && { width: cols.result }]}>
        {tablet ? (
          <View style={[styles.resultPill, done ? styles.resultPillDone : styles.resultPillSkipped]}>
            {done ? <Check color={colors.success} /> : <Skip color={colors.textSecondary} />}
            <Text {...CAP_PILL} style={done ? styles.done : styles.skipped}>
              {done ? 'Done' : 'Skipped'}
            </Text>
          </View>
        ) : (
          <View style={styles.resultInline}>
            {done ? <Check color={colors.success} /> : <Skip color={colors.textSecondary} />}
            <Text {...CAP_PILL} style={done ? styles.done : styles.skipped}>
              {done ? 'Done' : 'Skipped'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Set row grid (UX M): phone 32 | 1fr | 76 | 72; tablet 40 | 1fr | 96 | 92.
const COLS = Object.freeze({
  phone: Object.freeze({ number: 32, weight: 76, result: 72 }),
  tablet: Object.freeze({ number: 40, weight: 96, result: 92 }),
});

const styles = StyleSheet.create({
  // RN-SPEC-v2-phase5 §4: phone footer buttons 56.
  phoneFooterButton: {
    minHeight: 56,
  },
  loader: {
    paddingVertical: 40,
  },
  body: {
    gap: spacing['3_5'],
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['2_5'],
  },
  summaryTablet: {
    gap: spacing[2],
  },
  dayTitle: {
    ...font(700),
    flexShrink: 1,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.12,
    color: colors.textPrimary,
  },
  dayChip: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.full,
    backgroundColor: colors.fillButton,
  },
  dayChipText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  durationNumber: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  durationUnit: {
    ...font(400),
    fontSize: 14,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.bodySm,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  // "Their notes": radius 20, color-fill-subtle (0.07 = the fillSkeleton value).
  notes: {
    borderRadius: radii.lg,
    backgroundColor: colors.fillSkeleton,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  notesLabel: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  notesText: {
    ...font(400),
    marginTop: spacing['1_5'],
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  exercises: {
    gap: spacing['2_5'],
  },
  exercisesTablet: {
    marginTop: spacing['1_5'],
    gap: spacing[3],
  },
  // The drawn radius 26 folds to radii.xl 24 (UX M fold note).
  exercise: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingBottom: spacing['3_5'],
  },
  band: {
    width: '100%',
    borderRadius: 0,
  },
  bandText: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  bandTextTablet: {
    left: spacing['4_5'],
    right: spacing['4_5'],
    bottom: spacing[3],
  },
  exerciseName: {
    ...font(700),
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  exerciseNameTablet: {
    ...typography.titleMd,
    flexShrink: 1,
    color: colors.textPrimary,
  },
  setChip: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: spacing['2_5'],
    borderWidth: 0,
  },
  setChipText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  setCountTablet: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong2,
  },
  exerciseBody: {
    paddingHorizontal: spacing['3_5'],
  },
  exerciseBodyTablet: {
    paddingTop: spacing[3],
    gap: spacing['1_5'],
  },
  exerciseNotes: {
    ...typography.label,
    ...font(400),
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  exerciseNotesTablet: {
    marginTop: 0,
    fontSize: 14,
    lineHeight: 22,
  },
  noSets: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.textMuted,
  },
  sets: {
    marginTop: spacing['2_5'],
    gap: spacing['1_5'],
  },
  // The drawn radius 14 folds to radii.md 16 (tokens §3).
  setRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.md,
    backgroundColor: colors.fillChip,
  },
  setRowTablet: {
    gap: spacing['2_5'],
    paddingVertical: spacing['2_5'],
    paddingHorizontal: spacing['3_5'],
    backgroundColor: colors.fillWell,
  },
  // UX §9 rule 4: past 1.3× the cells wrap instead of squeezing.
  setRowStacked: {
    flexWrap: 'wrap',
    columnGap: spacing[3],
    paddingVertical: spacing[2],
  },
  setCell: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  setCellTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
  setNumber: {
    ...font(700),
  },
  reps: {
    ...font(600),
  },
  setFlex: {
    flex: 1,
    minWidth: 0,
  },
  target: {
    ...font(400),
    color: colors.textFaint,
  },
  weight: {
    color: colors.textStrong2,
  },
  result: {
    alignItems: 'flex-end',
  },
  resultInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minHeight: 26,
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
  },
  resultPillDone: {
    backgroundColor: colors.successTint,
  },
  resultPillSkipped: {
    backgroundColor: colors.fillSkeleton,
  },
  done: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.success,
  },
  skipped: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
