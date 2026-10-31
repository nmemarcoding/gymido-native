import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import Select from '../../../shared/components/Select';
import { CAP_BODY, CAP_FIT, useLiveLargeText } from '../../../shared/components/largeText';
import { colors, font, layout, radii, spacing, textInputColors, titleTracking } from '../../../shared/theme/tokens';
import { CheckIcon, LockIcon } from './SessionIcons';
import { doneSetLabel, repsFieldLabel, targetRange } from './sessionMath';

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
// Rev 39 (compact card): the arc's centre sits radius + 14 below its top and
// the box ends at the arc's baseline (154 at radius 140).
// (The box ends at the baseline: the centre sits radius + stroke below its top.)
const HIT = 44;

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

// Inside the arc: "{left}" + " sets left" / "Last set" / "Done"; browsing a
// not-started exercise (rev 40): "{N}" + " sets", and "{n} left" never reads
// "Last set" there (nothing is live).
function arcCount({ left, total, browsing }) {
  if (left === 0) {
    return 'Done';
  }
  if (browsing) {
    return `${left === total ? total : left}`;
  }
  return left === 1 ? 'Last set' : `${left}`;
}

function arcUnit({ left, total, browsing }) {
  if (left === 0) {
    return '';
  }
  if (browsing) {
    return left === total ? ` ${total === 1 ? 'set' : 'sets'}` : ` ${left === 1 ? 'set' : 'sets'} left`;
  }
  return left === 1 ? '' : ' sets left';
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

// T-154 rev 42 step 5: the compact arc (radius 120, stroke 12; box 132).
// `boxHeight`: P5-SC draws r100 / stroke 10 in a 112 box (spec + web 401b83e9), so the box can be taller than the arc.
function SetArc({ sets, nowId, selectedId, width, onSelect, label, maxRadius = ARC_MAX_RADIUS, stroke = ARC_STROKE, boxHeight = null }) {
  const radius = Math.min(maxRadius, Math.floor((width - stroke) / 2));
  const cx = width / 2;
  const cy = radius + stroke;
  const segments = arcSegments(sets.length, radius, cx, cy);
  return (
    <View style={[styles.arcBox, { height: Math.max(cy, boxHeight ?? 0) }]}>
      <View
        testID="set-arc"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={StyleSheet.absoluteFill}
      >
        <Svg width={width} height={cy}>
          {segments.map((segment, index) => {
            const set = sets[index];
            const now = set.id === nowId || set.id === selectedId;
            // The now / selected set: an outline, NO glow (T-86: the one gold glow is for gold primaries).
            if (now) {
              return [
                <Path key={`${set.id}-ring`} testID={`set-segment-now-${set.id}`} d={segment.d} fill="none" stroke={colors.gold} strokeWidth={stroke} />,
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
                strokeWidth={stroke}
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

// Rev 42: ± circles 36 (32 at step 4), always a 44 hit.
function Stepper({ testID, label, glyph, onPress, size = 40 }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={(44 - size) / 2} style={({ pressed }) => [styles.stepper, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.stepperPressed]}>
      <Text allowFontScaling={false} style={styles.stepperGlyph}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function Cell({ testID, label, value, steppers, error, stacked, height, compact, scaled }) {
  return (
    <View testID={testID} style={[styles.cell, { minHeight: height, padding: scaled ? 4 : compact ? 6 : spacing[2] }, scaled && styles.cellScaled, stacked ? styles.cellStacked : styles.cellHalf, error && styles.cellError]}>
      {/* The same label slot in both cells, so the Weight (with the unit pill) and Reps values line up. */}
      <View style={[styles.cellLabelSlot, scaled && styles.cellLabelSlotScaled]}>{label}</View>
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
  browsing = false,
  browseLine = '',
  // T-162: phoneFit's sizes: `compactCard` (S2: the small arc + small steppers), `scaled` (P5-SC).
  fit = null,
  // T-155: weight/reps focus, so the page fit holds while typing.
  onFieldFocus,
  cardRef,
}) {
  // T-155 v2 (owner): the compact card is the phone default (steppers 108, ± 36, padding 6, the previous row 28).
  // T-162: S2 = the small arc (box 132, r120, stroke 12) + small steppers (value 34, ± 32); P5-SC scales the card (padding
  // 8, gap 6; arc r100, stroke 10; cell padding 4, label row 20, value 28, gaps 2; the row's pill 28 at 14/600).
  const compact = true;
  const scaled = Boolean(fit?.scaled);
  const compactArc = Boolean(fit?.compactCard) || scaled;
  const steppersHeight = scaled ? 94 : 108;
  const stepperSize = compactArc ? 32 : compact ? 36 : 40;
  const valueSize = scaled ? 28 : compactArc ? 34 : compact ? 38 : 44;
  const stacked = useLiveLargeText(false);
  const { width } = useWindowDimensions();
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
    <View ref={cardRef} collapsable={false} testID="set-editor" style={[styles.card, scaled && styles.cardScaled, highlighted && styles.cardHighlighted]}>
      <View onLayout={(event) => setArcWidth(event.nativeEvent.layout.width)}>
        <SetArc
          sets={sets}
          nowId={editing ? null : set?.id}
          selectedId={editing?.id}
          width={arcWidth}
          onSelect={onSelectDone}
          maxRadius={scaled ? 100 : compactArc ? 120 : ARC_MAX_RADIUS}
          stroke={scaled ? 10 : compactArc ? 12 : ARC_STROKE}
          boxHeight={scaled ? 112 : null}
          // Rev 40: browsing reads "{name}: {done} of {N} sets done, locked".
          label={browsing ? `${exercise.exercise_name_snapshot ?? ''}: ${done.length} of ${sets.length} sets done, locked` : arcLabel(left)}
        />
        <View pointerEvents="box-none" style={[styles.arcCentre, scaled && styles.arcCentreScaled]}>
          <Text {...CAP_FIT} testID="set-arc-count" style={[styles.count, compactArc && styles.countCompact, scaled && styles.countScaled, (left === 0 || (left === 1 && !browsing)) && styles.countLast]}>
            {arcCount({ left, total: sets.length, browsing })}
            {arcUnit({ left, total: sets.length, browsing }) ? (
              <Text style={[styles.countUnit, scaled && styles.countUnitScaled]}>{arcUnit({ left, total: sets.length, browsing })}</Text>
            ) : null}
          </Text>
          {/* Browsing (rev 40 + web parity): "Locked" stays even while a done set is open (Undo / Cancel only). */}
          {browsing ? (
            <View testID="set-locked" style={styles.locked}>
              <LockIcon size={20} color={colors.textMuted} />
              <Text {...CAP_BODY} style={styles.lockedText}>Locked</Text>
            </View>
          ) : (
            action
          )}
        </View>
      </View>
      {/* Rev 39: the row collapses when there is nothing to show. */}
      {browsing && !editing ? (
        browseLine ? (
          <View testID="set-previous-row" style={[styles.previousRow, compact && styles.previousRowCompact]}>
            <Text {...CAP_BODY} testID="set-browse-line" style={[styles.lastTime, scaled && styles.lastTimeScaled]}>
              {browseLine}
            </Text>
          </View>
        ) : null
      ) : editing || previous || lastTime ? (
        <View testID="set-previous-row" style={[styles.previousRow, compact && styles.previousRowCompact]}>
          {editing ? (
            <>
              <Pressable testID={`set-undo-${editing.id}`} accessibilityRole="button" accessibilityLabel={`Undo set ${editing.set_number}`} disabled={pending} onPress={() => onUndo(editing)} hitSlop={6} style={styles.rowButton}>
                <Text {...CAP_BODY} style={styles.undoText}>{`Undo set ${editing.set_number}`}</Text>
              </Pressable>
              <Pressable testID={`set-cancel-${editing.id}`} accessibilityRole="button" accessibilityLabel="Cancel" disabled={pending} onPress={() => onCancel(editing)} hitSlop={6} style={styles.rowButton}>
                <Text {...CAP_BODY} style={styles.cancelText}>Cancel</Text>
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
                hitSlop={8}
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              >
                <CheckIcon size={16} color={colors.gold} />
                <Text {...CAP_BODY} numberOfLines={1} style={[styles.pillText, scaled && styles.pillTextScaled]}>
                  {pending ? 'Saving…' : `Set ${previous.set_number} · ${doneSetLabel(previous)}`}
                </Text>
                <EditIcon color={colors.textSecondary} />
              </Pressable>
            </>
          ) : (
            <Text {...CAP_BODY} testID={`set-last-time-${target?.id}`} style={[styles.lastTime, scaled && styles.lastTimeScaled]}>
              {lastTime}
            </Text>
          )}
        </View>
      ) : null}
      {/* Rev 40: no steppers while browsing (nothing to log; a done set there offers only Undo / Cancel). */}
      {target && !browsing ? (
        <>
          <View style={[styles.cells, stacked && styles.cellsStacked]}>
            <Cell
              testID="set-cell-weight"
              stacked={stacked}
              compact={compact}
              scaled={scaled}
              height={steppersHeight}
              error={Boolean(validationError)}
              label={
                <View style={styles.cellLabelRow}>
                  <Text {...CAP_BODY} style={[styles.cellLabel, compact && styles.cellLabelCompact, scaled && styles.cellLabelScaled]}>Weight ·</Text>
                  <Select
                    testID={`set-unit-${target.id}`}
                    accessibilityLabel={`Weight unit for set ${number}`}
                    value={unit}
                    options={[
                      { value: 'lb', label: 'lb' },
                      { value: 'kg', label: 'kg' },
                    ]}
                    onChange={onUnitChange}
                    // 24 (scaled 20) drawn, a 44 hit.
                    hitSlop={scaled ? 12 : 10}
                    boxStyle={[styles.unitBox, scaled && styles.unitBoxScaled]}
                    textStyle={[styles.unitText, scaled && styles.unitTextScaled]}
                  />
                </View>
              }
              value={
                <TextInput
                  {...textInputColors}
                  {...CAP_FIT}
                  testID={`set-weight-${target.id}`}
                  accessibilityLabel={`Weight for set ${number}`}
                  accessibilityHint={validationError || undefined}
                  keyboardType="decimal-pad"
                  // T-149: focus selects the value, so typing replaces it; at most 7 characters.
                  selectTextOnFocus
                  onFocus={() => onFieldFocus?.(true)}
                  onBlur={() => onFieldFocus?.(false)}
                  maxLength={7}
                  value={weightValue}
                  placeholder={target.target_weight_value != null ? String(target.target_weight_value) : '0'}
                  placeholderTextColor={colors.textFaint}
                  onChangeText={onWeightChange}
                  style={[styles.value, { fontSize: valueSize, lineHeight: valueSize }, validationError && styles.valueError]}
                />
              }
              steppers={
                <>
                  <Stepper testID={`set-weight-minus-${target.id}`} label="Decrease weight" glyph="−" size={stepperSize} onPress={() => onStep('weight', -1)} />
                  <Stepper testID={`set-weight-plus-${target.id}`} label="Increase weight" glyph="+" size={stepperSize} onPress={() => onStep('weight', 1)} />
                </>
              }
            />
            <Cell
              testID="set-cell-reps"
              stacked={stacked}
              compact={compact}
              scaled={scaled}
              height={steppersHeight}
              label={
                // Rev 37 F3: "Reps · 8–12" as drawn; the accessible name keeps "target 8–12".
                <Text {...CAP_BODY} testID="set-reps-label" accessibilityLabel={repsFieldLabel(target)} style={[styles.cellLabel, compact && styles.cellLabelCompact, scaled && styles.cellLabelScaled]}>
                  {targetRange(target) ? `Reps · ${targetRange(target)}` : 'Reps'}
                </Text>
              }
              value={
                <TextInput
                  {...textInputColors}
                  {...CAP_FIT}
                  testID={`set-reps-${target.id}`}
                  accessibilityLabel={`Reps for set ${number}`}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  onFocus={() => onFieldFocus?.(true)}
                  onBlur={() => onFieldFocus?.(false)}
                  maxLength={2}
                  value={reps ?? ''}
                  placeholder="—"
                  placeholderTextColor={colors.textFaint}
                  onChangeText={onRepsChange}
                  style={[styles.value, { fontSize: valueSize, lineHeight: valueSize }]}
                />
              }
              steppers={
                <>
                  <Stepper testID={`set-reps-minus-${target.id}`} label="Decrease reps" glyph="−" size={stepperSize} onPress={() => onStep('reps', -1)} />
                  <Stepper testID={`set-reps-plus-${target.id}`} label="Increase reps" glyph="+" size={stepperSize} onPress={() => onStep('reps', 1)} />
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
    padding: spacing[3],
    gap: spacing[2],
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.setCardEdge,
    backgroundColor: colors.surface,
  },
  cardScaled: {
    padding: spacing[2],
    gap: 6,
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
  // Rev 39: Did it's bottom sits on the arc's baseline.
  arcCentre: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing[3],
  },
  arcCentreScaled: {
    gap: spacing[2],
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
  // Rev 42 step 5: "{left} sets left" 20/800 on the compact arc.
  countCompact: {
    ...font(800),
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
  },
  countUnit: {
    ...font(600),
    fontSize: 16,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  countScaled: {
    fontSize: 18,
    lineHeight: 22,
  },
  countUnitScaled: {
    fontSize: 15,
  },
  locked: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  lockedText: {
    ...font(500),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textMuted,
  },
  // T-155: 32 (rev 42's compact one is 28).
  previousRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  previousRowCompact: {
    minHeight: 28,
  },
  pill: {
    minHeight: 28,
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
  pillTextScaled: {
    fontSize: 14,
    lineHeight: 18,
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
  lastTimeScaled: {
    fontSize: 15,
  },
  cells: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  cellsStacked: {
    flexDirection: 'column',
  },
  cell: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.fillWell,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
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
  cellLabelCompact: {
    fontSize: 15,
    lineHeight: 18,
  },
  cellScaled: {
    gap: 2,
  },
  cellLabelScaled: {
    fontSize: 14,
    lineHeight: 18,
  },
  cellLabelSlotScaled: {
    minHeight: 20,
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
  // Spec §3.3: the label row is 24 (the unit select sets it), in both cells.
  cellLabelSlot: {
    minHeight: 24,
    justifyContent: 'center',
  },
  // Spec §3.3 unit select: min-h 24, r8, padding 0 6, 14/600, fill-strong (Select's box adds 8 above and below: off).
  unitBox: {
    minHeight: 24,
    borderRadius: 8,
    paddingVertical: 0,
    paddingHorizontal: 6,
    backgroundColor: colors.fillButton,
  },
  unitText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  unitBoxScaled: {
    minHeight: 20,
  },
  unitTextScaled: {
    fontSize: 13,
    lineHeight: 16,
  },
  value: {
    ...font(700),
    fontSize: 44,
    lineHeight: 44,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
