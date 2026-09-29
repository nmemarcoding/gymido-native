import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii, textStyles } from '../../../shared/theme/tokens';
import { formatStartedOnLabel } from '../../../shared/time/formatters';
import { ColorPressable } from '../../plans/components/PlanBits';
import ProgressRing from '../components/ProgressRing';
import { hubStyles, PRESS_SHADOW, SHADOW_BRAND, SHADOW_EMBOSS, SHADOW_LIFT_2_HOVER } from '../components/hubChrome';
import { exerciseName } from './runtimeRules';

const POP_IN = Easing.bezier(0.34, 1.56, 0.64, 1);

// StatTile (§19): the value re-mounts and plays popIn on every change.
export function StatTile({ label, value, tone }) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, easing: POP_IN, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [value, reducedMotion, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Animated.Text
        style={[
          styles.statValue,
          tone === 'brand' && { color: colors.brand600 },
          { opacity: progress, transform: [{ scale }] },
        ]}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

// SessionChrome (§19.1).
export function SessionChrome({ planName, completedSets, totalSets, exerciseCount, onExit, onShowAll }) {
  const reducedMotion = useReducedMotion();
  const ratio = totalSets > 0 ? completedSets / totalSets : 0;
  const [progress] = useState(() => new Animated.Value(ratio));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(ratio);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: ratio,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [ratio, reducedMotion, progress]);

  // Android hazard (app-shell §1.0): a gradient on a zero-sized view kills the
  // process during draw. The rail is always full width and scales instead, which
  // also matches the web's transform: scaleX(ratio).

  return (
    <View style={styles.chrome}>
      <View style={styles.chromeRow}>
        <ChromeButton testID="session-exit" label="Exit" onPress={onExit} pressedColor={colors.errorText} />
        <View style={styles.chromeCentre}>
          <Text numberOfLines={1} style={styles.chromePlan}>
            {planName}
          </Text>
          <Text style={styles.chromeSets}>{`${completedSets}/${totalSets} sets done`}</Text>
        </View>
        <ChromeButton
          testID="session-show-all"
          label={`All (${exerciseCount})`}
          onPress={onShowAll}
          color={colors.brand600}
          pressedColor={colors.brand700}
          bold
        />
      </View>
      <View importantForAccessibility="no" accessibilityElementsHidden style={styles.rail}>
        <Animated.View
          style={[styles.railFill, { transform: [{ scaleX: progress }] }]}
        />
      </View>
    </View>
  );
}

function ChromeButton({ testID, label, onPress, color = colors.textMuted, pressedColor, bold }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.chromeButton}
    >
      <Text style={[styles.chromeButtonLabel, { color: pressed ? pressedColor : color, fontWeight: bold ? '700' : '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// [O8] stale-session banner: the first child of the runtime's scroll content.
export function StaleSessionBanner({ startedAt }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="stale-session-banner" style={styles.banner}>
      <Text style={styles.bannerTitle}>{formatStartedOnLabel(new Date(startedAt))}</Text>
      <Text style={styles.bannerBody}>
        This workout is still open from an earlier day. Finish or end it, and today&apos;s workout will be ready when
        you come back.
      </Text>
    </View>
  );
}

// [O12 §2] Failed-reload bar. Not dismissible: it goes away only when a reload
// succeeds. Retry re-runs the whole six-call load; if that fails too, nothing
// changes — no backoff, no counter, no escalation, never permanently disabled.
export function ReloadErrorBar({ isRetrying, onRetry }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="reload-error-bar" style={styles.reloadBar}>
      <Text style={styles.reloadTitle}>Couldn&apos;t refresh your workout</Text>
      <Text style={styles.reloadBody}>Your last set was saved. Some details may be out of date.</Text>
      <ColorPressable
        testID="reload-retry"
        accessibilityRole="button"
        accessibilityState={{ disabled: isRetrying, busy: isRetrying }}
        disabled={isRetrying}
        onPress={onRetry}
        colorsFor={() => ({ backgroundColor: colors.surface })}
        style={({ pressed }) => [styles.retry, isRetrying && styles.retryBusy, pressed && !isRetrying && styles.sunk]}
      >
        <Text style={styles.retryLabel}>{isRetrying ? 'Retrying…' : 'Retry'}</Text>
      </ColorPressable>
    </View>
  );
}

// §19.4.
export function BrowsingBar({ onResume }) {
  return (
    <View testID="browsing-bar" style={styles.browsing}>
      <Text style={styles.browsingText}>You&apos;re browsing — active set is waiting</Text>
      <ColorPressable
        testID="browsing-resume"
        accessibilityRole="button"
        onPress={onResume}
        colorsFor={() => ({})}
        style={({ pressed }) => [styles.resume, pressed && styles.sunk]}
      >
        <Text style={styles.resumeLabel}>Resume</Text>
      </ColorPressable>
    </View>
  );
}

// §19.5.
export function UpNextCard({ exercise, setsLeft, onPress }) {
  const [pressed, setPressed] = useState(false);
  const muscle = exercise?.exercise?.primary_muscle_group?.name;
  const thumbnail = exercise?.exercise?.thumbnail?.url;
  return (
    <Pressable
      testID="up-next-card"
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[hubStyles.card3d, styles.upNext, pressed && styles.cardPressed]}
    >
      <View style={styles.upNextThumb}>
        {thumbnail ? <Image source={{ uri: thumbnail }} resizeMode="contain" style={styles.upNextImage} /> : null}
      </View>
      <View style={styles.upNextColumn}>
        <Text style={styles.upNextEyebrow}>Up next</Text>
        {/* [O11] the NAME only. The eyebrow and the sub-line stay one line. */}
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.upNextName}>
          {exerciseName(exercise)}
        </Text>
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.upNextMeta}>
          {`${setsLeft} sets left${muscle ? ` · ${muscle}` : ''}`}
        </Text>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.noShrink}>
        <Path d="m9 18 6-6-6-6" stroke={colors.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

export function LastExerciseNote() {
  return (
    <View style={styles.lastExercise}>
      <Text style={styles.lastExerciseText}>Last exercise — finish strong</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statTile: {
    flex: 1,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    boxShadow: SHADOW_EMBOSS,
  },
  statLabel: {
    ...textStyles.statLabel,
    letterSpacing: 1.56,
    color: colors.textMuted,
  },
  statValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  chrome: {
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,231,235,0.80)',
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chromeButton: {
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 12,
  },
  chromeButtonLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  chromeCentre: {
    flex: 1,
    alignItems: 'center',
  },
  chromePlan: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  chromeSets: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rail: {
    height: 4,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  railFill: {
    width: '100%',
    // scaleX grows from the left edge, like the web's transform-origin: left.
    transformOrigin: 'left center',
    height: 4,
    borderRadius: radii.full,
    experimental_backgroundImage: 'linear-gradient(to right, #f7ce4f, #dda000)',
  },
  banner: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.brandBorder,
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
  browsing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(244,180,0,0.40)',
    backgroundColor: colors.brand50,
    paddingHorizontal: 16,
    paddingVertical: 10,
    boxShadow: SHADOW_EMBOSS,
  },
  browsingText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand700,
  },
  resume: {
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 16,
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #f4b400)',
    boxShadow: SHADOW_BRAND,
  },
  resumeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  sunk: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  cardPressed: {
    boxShadow: SHADOW_LIFT_2_HOVER,
    transform: [{ translateY: -2 }],
  },
  reloadBar: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reloadTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#c10007',
  },
  reloadBody: {
    fontSize: 14,
    lineHeight: 24,
    color: '#c10007',
  },
  retry: {
    marginTop: 12,
    height: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
  },
  retryBusy: {
    opacity: 0.6,
  },
  retryLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noShrink: {
    flexShrink: 0,
  },
  upNextThumb: {
    flexShrink: 0,
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: PRESS_SHADOW,
    overflow: 'hidden',
  },
  upNextImage: {
    width: '100%',
    height: 80,
  },
  upNextColumn: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  upNextEyebrow: {
    ...textStyles.eyebrow,
    color: colors.textMuted,
  },
  upNextName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  upNextMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  lastExercise: {
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    boxShadow: SHADOW_EMBOSS,
  },
  lastExerciseText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
});

export { ProgressRing };
