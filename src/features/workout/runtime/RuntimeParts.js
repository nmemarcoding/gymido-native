import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ExerciseImage, { TILE_ALPHA, muscleColor, muscleTextColor } from '../../../shared/components/ExerciseImage';
import GlassSurface from '../../../shared/components/GlassSurface';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton, { useSwipeGuard } from '../../../shared/components/PillButton';
import Spinner from '../../../shared/components/Spinner';
import Select from '../../../shared/components/Select';
import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT, TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import { colors, font, gradients, layout, radii, shadows, spacing, textInputColors, textScale, titleTracking, typography } from '../../../shared/theme/tokens';
import ProgressRing from '../components/ProgressRing';
import { CheckIcon, PlayIcon } from './SessionIcons';
import {
  doneSetLabel,
  elapsedSpokenLabel,
  exerciseDone,
  exerciseName,
  exerciseNotes,
  formatClock,
  repsFieldLabel,
  setOfLabel,
  setsWord,
  stageEyebrow,
  tabletEyebrow,
} from './sessionMath';
import { keepUnitsTogether } from '../../../shared/format/counts';

const CLEAR = gradients.photoFade.colors[0];
// UX F1 drawn sizes (phone / tablet). Heights hold text, so they are minimums.
export const PHONE_STAGE_HEIGHT = 330;
export const PHONE_BROWSE_STAGE_HEIGHT = 318;
export const TABLET_BROWSE_STAGE_HEIGHT = 520;
export const DID_IT_HEIGHT = 64;
const DISPLAY_CAP = { maxFontSizeMultiplier: textScale.display };
const TIMER_CAP = { maxFontSizeMultiplier: textScale.timer };
// T-105: the header's Complete (UX ruling §1).
const COMPLETE_HEIGHT = 36;
// F1 §0.6: drawn controls below 44 keep their size and get a 44 hit area.
export function hitFor(height) {
  return Math.max(0, Math.ceil((layout.touchMin - height) / 2));
}

// §8.6 STATE RULE: pressed = the rest colour + a 4 % overlay.
function PressOverlay({ ink = false }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlayRound, { backgroundColor: ink ? colors.pressOverlayInk : colors.pressOverlay }]} />;
}

// A glass pill over the photo (UX §8.4 color-on-photo + blur 12).
function GlassButton({ testID, label, onPress, height, tablet, buttonRef, accessibilityLabel, icon }) {
  return (
    <Pressable
      ref={buttonRef}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={hitFor(height)}
      style={styles.noShrink}
    >
      {({ pressed }) => (
        <GlassSurface
          tone="onPhoto"
          radius={radii.full}
          shadow={false}
          style={[styles.glassButton, { minHeight: height, paddingLeft: icon ? (tablet ? 12 : 10) : tablet ? 20 : 16, paddingRight: tablet ? 20 : icon ? 14 : 16 }]}
        >
          {pressed ? <PressOverlay /> : null}
          {icon}
          <Text {...CAP_BODY} textBreakStrategy="simple" style={[styles.glassLabel, tablet && styles.glassLabelTablet, icon && styles.glassLabelSmall]}>
            {label}
          </Text>
        </GlassSurface>
      )}
    </Pressable>
  );
}

// F1 ND3: ONE session header in every state: Exit · plan name + "n/m sets
// done" · timer pill m:ss · All (n) · Complete. Exit always opens the
// Discard dialog. UX §9 (QA Phase 1 recheck, AX5): past the reflow point the
// header takes rows, so the plan name never gets squeezed into one character
// per line; it wraps by word and a single long word shrinks.
// T-105 (owner B; UX ruling §1 + look verdict 9bdb33c8; RN-SPEC-workout dated
// 29 Oct 2026): Complete lives here at every size (`wide` = a ≥ 1024 window:
// "Complete workout", else "Complete"; the spoken name is always "Complete
// workout"). Phones (< 768) hide the timer pill and the clock moves into the
// subline (PhoneSubline). Large text: Exit · All / timer · Complete / name.
export function SessionChrome({
  planName,
  completedSets,
  totalSets,
  exerciseCount,
  elapsed = 0,
  onExit,
  onAll,
  allRef,
  tablet = false,
  wide = false,
  onComplete,
  completing = false,
  completeDisabled = false,
  completePrimary = false,
  onLayout,
  style,
}) {
  const stacked = useLargeTextReflow();
  const buttonHeight = tablet ? 48 : 40;
  const exit = <GlassButton testID="session-exit" label="Exit" onPress={onExit} height={buttonHeight} tablet={tablet} />;
  const all = <GlassButton testID="session-all" buttonRef={allRef} label={`All (${exerciseCount})`} onPress={onAll} height={buttonHeight} tablet={tablet} />;
  const complete = (
    <CompleteButton label={wide ? 'Complete workout' : 'Complete'} primary={completePrimary} completing={completing} disabled={completeDisabled} onPress={onComplete} />
  );
  const timer = tablet ? (
    <GlassSurface
      testID="session-timer"
      tone="onPhoto"
      radius={radii.full}
      shadow={false}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={elapsedSpokenLabel(elapsed)}
      style={[styles.timerPill, { minHeight: 40 }]}
    >
      <View style={styles.timerDot} />
      <Text {...TIMER_CAP} style={[styles.timerText, styles.timerTextTablet]}>
        {formatClock(elapsed)}
      </Text>
    </GlassSurface>
  ) : null;
  const plan = (
    <GlassSurface testID="session-plan" tone="onPhoto" radius={radii.full} shadow={false} style={[styles.planPill, tablet && styles.planPillTablet, stacked && styles.planPillStacked]}>
      <Text {...TITLE_TEXT} numberOfLines={2} style={[styles.planName, tablet && styles.planNameTablet]}>
        {keepUnitsTogether(planName)}
      </Text>
      {tablet ? (
        <Text {...CAP_PILL} style={[styles.planSub, styles.planSubTablet]}>{`${completedSets}/${totalSets} ${setsWord(totalSets)} done`}</Text>
      ) : (
        <PhoneSubline completedSets={completedSets} totalSets={totalSets} elapsed={elapsed} />
      )}
    </GlassSurface>
  );
  return (
    <View testID="session-chrome" onLayout={onLayout} style={[styles.chrome, tablet && styles.chromeTablet, style]}>
      {stacked ? (
        <>
          <View style={styles.chromeRow}>
            {exit}
            <View style={styles.flex} />
            {all}
          </View>
          <View style={styles.chromeRow}>
            {timer}
            <View style={styles.flex} />
            {complete}
          </View>
          <View style={styles.chromePlanRow}>{plan}</View>
        </>
      ) : (
        <View style={styles.chromeRow}>
          {exit}
          <View style={styles.chromeCentre}>{plan}</View>
          {timer}
          {all}
          {complete}
        </View>
      )}
      {/* Batch 2 item 3 (web SessionChrome): the gold rail, always. */}
      <SessionRail completedSets={completedSets} totalSets={totalSets} inChrome />
    </View>
  );
}

// T-105 phones: "{done}/{total} sets · {m:ss}"; when that doesn't fit on one
// line (below 375, or long values like "12/15 sets · 1:02:05") "sets" drops:
// "{done}/{total} · {m:ss}" (chosen by fit, kept for the session). Screen
// readers hear "n/m sets done" and the clock is the ONE accessible timer
// (reviewer M1: never hidden), as the pill was.
function PhoneSubline({ completedSets, totalSets, elapsed }) {
  const [short, setShort] = useState(false);
  const count = short ? `${completedSets}/${totalSets}` : `${completedSets}/${totalSets} ${setsWord(totalSets)}`;
  return (
    <View testID="session-subline" style={styles.subline}>
      <Text
        testID="session-subline-count"
        {...CAP_PILL}
        accessibilityLabel={`${completedSets}/${totalSets} ${setsWord(totalSets)} done`}
        onTextLayout={(event) => {
          if (!short && event?.nativeEvent?.lines?.length > 1) {
            setShort(true);
          }
        }}
        style={[styles.planSub, styles.sublineCount]}
      >
        {count}
      </Text>
      <Text {...CAP_PILL} accessibilityElementsHidden importantForAccessibility="no" style={[styles.planSub, styles.noShrink]}>
        {' · '}
      </Text>
      <Text
        testID="session-timer"
        {...TIMER_CAP}
        accessible
        accessibilityRole="timer"
        accessibilityLabel={elapsedSpokenLabel(elapsed)}
        style={[styles.planSub, styles.noShrink]}
      >
        {formatClock(elapsed)}
      </Text>
    </View>
  );
}

// T-105 Complete in the header: compact 36 (44 hit), radius-full, 14/600,
// padding 0 14. Glass (the header's glass) while sets are left, the gold
// primary + its glow when none are; a spinner while completing; disabled
// while a set save is in flight (T-89).
function CompleteButton({ label, primary, completing, disabled, onPress }) {
  const inactive = disabled || completing;
  const ink = primary ? colors.onGold : colors.textPrimary;
  const content = (pressed) => (
    <>
      {pressed ? <PressOverlay ink={primary} /> : null}
      {completing ? <Spinner size={14} thickness={2} color={ink} /> : null}
      <Text {...CAP_BODY} textBreakStrategy="simple" style={[styles.completeLabel, { color: ink }]}>
        {label}
      </Text>
    </>
  );
  return (
    <Pressable
      testID="complete-workout"
      accessibilityRole="button"
      accessibilityLabel="Complete workout"
      accessibilityState={{ disabled: inactive, busy: completing }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={hitFor(COMPLETE_HEIGHT)}
      style={[styles.noShrink, inactive && styles.completeInactive]}
    >
      {({ pressed }) =>
        primary ? (
          <View testID="complete-workout-gold" style={[styles.complete, styles.completeGold]}>
            {content(pressed)}
          </View>
        ) : (
          <GlassSurface testID="complete-workout-glass" tone="onPhoto" radius={radii.full} shadow={false} style={styles.complete}>
            {content(pressed)}
          </GlassSurface>
        )
      }
    </Pressable>
  );
}

function MuscleChip({ exercise, tablet }) {
  const name = exercise.exercise?.primary_muscle_group?.name;
  if (!name) {
    return null;
  }
  const code = exercise.exercise?.primary_muscle_group?.code;
  const hue = muscleColor(code);
  return (
    <View testID="stage-muscle-chip" style={[styles.muscleChip, tablet && styles.muscleChipTablet, !hue && styles.muscleChipNeutral]}>
      {hue ? <View style={[StyleSheet.absoluteFill, styles.overlayRound, { backgroundColor: hue, opacity: TILE_ALPHA }]} /> : null}
      <Text {...CAP_PILL} style={[styles.muscleText, tablet && styles.muscleTextTablet, { color: muscleTextColor(code) ?? colors.textSecondary }]}>
        {name}
      </Text>
    </View>
  );
}

function StageRing({ exercise, tablet }) {
  const { done, total } = exerciseDone(exercise);
  const size = tablet ? 104 : 64;
  return (
    <GlassSurface tone="onPhoto" radius={radii.full} shadow={false} style={[styles.ringGlass, { width: size, height: size }]}>
      <ProgressRing value={done} total={total} size={size - 2} thickness={11} label={`${done} of ${total} ${setsWord(total)} done`}>
        <Text {...TIMER_CAP} numberOfLines={1} textBreakStrategy="simple" style={[styles.ringText, tablet && styles.ringTextTablet]}>{`${done}/${total}`}</Text>
      </ProgressRing>
    </GlassSurface>
  );
}

// The exercise photo (cover, full bleed) or, with no photo, the §8.1 hero
// tile; the fades keep the caption readable (the bottom fade ends at the
// ground, F1 a11y).
function StagePhoto({ exercise, variant }) {
  const url = exercise.exercise?.thumbnail?.url;
  return (
    <>
      <ExerciseImage
        testID="stage-image"
        url={url ?? null}
        name={exerciseName(exercise)}
        muscleCode={exercise.exercise?.primary_muscle_group?.code}
        size={56}
        accessibilityLabel={exerciseName(exercise)}
        style={styles.stagePhoto}
      />
      {variant === 'browse' ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GradientFill angle={180} colors={[colors.onPhoto, CLEAR, colors.inkLine, colors.ground]} stops={[0, 0.3, 0.55, 1]} />
        </View>
      ) : variant === 'split' ? (
        <View pointerEvents="none" style={[styles.fadeBottom, styles.fadeSplit]}>
          <GradientFill angle={180} colors={[CLEAR, colors.ground]} stops={[0, 0.7]} />
        </View>
      ) : (
        <>
          <View pointerEvents="none" style={styles.fadeTop}>
            <GradientFill angle={180} colors={[colors.onPhoto, CLEAR]} />
          </View>
          <View pointerEvents="none" style={styles.fadeBottom}>
            <GradientFill angle={180} colors={[CLEAR, colors.ground]} />
          </View>
        </>
      )}
    </>
  );
}

// F1 Workout / Workout browsing / Tablet stage. `variant`: 'live' (phone),
// 'browse' (phone or tablet browsing), 'split' (the tablet live stage
// column). `top` is the room the overlaid chrome takes; `chrome` an in-flow
// chrome (large text). Notes (v1 §19.2) stay under the name. `onLayout`
// reports the stage's frame (the session's top band, A116); `onContentLayout`
// the frame of its bottom block (How to + the caption) inside the stage: the
// open photo ends where it starts (A116 device FAIL, 27 Oct 2026).
export function ExerciseStage({
  exercise,
  index,
  count,
  isActive,
  variant = 'live',
  tablet = false,
  top = 0,
  chrome = null,
  completedSets = 0,
  totalSets = 0,
  howTo = null,
  segments = null,
  onLayout,
  onContentLayout,
}) {
  const notes = exerciseNotes(exercise);
  const name = exerciseName(exercise);
  const muscle = exercise.exercise?.primary_muscle_group?.name;
  const browse = variant === 'browse';
  const split = variant === 'split';
  const minHeight = split ? undefined : browse ? (tablet ? TABLET_BROWSE_STAGE_HEIGHT : PHONE_BROWSE_STAGE_HEIGHT) : PHONE_STAGE_HEIGHT;
  const eyebrow = browse
    ? isActive
      ? 'Current exercise'
      : `Exercise ${index + 1} of ${count}`
    : split
      ? tabletEyebrow({ isActive, index, count, exercise })
      : stageEyebrow({ isActive, index, count, muscle, completedSets, totalSets });
  return (
    <View testID="exercise-stage" onLayout={onLayout} style={[styles.stage, split && styles.stageSplit, { minHeight, paddingTop: top }]}>
      <StagePhoto exercise={exercise} variant={variant} />
      {chrome}
      <View style={styles.flex} />
      <View testID="exercise-stage-content" onLayout={onContentLayout}>
        {howTo ? <View style={[styles.howToRow, split && styles.howToRowSplit]}>{howTo}</View> : null}
        <View style={[styles.caption, browse && styles.captionBrowse, tablet && browse && styles.captionBrowseTablet, split && styles.captionSplit]}>
          <View style={styles.captionText}>
            <Text {...CAP_BODY} style={[styles.eyebrow, browse && styles.eyebrowBrowse, tablet && browse && styles.eyebrowBrowseTablet, split && styles.eyebrowSplit]}>
              {eyebrow}
            </Text>
            <Text
              {...DISPLAY_TITLE_TEXT}
              accessibilityRole="header"
              style={[styles.stageName, browse && styles.stageNameBrowse, tablet && browse && styles.stageNameBrowseTablet, split && styles.stageNameSplit]}
            >
              {name}
            </Text>
            {browse ? <MuscleChip exercise={exercise} tablet={tablet} /> : null}
            {notes ? <Text {...CAP_BODY} style={styles.stageNotes}>{notes}</Text> : null}
            {segments}
          </View>
          {browse ? <StageRing exercise={exercise} tablet={tablet} /> : null}
        </View>
      </View>
    </View>
  );
}

export function HowToButton({ onPress, tablet }) {
  return (
    <GlassButton
      testID="how-to-open"
      label="How to"
      onPress={onPress}
      height={tablet ? 40 : 36}
      tablet={tablet}
      icon={<PlayIcon size={14} color={colors.textPrimary} />}
    />
  );
}

// The live stage's per-exercise progress (done gold, partial gold up to its
// share, empty white 0.12). Decorative progress: jumping is All (n) / Up next.
export function ExerciseSegments({ exercises, viewingIndex, tablet = false }) {
  return (
    <View
      testID="exercise-segments"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Exercise ${viewingIndex + 1} of ${exercises.length}`}
      style={[styles.segments, tablet && styles.segmentsTablet]}
    >
      {exercises.map((exercise) => {
        const { done, total } = exerciseDone(exercise);
        const ratio = total > 0 ? done / total : 0;
        return (
          <View key={exercise.id} style={[styles.segment, tablet && styles.segmentTablet]}>
            <View style={[styles.segmentFill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
        );
      })}
    </View>
  );
}

// ND3 the gold session rail: sets done / all sets. aria-hidden. Batch 2
// item 3: drawn at the bottom of the session header in every state.
export function SessionRail({ completedSets, totalSets, inChrome = false }) {
  const ratio = totalSets > 0 ? completedSets / totalSets : 0;
  return (
    <View testID="session-rail" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.rail, inChrome && styles.railInChrome]}>
      <View style={[styles.railFill, { width: `${Math.round(ratio * 100)}%` }]} />
    </View>
  );
}

// [O8]: an info/warning card, copy unchanged.
export function StaleSessionBanner({ title }) {
  return (
    <View testID="stale-session-banner" accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.staleBanner}>
      <Text {...CAP_BODY} style={styles.bannerTitle}>{title}</Text>
      <Text {...CAP_BODY} style={styles.bannerBody}>
        This workout is still open from an earlier day. Finish or end it, and today's workout will be ready when you come back.
      </Text>
    </View>
  );
}

// [O12 §2]
export function ReloadErrorBar({ retrying, onRetry }) {
  return (
    <View testID="reload-error-bar" style={styles.reloadBar}>
      <Text {...CAP_BODY} style={styles.reloadTitle}>Couldn't refresh your workout</Text>
      <Text {...CAP_BODY} style={styles.reloadBody}>Your last set was saved. Some details may be out of date.</Text>
      <View style={styles.retryRow}>
        <PillButton testID="reload-error-retry" title={retrying ? 'Retrying…' : 'Retry'} variant="secondary" size="compact" disabled={retrying} onPress={onRetry} />
      </View>
    </View>
  );
}

// §19.4 (copy identical), F1 browsing bar: role status, the one gold action.
export function BrowsingBar({ onResume, tablet = false }) {
  const stacked = useLargeTextReflow();
  return (
    <View
      testID="browsing-bar"
      accessibilityLiveRegion="polite"
      style={[styles.browsingBar, tablet && styles.browsingBarTablet, stacked && styles.browsingBarStacked]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.browsingClip, tablet && styles.browsingClipTablet]}>
        <GradientFill angle={tablet ? 140 : 90} colors={[colors.goldTint, colors.goldFaint]} />
      </View>
      {tablet ? <View style={styles.browsingDot} /> : null}
      <Text {...CAP_BODY} style={[styles.browsingText, tablet && styles.browsingTextTablet, stacked && styles.browsingTextStacked]}>
        You're browsing — active set is waiting
      </Text>
      <PillButton testID="browsing-resume" title="Resume" size={tablet ? 'default' : 'compact'} fullWidth={stacked} onPress={onResume} />
    </View>
  );
}

// F1 browsing stats: Time (formatDuration) / Volume (member unit) / Reps.
// UX §9 rule 4: past 1.3× the 3 columns become label → value rows.
export function SessionStats({ time, volume, volumeUnit, reps, tablet = false }) {
  const stacked = useLargeTextReflow();
  const items = [
    { key: 'time', label: 'Time', value: time },
    { key: 'volume', label: 'Volume', value: volume, unit: volume === '—' ? null : volumeUnit },
    { key: 'reps', label: 'Reps', value: reps },
  ];
  if (tablet && !stacked) {
    return (
      <View testID="session-stats" style={styles.statsTablet}>
        {items.map((item) => (
          <View key={item.key} testID={`session-stat-${item.key}`} style={styles.statTileTablet}>
            <Text {...CAP_BODY} style={styles.statsLabelTablet}>{item.label}</Text>
            <Text {...DISPLAY_CAP} style={styles.statsValueTablet}>
              {item.value}
              {item.unit ? <Text style={styles.statsUnitTablet}>{` ${item.unit}`}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View testID="session-stats" style={[styles.stats, stacked && styles.statsStacked]}>
      {items.map((item, index) => (
        <View
          key={item.key}
          testID={`session-stat-${item.key}`}
          style={[styles.statsCell, stacked && styles.statsCellStacked, index > 0 && (stacked ? styles.statsDividerTop : styles.statsDividerLeft)]}
        >
          <Text {...CAP_BODY} style={styles.statsLabel}>{item.label}</Text>
          <Text {...CAP_BODY} style={[styles.statsValue, stacked && styles.statsValueStacked]}>
            {item.unit ? `${item.value} ${item.unit}` : item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Stepper({ testID, label, glyph, onPress, tablet }) {
  const height = tablet ? 44 : 36;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={hitFor(height)} style={styles.noShrink}>
      {({ pressed }) => (
        <View style={[styles.stepper, { height }]}>
          {pressed ? <PressOverlay /> : null}
          <Text allowFontScaling={false} style={[styles.stepperGlyph, tablet && styles.stepperGlyphTablet]}>
            {glyph}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// One editor cell (Weight or Reps). Focus: gold edge + focus ring; error:
// the danger look. Never clips (its border changes at runtime, Android).
function EditorCell({ tablet, stacked, focused, error, label, value, steppers }) {
  const row = tablet && !stacked;
  return (
    <View style={[styles.cell, row && styles.cellRow, !tablet && !stacked && styles.cellHalf, focused && styles.cellFocused, error && styles.cellError]}>
      <View style={row ? styles.cellLeft : styles.cellColumn}>
        {label}
        {value}
      </View>
      <View style={styles.steppers}>{steppers}</View>
    </View>
  );
}

// The set card (F1 "Set row as built in its single-editor form"): ONE live
// editor for the next set of the viewed exercise, then the strip (done chips
// with Undo, the "now" chip, locked chips). `set` is null when every set of
// the exercise is done (the strip only).
export function SetEditor({
  exercise,
  set,
  draft,
  reps,
  lastTime,
  tablet = false,
  highlighted = false,
  validationError,
  pendingSetIds,
  onWeightChange,
  onUnitChange,
  onRepsChange,
  onStep,
  onToggleSet,
  action = null,
  cardRef,
}) {
  const stacked = useLargeTextReflow();
  const [focus, setFocus] = useState('');
  const sets = exercise.sets ?? [];
  const unit = draft?.actualWeightUnit || 'lb';
  const weightValue = draft?.actualWeightValue === undefined || draft?.actualWeightValue === null ? '' : String(draft.actualWeightValue);
  const setNumber = set?.set_number;
  const valueStyle = [styles.cellValue, tablet && styles.cellValueTablet];
  return (
    <View ref={cardRef} collapsable={false} testID="set-editor" style={[styles.card, tablet && styles.cardTablet, highlighted && styles.cardHighlighted]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardClip]}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      </View>
      {set ? (
        <>
          <View testID={`set-row-${set.id}`} style={[styles.cardHeader, stacked && styles.cardHeaderStacked]}>
            <Text {...CAP_BODY} style={[styles.setTitle, tablet && styles.setTitleTablet]}>
              {`Set ${setNumber} `}
              <Text style={styles.setOf}>{setOfLabel(set, sets.length)}</Text>
            </Text>
            {lastTime ? (
              <Text {...CAP_BODY} testID={`set-last-time-${set.id}`} style={styles.lastTime}>
                {lastTime}
              </Text>
            ) : null}
          </View>
          <View style={[styles.cells, (tablet || stacked) && styles.cellsColumn]}>
            <EditorCell
              tablet={tablet}
              stacked={stacked}
              focused={focus === 'weight'}
              error={Boolean(validationError)}
              label={
                <View style={styles.cellLabelRow}>
                  <Text {...CAP_BODY} style={styles.cellLabel}>Weight</Text>
                  <Select
                    testID={`set-unit-${set.id}`}
                    accessibilityLabel={`Weight unit for set ${setNumber}`}
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
                  {...DISPLAY_CAP}
                  testID={`set-weight-${set.id}`}
                  accessibilityLabel={`Weight for set ${setNumber}`}
                  accessibilityHint={validationError || undefined}
                  keyboardType="decimal-pad"
                  value={weightValue}
                  placeholder={set.target_weight_value != null ? String(set.target_weight_value) : '0'}
                  placeholderTextColor={colors.textFaint}
                  onChangeText={onWeightChange}
                  onFocus={() => setFocus('weight')}
                  onBlur={() => setFocus('')}
                  style={[valueStyle, validationError && styles.cellValueError]}
                />
              }
              steppers={
                <>
                  <Stepper testID={`set-weight-minus-${set.id}`} label="Decrease weight" glyph="−" tablet={tablet} onPress={() => onStep('weight', -1)} />
                  <Stepper testID={`set-weight-plus-${set.id}`} label="Increase weight" glyph="+" tablet={tablet} onPress={() => onStep('weight', 1)} />
                </>
              }
            />
            <EditorCell
              tablet={tablet}
              stacked={stacked}
              focused={focus === 'reps'}
              label={
                <Text {...CAP_BODY} style={[styles.cellLabel, styles.cellLabelReps]}>
                  {repsFieldLabel(set)}
                </Text>
              }
              value={
                <TextInput
                  {...textInputColors}
                  {...DISPLAY_CAP}
                  testID={`set-reps-${set.id}`}
                  accessibilityLabel={`Reps for set ${setNumber}`}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={reps ?? ''}
                  placeholder="—"
                  placeholderTextColor={colors.textFaint}
                  onChangeText={onRepsChange}
                  onFocus={() => setFocus('reps')}
                  onBlur={() => setFocus('')}
                  style={valueStyle}
                />
              }
              steppers={
                <>
                  <Stepper testID={`set-reps-minus-${set.id}`} label="Decrease reps" glyph="−" tablet={tablet} onPress={() => onStep('reps', -1)} />
                  <Stepper testID={`set-reps-plus-${set.id}`} label="Increase reps" glyph="+" tablet={tablet} onPress={() => onStep('reps', 1)} />
                </>
              }
            />
          </View>
          {validationError ? (
            <Text {...CAP_BODY} testID={`weight-error-${set.id}`} accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.validation}>
              {validationError}
            </Text>
          ) : null}
        </>
      ) : null}
      <View testID="set-strip" style={[styles.strip, !set && styles.stripOnly]}>
        {sets.map((item) => (
          <SetChip key={item.id} set={item} isNow={item.id === set?.id} tablet={tablet} pending={pendingSetIds?.has(item.id)} onPress={() => onToggleSet(item)} />
        ))}
      </View>
      {action ? <View style={styles.cardAction}>{action}</View> : null}
    </View>
  );
}

// Strip chips. A done chip is the Undo button (accessible name "Undo", the
// set in the description); locked chips keep v1's disabled action and hint.
function SetChip({ set, isNow, tablet, pending, onPress }) {
  const height = tablet ? 38 : 36;
  const chip = [styles.chip, { minHeight: height }];
  if (set.is_completed) {
    const text = doneSetLabel(set);
    return (
      <Pressable
        testID={`set-action-${set.id}`}
        accessibilityRole="button"
        accessibilityLabel={pending ? 'Saving…' : 'Undo'}
        accessibilityHint={`Set ${set.set_number} done, ${text}`}
        accessibilityState={{ disabled: Boolean(pending) }}
        disabled={Boolean(pending)}
        onPress={onPress}
        hitSlop={hitFor(height)}
        style={({ pressed }) => [chip, styles.chipDone, pressed && !pending && styles.chipPressed, pending && styles.dim]}
      >
        <CheckIcon size={14} color={colors.gold} />
        <Text {...CAP_PILL} textBreakStrategy="simple" style={[styles.chipText, styles.chipTextDone]}>
          {pending ? 'Saving…' : `${text} · Undo`}
        </Text>
      </Pressable>
    );
  }
  if (isNow) {
    return (
      <View testID={`set-chip-now-${set.id}`} style={[chip, styles.chipNow]}>
        <Text {...CAP_PILL} textBreakStrategy="simple" style={styles.chipText}>
          {tablet ? `Set ${set.set_number}` : `Set ${set.set_number} · now`}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      testID={`set-action-${set.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Set ${set.set_number}`}
      accessibilityHint="Finish the previous set first"
      accessibilityState={{ disabled: true }}
      disabled
      style={[chip, styles.chipLocked]}
    >
      <Text {...CAP_PILL} textBreakStrategy="simple" style={[styles.chipText, styles.chipTextLocked]}>
        {`Set ${set.set_number}`}
      </Text>
    </Pressable>
  );
}

// The one gold action (F1 dock): "Did it" / "Saving…" (names pinned).
// Disabled while the PATCH runs or the rest locks it: the drawn glass look
// (UX verdict P3-2: glass 0.05, 1px 0.08 border, text-faint), never a dimmed
// gold that the content behind could show through.
export function DidItButton({ set, isPending, isLocked, lockReason, onPress }) {
  const disabled = isPending || isLocked;
  const label = isPending ? 'Saving…' : 'Did it';
  const ink = disabled ? colors.textFaint : colors.onGold;
  // QA LOW: the dock sits outside the scroll; a swipe from here is no press.
  const swipe = useSwipeGuard();
  return (
    <Pressable
      testID={`set-action-${set.id}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={isLocked ? lockReason : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={swipe.onPressIn}
      onPressMove={swipe.onPressMove}
      onPress={swipe.guard(onPress)}
      style={[styles.didIt, disabled && styles.didItDisabled]}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled ? <PressOverlay ink /> : null}
          <CheckIcon size={20} color={ink} />
          <Text {...CAP_BODY} textBreakStrategy="simple" style={[styles.didItText, disabled && styles.didItTextDisabled]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// F1 dock "Up next: {name}" link (22 thumb), 44 hit area.
export function UpNextLink({ exercise, onPress }) {
  const name = exerciseName(exercise);
  return (
    <Pressable testID="up-next" accessibilityRole="button" accessibilityLabel={`Up next: ${name}`} onPress={onPress} hitSlop={hitFor(22)} style={styles.upNext}>
      {({ pressed }) => (
        <>
          <ExerciseImage
            testID="up-next-thumb"
            url={exercise.exercise?.thumbnail?.url ?? null}
            name={name}
            muscleCode={exercise.exercise?.primary_muscle_group?.code}
            size={22}
          />
          <Text {...CAP_BODY} style={[styles.upNextText, pressed && styles.upNextPressed]}>{`Up next: ${name}`}</Text>
        </>
      )}
    </Pressable>
  );
}

// "Last exercise — finish strong" (code copy, undrawn).
export function LastExerciseNote() {
  return (
    <View testID="last-exercise-note" style={styles.lastNote}>
      <Text {...CAP_BODY} style={styles.lastNoteText}>Last exercise — finish strong</Text>
    </View>
  );
}

// ND4: "Discard workout" = ghost with the danger text; pressed = danger
// faint (§8.6a 5, a transparent danger text button). In flight: "Exiting…".
export function DiscardWorkoutAction({ abandoning, onPress }) {
  return (
    <Pressable
      testID="discard-workout"
      accessibilityRole="button"
      accessibilityState={{ disabled: abandoning, busy: abandoning }}
      disabled={abandoning}
      onPress={onPress}
      style={({ pressed }) => [styles.discard, pressed && !abandoning && styles.discardPressed, abandoning && styles.dim]}
    >
      <Text {...CAP_BODY} textBreakStrategy="simple" style={styles.discardText}>
        {abandoning ? 'Exiting…' : 'Discard workout'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
  overlayRound: {
    borderRadius: radii.full,
  },
  dim: {
    opacity: 0.5,
  },
  // Chrome.
  chrome: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  chromeTablet: {
    paddingHorizontal: spacing[6],
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  chromeCentre: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  chromePlanRow: {
    alignItems: 'stretch',
  },
  // T-105: the phone subline (count · clock); the count gives way first.
  subline: {
    flexDirection: 'row',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  sublineCount: {
    flexShrink: 1,
    minWidth: 0,
  },
  complete: {
    minHeight: COMPLETE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['1_5'],
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderColor: colors.hairlineButton,
  },
  completeGold: {
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlow,
  },
  completeInactive: {
    opacity: 0.5,
  },
  completeLabel: {
    ...font(600),
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  glassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['1_5'],
    borderColor: colors.hairlineButton,
  },
  glassLabel: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  glassLabelTablet: {
    fontSize: 16,
    lineHeight: 22,
  },
  glassLabelSmall: {
    fontSize: 13,
    lineHeight: 18,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing['3_5'],
    borderColor: colors.hairlineButton,
    flexShrink: 0,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.dangerDot,
  },
  timerText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  timerTextTablet: {
    fontSize: 16,
    lineHeight: 22,
  },
  planPill: {
    maxWidth: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing['3_5'],
    paddingVertical: 5,
    borderColor: colors.hairlineButton,
  },
  planPillTablet: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  planPillStacked: {
    borderRadius: radii.xl,
  },
  planName: {
    ...font(700),
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  planNameTablet: {
    fontSize: 16,
    lineHeight: 20,
  },
  planSub: {
    ...font(400),
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: colors.textStrong2,
  },
  planSubTablet: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
  },
  // Stage.
  stage: {
    width: '100%',
    backgroundColor: colors.surface,
  },
  stageSplit: {
    flex: 1,
  },
  stagePhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  fadeSplit: {
    height: 420,
  },
  howToRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  howToRowSplit: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing[7],
    marginBottom: spacing[6],
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing['2_5'],
  },
  captionBrowse: {
    paddingBottom: spacing[3],
  },
  captionBrowseTablet: {
    gap: spacing[5],
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[7],
  },
  captionSplit: {
    paddingHorizontal: spacing[7],
    paddingBottom: 48,
  },
  captionText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textStrong2,
  },
  eyebrowBrowse: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
  },
  eyebrowBrowseTablet: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  eyebrowSplit: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  stageName: {
    ...typography.titleXl,
    lineHeight: 38,
    marginTop: spacing[1],
    color: colors.textPrimary,
  },
  stageNameBrowse: {
    lineHeight: 36,
    letterSpacing: titleTracking(36, -0.05),
  },
  stageNameBrowseTablet: {
    fontSize: 64,
    lineHeight: 64,
    letterSpacing: titleTracking(64, -0.05),
  },
  stageNameSplit: {
    ...typography.displayXl,
    marginTop: spacing[2],
  },
  stageNotes: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  muscleChip: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    marginTop: spacing['2_5'],
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
  },
  muscleChipTablet: {
    minHeight: 30,
    paddingHorizontal: spacing['3_5'],
  },
  muscleChipNeutral: {
    backgroundColor: colors.fillChip,
  },
  muscleText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
  },
  muscleTextTablet: {
    fontSize: 14,
    lineHeight: 18,
  },
  ringGlass: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 0,
  },
  ringText: {
    ...font(700),
    fontSize: 15,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  ringTextTablet: {
    fontSize: 24,
    lineHeight: 28,
  },
  segments: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing[5],
    paddingTop: spacing['3_5'],
  },
  segmentsTablet: {
    gap: spacing['1_5'],
    paddingHorizontal: 0,
    paddingTop: spacing[6],
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.hairlineButton,
  },
  segmentTablet: {
    height: 5,
  },
  segmentFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  rail: {
    height: 4,
    marginTop: spacing['1_5'],
    marginHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.track,
  },
  railInChrome: {
    marginTop: spacing[2],
    marginHorizontal: 0,
  },
  railFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    boxShadow: `0px 0px 12px ${colors.goldStrong}`,
  },
  // Messages.
  staleBanner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warningLine,
    backgroundColor: colors.warningFaint,
    padding: spacing[4],
  },
  bannerTitle: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  bannerBody: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textSecondary,
  },
  reloadBar: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerFaint,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  reloadTitle: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.dangerText,
  },
  reloadBody: {
    ...typography.bodySm,
    color: colors.dangerTextSoft,
  },
  retryRow: {
    alignItems: 'flex-start',
    marginTop: spacing[3],
  },
  // Browsing bar.
  browsingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.goldStrong,
    paddingVertical: spacing[2],
    paddingRight: spacing[2],
    paddingLeft: spacing[4],
  },
  browsingBarTablet: {
    gap: spacing[4],
    borderRadius: radii.xl,
    borderColor: colors.goldLine,
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing['5_5'],
  },
  browsingBarStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderRadius: radii.xl,
    padding: spacing[4],
  },
  browsingClip: {
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  browsingClipTablet: {
    borderRadius: radii.xl,
  },
  browsingDot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    boxShadow: `0px 0px 0px 6px ${colors.goldTint}`,
  },
  browsingText: {
    ...font(600),
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  browsingTextTablet: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  browsingTextStacked: {
    flex: 0,
  },
  // Stats.
  stats: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  statsStacked: {
    flexDirection: 'column',
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing[2],
  },
  statsCellStacked: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  statsDividerLeft: {
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  statsDividerTop: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  statsLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  statsValue: {
    ...font(700),
    marginTop: 1,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statsValueStacked: {
    marginTop: 0,
  },
  statsTablet: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  statTileTablet: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing[5],
  },
  statsLabelTablet: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  statsValueTablet: {
    ...font(700),
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statsUnitTablet: {
    ...font(400),
    fontSize: 18,
    letterSpacing: 0,
    color: colors.textMuted,
  },
  // Set card.
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing['4_5'],
  },
  cardTablet: {
    padding: spacing['5_5'],
  },
  cardHighlighted: {
    outlineWidth: 2,
    outlineColor: colors.goldStrong,
    outlineStyle: 'solid',
  },
  cardClip: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  cardHeaderStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  setTitle: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  setTitleTablet: {
    fontSize: 17,
    lineHeight: 22,
  },
  setOf: {
    ...font(500),
    color: colors.textFaint,
  },
  lastTime: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  cells: {
    flexDirection: 'row',
    gap: spacing['2_5'],
    marginTop: spacing['3_5'],
  },
  cellsColumn: {
    flexDirection: 'column',
    marginTop: spacing[4],
  },
  cell: {
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.fillWell,
    backgroundColor: colors.fillWell,
    padding: spacing[3],
  },
  cellHalf: {
    flex: 1,
    minWidth: 0,
  },
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
  },
  cellFocused: {
    borderColor: colors.gold,
    boxShadow: `0px 0px 0px 4px ${colors.goldFocus}`,
  },
  cellError: {
    borderColor: colors.dangerText,
    backgroundColor: colors.dangerTextTint,
    boxShadow: `0px 0px 0px 4px ${colors.dangerFocus}`,
  },
  cellColumn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing[2],
  },
  cellLeft: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: spacing['0_5'],
  },
  cellLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['1_5'],
  },
  cellLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cellLabelReps: {
    lineHeight: 24,
    textAlign: 'center',
  },
  cellValue: {
    ...typography.displayMd,
    letterSpacing: -1.76,
    minWidth: 72,
    alignSelf: 'stretch',
    padding: 0,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  cellValueTablet: {
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -1.92,
    alignSelf: 'flex-start',
    textAlign: 'left',
  },
  cellValueError: {
    color: colors.dangerText,
  },
  unitBox: {
    minHeight: 24,
    borderRadius: radii.sm,
    borderWidth: 0,
    backgroundColor: colors.fillButton,
    paddingHorizontal: spacing[2],
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  steppers: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  stepper: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.fillButton,
  },
  stepperGlyph: {
    ...font(600),
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  stepperGlyphTablet: {
    fontSize: 22,
    lineHeight: 26,
  },
  validation: {
    ...font(600),
    marginTop: spacing[2],
    fontSize: 13,
    lineHeight: 18,
    color: colors.dangerText,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  stripOnly: {
    marginTop: 0,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['1_5'],
    borderRadius: radii.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  chipDone: {
    backgroundColor: colors.goldTint,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipNow: {
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  chipLocked: {
    backgroundColor: colors.fillWell,
  },
  chipText: {
    ...font(600),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  chipTextDone: {
    color: colors.gold,
  },
  chipTextLocked: {
    color: colors.textFaint,
  },
  cardAction: {
    marginTop: spacing['3_5'],
  },
  // Did it.
  didIt: {
    minHeight: DID_IT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2_5'],
    borderRadius: radii.full,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing[6],
    boxShadow: shadows.goldGlow,
  },
  didItDisabled: {
    borderWidth: 1,
    borderColor: colors.glassDisabledBorder,
    backgroundColor: colors.fillChip,
    boxShadow: 'none',
  },
  didItTextDisabled: {
    color: colors.textFaint,
  },
  didItText: {
    ...font(700),
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
    textAlign: 'center',
    color: colors.onGold,
  },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing['2_5'],
    minHeight: 22,
  },
  upNextText: {
    ...typography.caption,
    flexShrink: 1,
    color: colors.textMuted,
  },
  upNextPressed: {
    color: colors.textSecondary,
  },
  lastNote: {
    alignItems: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  lastNoteText: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.gold,
  },
  discard: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: spacing[6],
  },
  discardPressed: {
    backgroundColor: colors.dangerFaint,
  },
  discardText: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.dangerText,
  },
});
