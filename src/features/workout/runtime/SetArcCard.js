import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import Select from '../../../shared/components/Select';
import { CAP_BODY, CAP_PILL, useLargeTextReflow } from '../../../shared/components/largeText';
import { colors, font, layout, radii, spacing, textInputColors, textScale, titleTracking } from '../../../shared/theme/tokens';
import { CheckIcon } from './SessionIcons';
import { doneSetLabel, repsFieldLabel } from './sessionMath';

// T-146 (ruling rev 15–18, 26; FINAL boards 4/5; FE Q1 default): the phone's
// live set card. An upper half-circle split into one segment per set (done
// gold · now a gold outline with a glow · to do grey), "{left} sets left" (or
// "Last set" in gold) and the action inside it; under it ONE 32 row: "Last
// time …" before the first set, else the previous set's pill "✓ Set k · w × r ✎".
// Tapping that pill (or a done segment) opens the set for editing: the
// steppers load it, the action becomes "Save set k" and a quiet "Undo set k"
// un-logs it (the same request as before). To-do segments aren't tappable.
// Then the Weight / Reps steppers. The tablet keeps SetEditor (FE Q2).

const ARC_STROKE = 14;
const ARC_NOW_INNER = 9;
const ARC_MAX_RADIUS = 140;
// The arc's centre sits this far below its top (radius + room for the stroke
// and the now glow); the box is 4 taller.
const ARC_TOP_ROOM = 32;
const HIT = 44;
const SHORT_BELOW = 700;

// The segments of an upper half-circle (180° → 360°, y down), one per set,
// 4° gaps (3° above 6 sets), butt ends. Each: { d, mid: { x, y } }.
export function arcSegments(total, radius, cx, cy) {
  if (!(total > 0)) {
    return [];
  }
  const gap = total > 6 ? 3 : 4;
  const span = 180 / total;
  const point = (deg) => ({ x: cx + radius * Math.cos((deg * Math.PI) / 180), y: cy + radius * Math.sin((deg * Math.PI) / 180) });
  return Array.from({ length: total }, (_, index) => {
    const from = 180 + index * span + gap / 2;
    const to = 180 + (index + 1) * span - gap / 2;
    const a = point(from);
    const b = point(to);
    return {
      d: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
      mid: point((from + to) / 2),
    };
  });
}

// "{left} sets left" / "Last set" / "All sets done": the arc's one
// accessible name (RN-SPEC dated 30 Oct).
export function arcLabel(left) {
  if (left === 0) {
    return 'All sets done';
  }
  return left === 1 ? 'Last set' : `${left} sets left`;
}

function EditIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20h4L19 9l-4-4L4 16z" />
    </Svg>
  );
}

function SetArc({ sets, nowId, selectedId, width, onSelect }) {
  const left = sets.filter((set) => !set.is_completed).length;
  const radius = Math.min(ARC_MAX_RADIUS, Math.floor((width - ARC_STROKE) / 2));
  const cx = width / 2;
  const cy = radius + ARC_TOP_ROOM;
  const segments = arcSegments(sets.length, radius, cx, cy);
  return (
    <View style={[styles.arcBox, { height: cy + 4 }]}>
      <View
        testID="set-arc"
        accessible
        accessibilityRole="image"
        accessibilityLabel={arcLabel(left)}
        style={StyleSheet.absoluteFill}
      >
        <Svg width={width} height={cy + 4}>
          {segments.map((segment, index) => {
            const set = sets[index];
            const now = set.id === nowId || set.id === selectedId;
            // The now / selected set: an outline, NO glow (T-86: the one gold glow is for gold primaries).
            if (now) {
              return [
                <Path key={`${set.id}-ring`} testID={`set-segment-now-${set.id}`} d={segment.d} fill="none" stroke={colors.gold} strokeWidth={ARC_STROKE} />,
                <Path key={`${set.id}-inner`} d={segment.d} fill="none" stroke={colors.surface} strokeWidth={ARC_NOW_INNER} />,
              ];
            }
            return (
              <Path
                key={set.id}
                testID={`set-segment-${set.is_completed ? 'done' : 'todo'}-${set.id}`}
                d={segment.d}
                fill="none"
                stroke={set.is_completed ? colors.gold : colors.setSegmentTrack}
                strokeWidth={ARC_STROKE}
              />
            );
          })}
        </Svg>
      </View>
      {/* §2.2: a done segment is a ≥ 44 button at its midpoint; to-do ones aren't tappable. */}
      {segments.map((segment, index) => {
        const set = sets[index];
        if (!set.is_completed) {
          return null;
        }
        const number = set.set_number ?? index + 1;
        return (
          <Pressable
            key={set.id}
            testID={`set-segment-${set.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Set ${number}, ${doneSetLabel(set).replace(' × ', ' by ')}. Edit`}
            onPress={() => onSelect(set)}
            style={[styles.hit, { left: segment.mid.x - HIT / 2, top: segment.mid.y - HIT / 2 }]}
          />
        );
      })}
    </View>
  );
}

function Stepper({ testID, label, glyph, onPress }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.stepper, pressed && styles.stepperPressed]}>
      <Text allowFontScaling={false} style={styles.stepperGlyph}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function Cell({ testID, label, value, steppers, error, stacked, short }) {
  return (
    <View testID={testID} style={[styles.cell, short && styles.cellShort, stacked ? styles.cellStacked : styles.cellHalf, error && styles.cellError]}>
      {label}
      {value}
      <View style={styles.steppers}>{steppers}</View>
    </View>
  );
}

export default function SetArcCard({
  exercise,
  set,
  editing = null,
  draft,
  reps,
  lastTime,
  highlighted = false,
  validationError,
  pendingSetIds,
  onWeightChange,
  onUnitChange,
  onRepsChange,
  onStep,
  onSelectDone,
  onUndo,
  onCancel,
  action = null,
  cardRef,
}) {
  const stacked = useLargeTextReflow();
  const { width, height } = useWindowDimensions();
  const short = height < SHORT_BELOW;
  const [arcWidth, setArcWidth] = useState(width - 4 * layout.gutter);
  const sets = exercise.sets ?? [];
  const done = sets.filter((item) => item.is_completed);
  const left = sets.length - done.length;
  // The set the steppers edit: the one being edited, else the live one.
  const target = editing ?? set;
  // The done set just before the live one.
  const previous = done[done.length - 1] ?? null;
  const unit = draft?.actualWeightUnit || 'lb';
  const weightValue = draft?.actualWeightValue === undefined || draft?.actualWeightValue === null ? '' : String(draft.actualWeightValue);
  const number = target?.set_number;
  const pending = Boolean(previous && pendingSetIds?.has(previous.id));
  return (
    <View ref={cardRef} collapsable={false} testID="set-editor" style={[styles.card, highlighted && styles.cardHighlighted]}>
      <View onLayout={(event) => setArcWidth(event.nativeEvent.layout.width)}>
        <SetArc sets={sets} nowId={editing ? null : set?.id} selectedId={editing?.id} width={arcWidth} onSelect={onSelectDone} />
        <View pointerEvents="box-none" style={styles.arcCentre}>
          <Text {...CAP_BODY} testID="set-arc-count" style={[styles.count, left <= 1 && styles.countLast]}>
            {left === 0 ? 'Done' : left === 1 ? 'Last set' : `${left}`}
            {left > 1 ? <Text style={styles.countUnit}>{' sets left'}</Text> : null}
          </Text>
          {action}
        </View>
      </View>
      <View testID="set-previous-row" style={styles.previousRow}>
        {editing ? (
          <>
            <Pressable testID={`set-undo-${editing.id}`} accessibilityRole="button" accessibilityLabel={`Undo set ${editing.set_number}`} disabled={pending} onPress={() => onUndo(editing)} hitSlop={6} style={styles.rowButton}>
              <Text {...CAP_PILL} style={styles.undoText}>{`Undo set ${editing.set_number}`}</Text>
            </Pressable>
            <Pressable testID={`set-cancel-${editing.id}`} accessibilityRole="button" accessibilityLabel="Cancel" disabled={pending} onPress={() => onCancel(editing)} hitSlop={6} style={styles.rowButton}>
              <Text {...CAP_PILL} style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        ) : previous ? (
          <>
            <Pressable
              testID={`set-previous-${previous.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Set ${previous.set_number} done, ${doneSetLabel(previous).replace(' × ', ' by ')}. Tap to edit`}
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => onSelectDone(previous)}
              style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
            >
              <CheckIcon size={16} color={colors.gold} />
              <Text {...CAP_PILL} numberOfLines={1} style={styles.pillText}>
                {pending ? 'Saving…' : `Set ${previous.set_number} · ${doneSetLabel(previous)}`}
              </Text>
              <EditIcon color={colors.textSecondary} />
            </Pressable>
          </>
        ) : lastTime ? (
          <Text {...CAP_BODY} testID={`set-last-time-${target?.id}`} style={styles.lastTime}>
            {lastTime}
          </Text>
        ) : null}
      </View>
      {target ? (
        <>
          <View style={[styles.cells, stacked && styles.cellsStacked]}>
            <Cell
              testID="set-cell-weight"
              stacked={stacked}
              short={short}
              error={Boolean(validationError)}
              label={
                <View style={styles.cellLabelRow}>
                  <Text {...CAP_BODY} style={styles.cellLabel}>Weight ·</Text>
                  <Select
                    testID={`set-unit-${target.id}`}
                    accessibilityLabel={`Weight unit for set ${number}`}
                    value={unit}
                    options={[
                      { value: 'lb', label: 'lb' },
                      { value: 'kg', label: 'kg' },
                    ]}
                    onChange={onUnitChange}
                    boxStyle={styles.unitBox}
                    textStyle={styles.unitText}
                  />
                </View>
              }
              value={
                <TextInput
                  {...textInputColors}
                  maxFontSizeMultiplier={textScale.display}
                  testID={`set-weight-${target.id}`}
                  accessibilityLabel={`Weight for set ${number}`}
                  accessibilityHint={validationError || undefined}
                  keyboardType="decimal-pad"
                  value={weightValue}
                  placeholder={target.target_weight_value != null ? String(target.target_weight_value) : '0'}
                  placeholderTextColor={colors.textFaint}
                  onChangeText={onWeightChange}
                  style={[styles.value, validationError && styles.valueError]}
                />
              }
              steppers={
                <>
                  <Stepper testID={`set-weight-minus-${target.id}`} label="Decrease weight" glyph="−" onPress={() => onStep('weight', -1)} />
                  <Stepper testID={`set-weight-plus-${target.id}`} label="Increase weight" glyph="+" onPress={() => onStep('weight', 1)} />
                </>
              }
            />
            <Cell
              testID="set-cell-reps"
              stacked={stacked}
              short={short}
              label={
                <Text {...CAP_BODY} style={styles.cellLabel}>
                  {repsFieldLabel(target)}
                </Text>
              }
              value={
                <TextInput
                  {...textInputColors}
                  maxFontSizeMultiplier={textScale.display}
                  testID={`set-reps-${target.id}`}
                  accessibilityLabel={`Reps for set ${number}`}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={reps ?? ''}
                  placeholder="—"
                  placeholderTextColor={colors.textFaint}
                  onChangeText={onRepsChange}
                  style={styles.value}
                />
              }
              steppers={
                <>
                  <Stepper testID={`set-reps-minus-${target.id}`} label="Decrease reps" glyph="−" onPress={() => onStep('reps', -1)} />
                  <Stepper testID={`set-reps-plus-${target.id}`} label="Increase reps" glyph="+" onPress={() => onStep('reps', 1)} />
                </>
              }
            />
          </View>
          {validationError ? (
            <Text {...CAP_BODY} testID={`weight-error-${target.id}`} accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.validation}>
              {validationError}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    gap: spacing[2],
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.setCardEdge,
    backgroundColor: colors.surface,
  },
  cardHighlighted: {
    borderColor: colors.gold,
  },
  arcBox: {
    alignSelf: 'stretch',
  },
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
  },
  arcCentre: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing[3],
  },
  count: {
    ...font(700),
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: titleTracking(44, -0.045),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  countLast: {
    color: colors.gold,
  },
  countUnit: {
    ...font(600),
    fontSize: 16,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  previousRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  pill: {
    minHeight: 32,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.goldPillEdge,
    backgroundColor: colors.goldPill,
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillText: {
    ...font(600),
    fontSize: 16,
    lineHeight: 20,
    color: colors.gold,
    flexShrink: 1,
  },
  rowButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  undoText: {
    ...font(600),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textStrong2,
  },
  cancelText: {
    ...font(600),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  lastTime: {
    ...font(500),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cells: {
    marginTop: spacing[2],
    flexDirection: 'row',
    gap: spacing[2],
  },
  cellsStacked: {
    flexDirection: 'column',
  },
  cell: {
    minHeight: 128,
    paddingVertical: spacing[2],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.fillWell,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  // Under 700 tall (RN-SPEC dated 30 Oct).
  cellShort: {
    minHeight: 120,
  },
  cellHalf: {
    flex: 1,
    minWidth: 0,
  },
  cellStacked: {
    alignSelf: 'stretch',
  },
  cellError: {
    borderColor: colors.dangerText,
  },
  cellLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  cellLabel: {
    ...font(500),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  unitBox: {
    minHeight: 28,
    paddingHorizontal: spacing[2],
  },
  unitText: {
    ...font(600),
    fontSize: 16,
    color: colors.textSecondary,
  },
  value: {
    ...font(700),
    fontSize: 44,
    lineHeight: 48,
    minWidth: 80,
    paddingVertical: 0,
    letterSpacing: titleTracking(44, -0.045),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  valueError: {
    color: colors.dangerText,
  },
  steppers: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.fillButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPressed: {
    backgroundColor: colors.fillPressed,
  },
  stepperGlyph: {
    ...font(600),
    fontSize: 16,
    color: colors.textPrimary,
  },
  validation: {
    ...font(500),
    fontSize: 14,
    lineHeight: 20,
    color: colors.dangerText,
  },
});
