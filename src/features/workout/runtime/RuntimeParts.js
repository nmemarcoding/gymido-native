import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import RemoteImage from '../../../shared/components/RemoteImage';
import Select from '../../../shared/components/Select';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { breakpoints, colors, radii, shadows, textInputColors } from '../../../shared/theme/tokens';
import BrandButton from '../components/BrandButton';
import Card3D from '../components/Card3D';
import ProgressRing from '../components/ProgressRing';
import { exerciseName, exerciseNotes, setMetaLabel, setRepsLabel, setsWord } from './sessionMath';

const GOLD = [colors.brand300, colors.brand500];
const GOLD_BUTTON = [colors.brand300, colors.brand400];
const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

function CheckIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

// §19 StatTile: the value re-mounts on every change and pops in.
export function StatTile({ label, value, tone }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <PopIn key={value}>
        <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.statValue, tone === 'brand' && styles.statValueBrand]}>{value}</Text>
      </PopIn>
    </View>
  );
}

function PopIn({ children }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    // The setting resolves after mount, possibly mid-animation: snap to the
    // end state or the value stays invisible (the Time tile remounts every
    // second, so it hit this every time).
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, easing: POP, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  return <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>{children}</Animated.View>;
}

// §19.1, pinned to the top (§19.0). The rail fill is a full-width view
// scaled by scaleX, never a width (§19.10).
export function SessionChrome({ planName, completedSets, totalSets, exerciseCount, onExit, onAll, allRef }) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const ratio = totalSets > 0 ? completedSets / totalSets : 0;
  const scale = useRef(new Animated.Value(ratio)).current;
  // The measured width anchors the scaleX at the left edge.
  const [railWidth, setRailWidth] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(ratio);
      return undefined;
    }
    const animation = Animated.timing(scale, { toValue: ratio, duration: 300, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [ratio, reducedMotion, scale]);

  return (
    <View testID="session-chrome" style={[styles.chrome, width >= breakpoints.md && styles.chromeWide]}>
      <BlurLayer blurPx={24} />
      <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
      <View style={[styles.chromeRow, { paddingHorizontal: width >= breakpoints.sm ? 20 : 16 }]}>
        <Pressable testID="session-exit" accessibilityRole="button" onPress={onExit} style={styles.chromeButton}>
          {({ pressed }) => <Text style={[styles.exitText, pressed && styles.exitPressed]}>Exit</Text>}
        </Pressable>
        <View style={styles.chromeCentre}>
          <Text textBreakStrategy="simple" numberOfLines={1} ellipsizeMode="tail" style={styles.chromeTitle}>
            {planName}
          </Text>
          <Text style={styles.chromeSub}>{`${completedSets}/${totalSets} ${setsWord(totalSets)} done`}</Text>
        </View>
        <Pressable ref={allRef} testID="session-all" accessibilityRole="button" onPress={onAll} style={styles.chromeButton}>
          {({ pressed }) => <Text style={[styles.allText, pressed && styles.allPressed]}>{`All (${exerciseCount})`}</Text>}
        </Pressable>
      </View>
      <View style={styles.rail} onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.railFill,
            { transform: [{ translateX: scale.interpolate({ inputRange: [0, 1], outputRange: [-railWidth / 2, 0] }) }, { scaleX: scale }] },
          ]}
        >
          <GradientFill angle={90} colors={GOLD} />
        </Animated.View>
      </View>
    </View>
  );
}

// [O8]
export function StaleSessionBanner({ title }) {
  return (
    <View testID="stale-session-banner" accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.staleBanner}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerBody}>
        This workout is still open from an earlier day. Finish or end it, and today's workout will be ready when you come back.
      </Text>
    </View>
  );
}

// [O12 §2]
export function ReloadErrorBar({ retrying, onRetry }) {
  return (
    <View testID="reload-error-bar" style={styles.reloadBar}>
      <Text style={styles.reloadTitle}>Couldn't refresh your workout</Text>
      <Text style={styles.reloadBody}>Your last set was saved. Some details may be out of date.</Text>
      <Pressable
        testID="reload-error-retry"
        accessibilityRole="button"
        disabled={retrying}
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && !retrying ? styles.pressedSink : styles.retryResting, retrying && styles.dim]}
      >
        <Text style={styles.retryText}>{retrying ? 'Retrying…' : 'Retry'}</Text>
      </Pressable>
    </View>
  );
}

// §19.4
export function BrowsingBar({ onResume }) {
  return (
    <View testID="browsing-bar" style={styles.browsingBar}>
      <Text style={styles.browsingText}>You're browsing — active set is waiting</Text>
      <BrandButton testID="browsing-resume" label="Resume" onPress={onResume} style={styles.resume} labelStyle={styles.resumeLabel} />
    </View>
  );
}

// §19.5 with [O11]: the name takes 2 lines.
export function UpNextCard({ exercise, setsLeft, onPress }) {
  const muscle = exercise.exercise?.primary_muscle_group?.name;
  const url = exercise.exercise?.thumbnail?.url;
  return (
    <Pressable testID="up-next" accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <Card3D style={[styles.upNext, pressed && styles.cardPressed]}>
          <View style={styles.upNextThumb}>{url ? <RemoteImage url={url} style={styles.upNextImage} resizeMode="contain" /> : null}</View>
          <View style={styles.upNextText}>
            <Text numberOfLines={1} style={styles.upNextEyebrow}>
              Up next
            </Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.upNextName}>
              {exerciseName(exercise)}
            </Text>
            <Text numberOfLines={1} style={styles.upNextSub}>
              {`${setsLeft} ${setsWord(setsLeft)} left${muscle ? ` · ${muscle}` : ''}`}
            </Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={styles.noShrink}>
            <Path d="m9 18 6-6-6-6" />
          </Svg>
        </Card3D>
      )}
    </Pressable>
  );
}

// §19.2
export function ExerciseStage({ exercise, index, count, isActive, children }) {
  const { width } = useWindowDimensions();
  const sets = exercise.sets ?? [];
  const done = sets.filter((set) => set.is_completed).length;
  const notes = exerciseNotes(exercise);
  const muscle = exercise.exercise?.primary_muscle_group?.name;
  const url = exercise.exercise?.thumbnail?.url;
  const nameSize = width >= 1280 ? styles.stageName30 : width >= breakpoints.sm ? styles.stageName24 : null;
  return (
    <Card3D testID="exercise-stage" style={[styles.stage, { padding: width >= breakpoints.sm ? 24 : 20 }]}>
      <View style={styles.stageTop}>
        <View style={styles.stageText}>
          <Text style={styles.eyebrow}>{isActive ? 'Current exercise' : `Exercise ${index + 1} of ${count}`}</Text>
          <Text textBreakStrategy="simple" style={[styles.stageName, nameSize]}>{exerciseName(exercise)}</Text>
          {notes ? <Text style={styles.stageNotes}>{notes}</Text> : null}
          {muscle ? (
            <View style={styles.muscleChip}>
              <Text style={styles.muscleText}>{muscle}</Text>
            </View>
          ) : null}
        </View>
        <ProgressRing value={done} total={sets.length} size={56} thickness={8} label={`${done} of ${sets.length} ${setsWord(sets.length)} done`}>
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.stageRingText}>{`${done}/${sets.length}`}</Text>
        </ProgressRing>
      </View>
      {url ? (
        <View style={[styles.mediaWell, { minHeight: width >= breakpoints.sm ? 224 : 176 }]}>
          <GradientFill colors={[colors.surfaceMuted, colors.surface]} />
          {/* §19.2 + the RemoteImage port note (§19.7): Drive fallbacks, no
              referrer; keyed by URL so another exercise starts a fresh chain.
              Like the web, an exhausted chain leaves the well empty. */}
          <RemoteImage key={url} url={url} resizeMode="contain" style={{ width: '100%', height: width >= breakpoints.sm ? 208 : 160 }} />
        </View>
      ) : null}
      <View style={styles.setList}>{children}</View>
    </Card3D>
  );
}

// §19.3. Both gradient layers (next badge, "Did it") are always mounted and
// only revealed by opacity, so no state change creates a gradient (§19.10).
export function SetRow({
  set,
  draft,
  isNext,
  isLocked,
  lockReason,
  isPending,
  highlighted,
  validationError,
  onWeightChange,
  onUnitChange,
  onToggle,
  onLayout,
}) {
  const completed = Boolean(set.is_completed);
  const actionable = !completed && !isLocked;
  const label = isPending ? 'Saving…' : completed ? 'Undo' : 'Did it';
  const disabled = isPending || isLocked;
  return (
    <View
      testID={`set-row-${set.id}`}
      onLayout={onLayout}
      style={[styles.setRow, completed ? styles.setCompleted : isNext ? styles.setNext : styles.setOther, highlighted && styles.setHighlighted]}
    >
      <View style={styles.setHeader}>
        <View style={styles.setHeaderLeft}>
          <View style={[styles.badge, completed ? styles.badgeCompleted : isNext ? styles.badgeNext : styles.badgeOther]}>
            <View style={[StyleSheet.absoluteFill, styles.badgeClip, { opacity: isNext && !completed ? 1 : 0 }]}>
              <GradientFill angle={135} colors={GOLD} />
            </View>
            {completed ? (
              <CheckIcon size={16} color={colors.brand700} />
            ) : (
              <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.badgeText, { color: isNext ? colors.navy : colors.textSecondary }]}>{set.set_number}</Text>
            )}
          </View>
          <View style={styles.setText}>
            <Text style={styles.repsLabel}>{setRepsLabel(set)}</Text>
            <Text style={styles.setMeta}>{setMetaLabel(set, isNext)}</Text>
          </View>
        </View>
        {completed ? <Text style={styles.doneText}>Done</Text> : null}
      </View>
      <View style={styles.controls}>
        <TextInput
          {...textInputColors}
          testID={`set-weight-${set.id}`}
          accessibilityLabel={`Weight for set ${set.set_number}`}
          keyboardType="decimal-pad"
          value={draft?.actualWeightValue === undefined || draft?.actualWeightValue === null ? '' : String(draft.actualWeightValue)}
          placeholder={set.target_weight_value != null ? String(set.target_weight_value) : '0'}
          placeholderTextColor={colors.textMuted}
          onChangeText={onWeightChange}
          style={[styles.weightInput, validationError && styles.weightError]}
        />
        <Select
          testID={`set-unit-${set.id}`}
          accessibilityLabel={`Weight unit for set ${set.set_number}`}
          value={draft?.actualWeightUnit || 'lb'}
          options={[
            { value: 'lb', label: 'lb' },
            { value: 'kg', label: 'kg' },
          ]}
          onChange={onUnitChange}
          boxStyle={styles.unitBox}
          textStyle={styles.unitText}
        />
        <Pressable
          testID={`set-action-${set.id}`}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={isLocked ? lockReason : undefined}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.action,
            completed ? styles.actionUndo : isLocked ? styles.actionLocked : styles.actionGold,
            pressed && !disabled && styles.pressedSink,
            disabled && styles.dim,
          ]}
        >
          <View style={[StyleSheet.absoluteFill, styles.actionClip, { opacity: actionable ? 1 : 0 }]}>
            <GradientFill colors={GOLD_BUTTON} />
          </View>
          <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.actionText, { color: completed ? colors.textSecondary : isLocked ? colors.textMuted : colors.navy }]}>{label}</Text>
        </Pressable>
      </View>
      {validationError ? (
        <Text testID={`weight-error-${set.id}`} style={styles.validation}>
          {validationError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statTile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 12,
    boxShadow: `${shadows.emboss}, ${shadows.ringInk}`,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 15.6,
    fontWeight: '700',
    letterSpacing: 1.56,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statValueBrand: {
    color: colors.brand700,
  },
  chrome: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassEdge,
  },
  chromeWide: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  glassFill: {
    backgroundColor: colors.glassFill,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
  },
  chromeButton: {
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 12,
  },
  exitText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  exitPressed: {
    color: colors.danger700,
  },
  allText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  allPressed: {
    color: colors.brand700,
    opacity: 0.8,
  },
  chromeCentre: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  chromeTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  chromeSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  rail: {
    height: 4,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  railFill: {
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  staleBanner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.trainerLockBorder,
    backgroundColor: colors.brand50,
    padding: 16,
  },
  bannerTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bannerBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  reloadBar: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.errorFill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reloadTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.errorText,
  },
  reloadBody: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.errorText,
  },
  retry: {
    alignSelf: 'flex-start',
    height: 44,
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
  },
  retryResting: {
    boxShadow: shadows.lift1,
  },
  retryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pressedSink: {
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  dim: {
    opacity: 0.6,
  },
  browsingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brandEdge,
    backgroundColor: colors.brand50,
    paddingHorizontal: 16,
    paddingVertical: 10,
    boxShadow: shadows.emboss,
  },
  browsingText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand700,
  },
  resume: {
    height: 44,
    borderRadius: radii.full,
    paddingHorizontal: 16,
  },
  resumeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  cardPressed: {
    transform: [{ translateY: -2 }],
    boxShadow: shadows.lift3,
  },
  upNextThumb: {
    width: 96,
    height: 96,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    boxShadow: shadows.press,
  },
  upNextImage: {
    width: 96,
    height: 80,
  },
  upNextText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  upNextEyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  upNextName: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  upNextSub: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  noShrink: {
    flexShrink: 0,
  },
  stage: {},
  stageTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
  },
  stageText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  stageName: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  stageName24: {
    fontSize: 24,
    lineHeight: 30,
  },
  stageName30: {
    fontSize: 30,
    lineHeight: 37.5,
  },
  stageNotes: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  muscleChip: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    boxShadow: shadows.emboss,
  },
  muscleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  stageRingText: {
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  mediaWell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 24,
    borderRadius: 24,
    padding: 16,
    boxShadow: `${shadows.press}, ${shadows.ringInk}`,
  },
  setList: {
    gap: 12,
    marginTop: 24,
  },
  setRow: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
  },
  setCompleted: {
    borderColor: colors.border,
    backgroundColor: colors.rowPressed,
    boxShadow: shadows.emboss,
  },
  setNext: {
    borderColor: colors.setNextBorder,
    backgroundColor: colors.surface,
    boxShadow: shadows.lift2,
  },
  setOther: {
    borderColor: colors.border,
    backgroundColor: colors.rowPressedStrong,
    boxShadow: shadows.press,
  },
  setHighlighted: {
    outlineWidth: 2,
    outlineColor: colors.setHighlightOutline,
    outlineStyle: 'solid',
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  setHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  badgeNext: {
    boxShadow: shadows.lift1,
  },
  badgeCompleted: {
    backgroundColor: colors.brandTintStrong,
    boxShadow: shadows.emboss,
  },
  badgeOther: {
    backgroundColor: colors.surfaceMuted,
    boxShadow: shadows.press,
  },
  badgeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  setText: {
    flex: 1,
    minWidth: 0,
  },
  repsLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  setMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  doneText: {
    fontSize: 11,
    lineHeight: 15.6,
    fontWeight: '700',
    letterSpacing: 0.26,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  weightInput: {
    flex: 1,
    minWidth: 96,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    boxShadow: shadows.press,
  },
  weightError: {
    borderColor: colors.dangerText,
    backgroundColor: colors.errorFill,
    color: colors.danger700,
    outlineWidth: 2,
    outlineColor: colors.dangerBorderSoft,
    outlineStyle: 'solid',
  },
  unitBox: {
    width: 40,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.press,
  },
  unitText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  action: {
    width: 112,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  // The gold layer clips itself. Android stops drawing a view's children when
  // its border/background change at runtime while it has overflow hidden and
  // a radius (the locked → "Did it" switch left the button blank), so the
  // pressable itself never clips.
  actionClip: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  actionGold: {
    boxShadow: shadows.brand,
  },
  actionUndo: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.lift1,
  },
  actionLocked: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  actionText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '900',
  },
  validation: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.danger700,
  },
});
