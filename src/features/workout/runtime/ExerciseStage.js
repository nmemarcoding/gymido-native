import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import GradientFill from '../../../shared/components/GradientFill';


import { useLayoutMetrics } from '../../../navigation/shell/layoutMetrics';
import Select from '../../../shared/components/form/Select';
import { colors, radii, shadows, textStyles } from '../../../shared/theme/tokens';
import { ColorPressable } from '../../plans/components/PlanBits';
import ProgressRing, { ringLabelStyles } from '../components/ProgressRing';
import { hubStyles, PRESS_SHADOW, SHADOW_BRAND, SHADOW_EMBOSS } from '../components/hubChrome';
import { SET_KEY, exerciseName, repsLabel } from './runtimeRules';
import { useSessionRowScroll } from './SessionShell';

// Fixed control sizes (§19.3). The gradient fills take these explicitly because
// react-native-svg on Android will not size itself from layout.
const BADGE_SIZE = 32;
const ACTION_WIDTH = 112;
const ACTION_HEIGHT = 48;

const WEIGHT_UNITS = [
  { label: 'lb', value: 'lb' },
  { label: 'kg', value: 'kg' },
];

// SetRow (§19.3). Exactly one number input and one select per row; the action
// button's accessible name is "Did it" / "Undo" / "Saving…".
export function SetRow({
  set,
  exerciseId,
  draft,
  isNext,
  isHighlighted,
  isPending,
  isLocked,
  lockReason,
  validationError,
  onChangeDraft,
  onToggle,
}) {
  // §19.3: the weight input's minimum widens from 96 to 112 at ≥640.
  const { gutter } = useLayoutMetrics();
  // §22.3: the auto-scroll target is the whole row, measured, not the input.
  const rowRef = useSessionRowScroll(SET_KEY(exerciseId, set.id));
  const completed = Boolean(set.is_completed);
  const state = completed ? 'completed' : isNext ? 'next' : 'other';
  const label = isPending ? 'Saving…' : completed ? 'Undo' : 'Did it';

  return (
    <View
      ref={rowRef}
      collapsable={false}
      testID={`set-row-${exerciseId}:${set.id}`}
      style={[styles.row, styles[`row_${state}`], isHighlighted && styles.rowHighlighted]}
    >
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <View style={[styles.badge, styles[`badge_${state}`]]}>
            {/* SVG, not a CSS background: this view GAINS its gradient the
                instant the row flips to "next", the zero-sized-draw hazard that
                crashed the app at every rest-zero (app-shell §1.0). */}
            {isNext && !completed ? (
              <GradientFill
                id={`set-badge-${set.id}`}
                width={BADGE_SIZE}
                height={BADGE_SIZE}
                radius={BADGE_SIZE / 2}
                colors={['#f7ce4f', '#dda000']}
                direction="diagonal"
              />
            ) : null}
            {completed ? (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6 9 17l-5-5"
                  stroke={colors.brand700}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : (
              <Text style={[styles.badgeText, styles.aboveFill, isNext && styles.badgeTextNext]}>
                {set.set_number}
              </Text>
            )}
          </View>
          <View style={styles.headColumn}>
            <Text style={styles.reps}>{repsLabel(set)}</Text>
            <Text style={styles.meta}>
              {`Rest ${set.rest_seconds_planned || 0}s${isNext ? ' · Up next' : ''}`}
            </Text>
          </View>
        </View>
        {completed ? <Text style={styles.done}>Done</Text> : null}
      </View>

      <View style={styles.controls}>
        <TextInput
          testID={`set-weight-${set.id}`}
          accessibilityLabel={`Weight for set ${set.set_number}`}
          accessibilityState={validationError ? { invalid: true } : undefined}
          value={draft?.actualWeightValue === undefined || draft?.actualWeightValue === null ? '' : String(draft.actualWeightValue)}
          onChangeText={(text) => onChangeDraft({ actualWeightValue: text })}
          placeholder={set.target_weight_value !== undefined && set.target_weight_value !== null ? String(set.target_weight_value) : '0'}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={[styles.weight, gutter === 20 && styles.weightWide, validationError && styles.weightError]}
        />
        <View style={styles.unit}>
          <Select
            testID={`set-unit-${set.id}`}
            label={`Weight unit for set ${set.set_number}`}
            hideLabel
            boxStyle={styles.unitBox}
            textStyle={styles.unitText}
            value={draft?.actualWeightUnit || 'lb'}
            options={WEIGHT_UNITS}
            onChangeValue={(unit) => onChangeDraft({ actualWeightUnit: unit })}
          />
        </View>
        <ColorPressable
          testID={`set-action-${set.id}`}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: isPending || isLocked, busy: isPending }}
          accessibilityHint={isLocked ? lockReason : undefined}
          disabled={isPending || isLocked}
          onPress={onToggle}
          colorsFor={() => ({
            backgroundColor: completed ? colors.surface : isLocked ? colors.surfaceMuted : 'rgba(0,0,0,0)',
          })}
          style={({ pressed }) => [
            styles.action,
            completed && styles.actionCompleted,
            isLocked && styles.actionLocked,
            !completed && !isLocked && styles.actionPrimary,
            (isPending || isLocked) && styles.actionDisabled,
            pressed && !isPending && !isLocked && styles.sunk,
          ]}
        >
          {!completed && !isLocked ? (
            <GradientFill
              id={`set-action-${set.id}`}
              width={ACTION_WIDTH}
              height={ACTION_HEIGHT}
              radius={radii.xl}
              colors={['#f7ce4f', '#f4b400']}
              direction="vertical"
            />
          ) : null}
          <Text
            style={[
              styles.actionLabel,
              styles.aboveFill,
              completed && styles.actionLabelDone,
              isLocked && styles.actionLabelLocked,
            ]}
          >
            {label}
          </Text>
        </ColorPressable>
      </View>

      {validationError ? (
        <Text testID={`weight-error-${set.id}`} style={styles.validationError}>
          {validationError}
        </Text>
      ) : null}
    </View>
  );
}

// ExerciseStage (§19.2).
export default function ExerciseStage({ exercise, index, total, isActiveExercise, children }) {
  const [imageFailed, setImageFailed] = useState(false);
  const sets = exercise?.sets || [];
  const done = sets.filter((set) => set.is_completed).length;
  const muscle = exercise?.exercise?.primary_muscle_group?.name;
  const thumbnail = exercise?.exercise?.thumbnail?.url;

  return (
    <View testID="exercise-stage" style={[hubStyles.card3d, styles.stage]}>
      <View style={styles.stageHead}>
        <View style={styles.stageColumn}>
          <Text style={styles.eyebrow}>
            {isActiveExercise ? 'Current exercise' : `Exercise ${index + 1} of ${total}`}
          </Text>
          <Text style={styles.name}>{exerciseName(exercise)}</Text>
          {muscle ? (
            <View style={styles.muscleChip}>
              <Text style={styles.muscleLabel}>{muscle}</Text>
            </View>
          ) : null}
        </View>
        <ProgressRing
          value={done}
          total={sets.length}
          size={56}
          thickness={8}
          label={`${done} of ${sets.length} sets done`}
        >
          <Text style={ringLabelStyles.fraction}>{`${done}/${sets.length}`}</Text>
        </ProgressRing>
      </View>

      {thumbnail && !imageFailed ? (
        <View style={styles.mediaWell}>
          <Image
            source={{ uri: thumbnail }}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
            style={styles.media}
          />
        </View>
      ) : null}

      <View style={styles.setList}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
  },
  row_completed: {
    borderColor: colors.border,
    backgroundColor: 'rgba(239,241,244,0.40)',
    boxShadow: SHADOW_EMBOSS,
  },
  row_next: {
    borderColor: 'rgba(244,180,0,0.70)',
    backgroundColor: colors.surface,
    boxShadow: '0 2px 4px rgba(17,24,39,0.05), 0 12px 28px -6px rgba(17,24,39,0.10)',
  },
  row_other: {
    borderColor: colors.border,
    backgroundColor: 'rgba(239,241,244,0.50)',
    boxShadow: PRESS_SHADOW,
  },
  rowHighlighted: {
    borderWidth: 2,
    borderColor: 'rgba(244,180,0,0.60)',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge_next: {
    boxShadow: shadows.lift1,
  },
  badge_completed: {
    backgroundColor: '#fcefc4',
    boxShadow: SHADOW_EMBOSS,
  },
  badge_other: {
    backgroundColor: colors.surfaceMuted,
    boxShadow: PRESS_SHADOW,
  },
  badgeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.textSecondary,
  },
  badgeTextNext: {
    color: colors.navy,
  },
  headColumn: {
    flexShrink: 1,
  },
  reps: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  done: {
    fontSize: 10.4,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.26,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  controls: {
    marginTop: 12,
    flexDirection: 'row',
    // All three controls are 48 high (§19.3); centring keeps them aligned even
    // if a platform sizes the select's text differently.
    alignItems: 'center',
    gap: 8,
  },
  weight: {
    flex: 1,
    minWidth: 96,
    height: 48,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    boxShadow: PRESS_SHADOW,
  },
  weightWide: {
    minWidth: 112,
  },
  weightError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
    color: '#ef4444',
  },
  // §19.3: 40, measured from the web (a select sizes to its widest option, and
  // "lb"/"kg" both come out at 39). The earlier 92 overflowed the row's 294pt
  // budget on a 390pt phone and pushed the action button past the card's 12
  // padding — the "sticks to the border" the device review saw.
  unit: {
    width: 40,
  },
  unitBox: {
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 0,
    justifyContent: 'center',
    boxShadow: PRESS_SHADOW,
  },
  unitText: {
    fontWeight: '700',
  },
  action: {
    height: ACTION_HEIGHT,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
  },
  actionPrimary: {
    boxShadow: SHADOW_BRAND,
  },
  actionCompleted: {
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: shadows.lift1,
  },
  actionLocked: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  sunk: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  // GradientFill is a native SVG view; content sits explicitly above it.
  aboveFill: {
    zIndex: 1,
  },
  actionLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    color: colors.navy,
  },
  actionLabelDone: {
    color: colors.textSecondary,
  },
  actionLabelLocked: {
    color: colors.textMuted,
  },
  validationError: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#ef4444',
  },
  stage: {
    padding: 20,
  },
  stageHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
  },
  stageColumn: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    ...textStyles.eyebrow,
    color: colors.brand600,
  },
  name: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  muscleChip: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    boxShadow: SHADOW_EMBOSS,
  },
  muscleLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  mediaWell: {
    marginTop: 24,
    borderRadius: 24,
    minHeight: 176,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(to bottom, #eff1f4, #ffffff)',
    padding: 16,
    boxShadow: PRESS_SHADOW,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: 160,
  },
  setList: {
    marginTop: 24,
    gap: 12,
  },
});
