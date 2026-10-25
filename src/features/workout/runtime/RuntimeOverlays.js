import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import BlurLayer from '../../../shared/components/BlurLayer';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import Spinner from '../../../shared/components/Spinner';
import { formatNumber, formatWeight } from '../../../shared/format/numbers';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { formatDuration } from '../../../shared/time/format';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import ProgressRing from '../components/ProgressRing';
import { formatClock } from './restEngine';
import { setsWord } from './sessionMath';
import { StatTile } from './RuntimeParts';

const DISC = ['#f7ce4f', '#f4b400', '#dda000'];
const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
const MARGIN = 8;

function clampPosition(position, size, window, insets) {
  const minX = MARGIN + insets.left;
  const minY = MARGIN + insets.top;
  const maxX = Math.max(minX, window.width - insets.right - size - MARGIN);
  const maxY = Math.max(minY, window.height - insets.bottom - size - MARGIN);
  return { x: Math.min(Math.max(minX, position.x), maxX), y: Math.min(Math.max(minY, position.y), maxY) };
}

// The countdown ring traced around a disc (viewBox 40).
function CountdownRing({ size, radius, strokeWidth, ratio }) {
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" style={[StyleSheet.absoluteFill, styles.rotated]}>
      <Circle cx={20} cy={20} r={radius} fill="none" stroke="rgba(17, 24, 39, 0.15)" strokeWidth={strokeWidth} />
      <Circle
        cx={20}
        cy={20}
        r={radius}
        fill="none"
        stroke={colors.navy}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - ratio)}
      />
    </Svg>
  );
}

const PULSE_EASING = Easing.out(Easing.ease);

function Countdown({ seconds, style }) {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const finalTen = seconds <= 10;
  useEffect(() => {
    if (!finalTen || reducedMotion) {
      pulse.setValue(1);
      return undefined;
    }
    // Design system v1 #12: the digits pulse 1 → 1.06, once a second,
    // ease-out; the depleting ring is the motion-free cue.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 500, easing: PULSE_EASING, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: PULSE_EASING, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [finalTen, pulse, reducedMotion]);
  return (
    <Animated.Text numberOfLines={1} textBreakStrategy="simple" style={[style, finalTen && styles.countdownDanger, { transform: [{ scale: pulse }] }]}>{formatClock(seconds)}</Animated.Text>
  );
}

// Design system v1 P10: the workout dialogs pop in (260 ms, ease-pop: a
// slight overshoot to scale 1), instantly under reduced motion.
function usePopIn(open) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) {
      progress.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, easing: POP, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [open, progress, reducedMotion]);
  return { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] };
}

const EXPAND_ACTIONS = [{ name: 'activate', label: 'Expand rest timer' }];
// Design system v1 #10: 44 pt targets, visuals unchanged. Measured with P2's
// spacing: the ±5 row ends 16 pt above Skip rest, so these never overlap
// (4 + 9 < 16) and a −5 tap can't skip.
const ADJUST_HIT_SLOP = { top: 4, bottom: 4 };
const SKIP_HIT_SLOP = { top: 9, bottom: 9 };

// §22.1–§22.2: draggable in both sizes (4 pt threshold, 8 pt clamp from the
// safe-area edges, re-clamped on every tick), no release animation; the four
// inner controls never start a drag.
export function RestTimerWidget({ timer, minimized, onMinimize, onExpand, onAdjust, onSkip, position, onPosition }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = minimized ? 80 : Math.min(288, window.width - 24);
  const defaultPosition = { x: (window.width - size) / 2, y: insets.top + 12 };
  const current = clampPosition(position ?? defaultPosition, size, window, insets);
  const drag = useRef({ moved: false, startX: 0, startY: 0, origin: current });
  const latest = useRef({ current, minimized, onExpand, onPosition, size, window, insets });
  latest.current = { current, minimized, onExpand, onPosition, size, window, insets };

  // Re-clamp on each tick, so a rotation pulls it back within about a second.
  useEffect(() => {
    if (position && (position.x !== current.x || position.y !== current.y)) {
      onPosition(current);
    }
  }, [timer?.secondsLeft, position, current, onPosition]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          drag.current = {
            moved: false,
            startX: event.nativeEvent.pageX,
            startY: event.nativeEvent.pageY,
            origin: latest.current.current,
          };
        },
        onPanResponderMove: (event) => {
          const dx = event.nativeEvent.pageX - drag.current.startX;
          const dy = event.nativeEvent.pageY - drag.current.startY;
          if (!drag.current.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) {
            return;
          }
          drag.current.moved = true;
          const { size: s, window: w, insets: i } = latest.current;
          latest.current.onPosition(clampPosition({ x: drag.current.origin.x + dx, y: drag.current.origin.y + dy }, s, w, i));
        },
        onPanResponderRelease: () => {
          if (!drag.current.moved && latest.current.minimized) {
            latest.current.onExpand();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    []
  );

  if (!timer) {
    return null;
  }
  const ratio = timer.totalSeconds > 0 ? timer.secondsLeft / timer.totalSeconds : 0;

  return (
    <View
      testID="rest-timer"
      {...pan.panHandlers}
      // §22.1 "Tap expands", for screen readers too: the PanResponder only
      // sees touches, so VoiceOver / TalkBack activation is wired explicitly.
      accessible={minimized ? true : undefined}
      accessibilityRole={minimized ? 'button' : undefined}
      accessibilityLabel={minimized ? 'Expand rest timer' : undefined}
      accessibilityActions={minimized ? EXPAND_ACTIONS : undefined}
      onAccessibilityAction={minimized ? (event) => event.nativeEvent.actionName === 'activate' && onExpand() : undefined}
      onAccessibilityTap={minimized ? onExpand : undefined}
      style={[styles.disc, { left: current.x, top: current.y, width: size, height: size, borderRadius: size / 2 }]}
    >
      {/* Remounted per size, so this clipping layer's radius never changes
          while it lives (Android blank-render class). */}
      <View key={minimized ? 'small' : 'large'} style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>
        <GradientFill angle={135} colors={DISC} />
      </View>
      {minimized ? (
        <>
          <CountdownRing size={size} radius={18} strokeWidth={2.5} ratio={ratio} />
          <Countdown seconds={timer.secondsLeft} style={styles.countdownSmall} />
        </>
      ) : (
        <>
          <CountdownRing size={size} radius={18.5} strokeWidth={2} ratio={ratio} />
          <Pressable
            testID="rest-timer-minimize"
            accessibilityRole="button"
            accessibilityLabel="Minimize rest timer"
            onPress={onMinimize}
            hitSlop={6}
            style={styles.minimize}
          >
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.minimizeText}>–</Text>
          </Pressable>
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.resting}>Resting</Text>
          <Countdown seconds={timer.secondsLeft} style={styles.countdownLarge} />
          <View style={styles.adjustRow}>
            <Pressable
              testID="rest-timer-minus"
              accessibilityRole="button"
              accessibilityLabel="Decrease rest timer by 5 seconds"
              onPress={() => onAdjust(-5)}
              hitSlop={ADJUST_HIT_SLOP}
              style={styles.adjust}
            >
              <Text numberOfLines={1} textBreakStrategy="simple" style={styles.adjustText}>−5s</Text>
            </Pressable>
            <Pressable
              testID="rest-timer-plus"
              accessibilityRole="button"
              accessibilityLabel="Increase rest timer by 5 seconds"
              onPress={() => onAdjust(5)}
              hitSlop={ADJUST_HIT_SLOP}
              style={styles.adjust}
            >
              <Text numberOfLines={1} textBreakStrategy="simple" style={styles.adjustText}>+5s</Text>
            </Pressable>
          </View>
          <Pressable testID="rest-timer-skip" accessibilityRole="button" onPress={onSkip} hitSlop={SKIP_HIT_SLOP} style={styles.skip}>
            <Text numberOfLines={1} textBreakStrategy="simple" style={styles.skipText}>Skip rest</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// §23.2: closes only through its button.
export function CompletionPopup({ popup, onClose }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!popup) {
      progress.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, easing: POP, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [popup, progress, reducedMotion]);
  if (!popup) {
    return null;
  }
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={styles.popupHost}>
        <BlurLayer blurPx={8} overApp />
        <View style={[StyleSheet.absoluteFill, styles.popupScrim]} />
        <Animated.View testID="completion-popup" style={[styles.popupCard, { opacity: progress, transform: [{ scale }] }]}>
          <View style={styles.popupTop}>
            <View style={styles.popupText}>
              <Text textBreakStrategy="simple" style={styles.popupEyebrow}>Workout complete</Text>
              <Text textBreakStrategy="simple" style={styles.popupTitle}>Great job!</Text>
              <Text style={styles.popupBody}>{`You finished ${popup.planName} and kept your momentum today.`}</Text>
            </View>
            <ProgressRing
              value={popup.completedSets}
              total={popup.totalSets}
              size={76}
              thickness={9}
              label={`${popup.completedSets} of ${popup.totalSets} ${setsWord(popup.totalSets)} completed`}
            >
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#dda000" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 6 9 17l-5-5" />
              </Svg>
            </ProgressRing>
          </View>
          <View style={styles.popupGrid}>
            <View style={styles.popupGridRow}>
              <StatTile label="Time" value={formatDuration(popup.durationSeconds)} />
              <StatTile label="Volume" value={formatWeight(popup.totalVolume, 'lb', 0)} />
            </View>
            <View style={styles.popupGridRow}>
              <StatTile label="Reps" value={formatNumber(popup.totalReps, 0)} />
              <StatTile label="Progress" value={`${popup.completedExercises}/${popup.totalExercises} ex`} />
            </View>
          </View>
          <Text style={styles.popupLine}>{`${popup.completedSets}/${popup.totalSets} ${setsWord(popup.totalSets)} done. Consistency wins.`}</Text>
          {/* Design system v1 #18: a primary pill, no hero gradient. */}
          <View style={styles.awesome}>
            <PillButton testID="completion-awesome" title="Awesome" fullWidth onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// §24: Android back = "Keep going".
export function DiscardDialog({ open, onKeep, onDiscard }) {
  const pop = usePopIn(open);
  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onKeep} statusBarTranslucent>
      <View style={styles.popupHost}>
        <BlurLayer blurPx={8} overApp />
        <View style={[StyleSheet.absoluteFill, styles.dialogScrim]} />
        <Animated.View testID="discard-dialog" accessibilityViewIsModal accessibilityRole="none" accessibilityLabel="Discard this workout?" style={[styles.dialogCard, pop]}>
          <Text textBreakStrategy="simple" style={styles.dialogTitle}>Discard this workout?</Text>
          <Text style={styles.dialogBody}>Your progress won't be saved and this session will be discarded.</Text>
          <View style={styles.dialogButtons}>
            <Pressable testID="discard-keep" accessibilityRole="button" onPress={onKeep} style={({ pressed }) => [styles.keep, pressed && styles.keepPressed]}>
              <Text style={styles.keepText}>Keep going</Text>
            </Pressable>
            <Pressable testID="discard-confirm" accessibilityRole="button" onPress={onDiscard} style={({ pressed }) => [styles.discard, pressed && styles.discardPressed]}>
              <Text style={styles.discardText}>Discard</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// A2 rule 3 (time spec): ConfirmDialog anatomy, new copy. Android back and
// the scrim = "Not now"; focus starts on "Open settings".
export function ExactAlarmDialog({ open, onNotNow, onOpenSettings }) {
  const settingsRef = useRef(null);
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        const node = findNodeHandle(settingsRef.current);
        if (node) {
          AccessibilityInfo.setAccessibilityFocus(node);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onNotNow} statusBarTranslucent>
      <View style={styles.popupHost}>
        <BlurLayer blurPx={8} overApp />
        <Pressable testID="exact-alarm-scrim" accessible={false} onPress={onNotNow} style={[StyleSheet.absoluteFill, styles.dialogScrim]} />
        <View testID="exact-alarm-dialog" accessibilityViewIsModal role="dialog" accessibilityLabel="Get rest alerts on time?" style={styles.dialogCard}>
          <Text textBreakStrategy="simple" accessibilityRole="header" style={styles.dialogTitle}>
            Get rest alerts on time?
          </Text>
          <Text style={styles.dialogBody}>
            Android can hold back your rest alert, sometimes by minutes. Allow "Alarms & reminders" for Gymido so it arrives the moment your rest ends.
          </Text>
          <View style={styles.dialogButtons}>
            <Pressable testID="exact-alarm-not-now" accessibilityRole="button" onPress={onNotNow} style={({ pressed }) => [styles.keep, pressed && styles.keepPressed]}>
              <Text style={styles.keepText}>Not now</Text>
            </Pressable>
            <Pressable
              ref={settingsRef}
              testID="exact-alarm-open-settings"
              accessibilityRole="button"
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.openSettings, pressed && styles.openSettingsPressed]}
            >
              <Text style={styles.openSettingsText}>Open settings</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// RN-SPEC-time A3: the one-time "Hear your rest timer" pop-up, at a rest
// start that showed no other dialog. Back, the scrim and "Keep it on" keep
// the spoken cue on; it never asks for notification permission. Focus lands
// on the title, then the primary button.
export function SpeakIntroDialog({ open, onKeepOn, onTurnOff, onOpenAnnounceSettings }) {
  const titleRef = useRef(null);
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        const node = findNodeHandle(titleRef.current);
        if (node) {
          AccessibilityInfo.setAccessibilityFocus(node);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onKeepOn} statusBarTranslucent>
      <View style={styles.popupHost}>
        <BlurLayer blurPx={8} overApp />
        <Pressable testID="speak-intro-scrim" accessible={false} onPress={onKeepOn} style={[StyleSheet.absoluteFill, styles.dialogScrim]} />
        <View testID="speak-intro-dialog" accessibilityViewIsModal role="dialog" accessibilityLabel="Hear your rest timer" style={styles.dialogCard}>
          <Text ref={titleRef} textBreakStrategy="simple" accessibilityRole="header" style={styles.dialogTitle}>
            Hear your rest timer
          </Text>
          <Text style={styles.dialogBody}>
            We'll say "Rest complete" out loud when your rest ends. You can change this anytime in Profile.
          </Text>
          {Platform.OS === 'ios' ? (
            <>
              <Text style={styles.dialogBody}>With AirPods, Siri can also read it out if Announce Notifications is on.</Text>
              <Pressable
                testID="speak-intro-siri"
                accessibilityRole="link"
                onPress={onOpenAnnounceSettings}
                style={({ pressed }) => [styles.siriLink, pressed && styles.siriLinkPressed]}
              >
                <Text style={styles.siriLinkText}>Set up Siri announcements</Text>
              </Pressable>
            </>
          ) : null}
          <View style={styles.dialogButtons}>
            <Pressable testID="speak-intro-turn-off" accessibilityRole="button" onPress={onTurnOff} style={({ pressed }) => [styles.keep, pressed && styles.keepPressed]}>
              <Text style={styles.keepText}>Turn off</Text>
            </Pressable>
            <Pressable
              testID="speak-intro-keep-on"
              accessibilityRole="button"
              onPress={onKeepOn}
              style={({ pressed }) => [styles.openSettings, pressed && styles.openSettingsPressed]}
            >
              <Text style={styles.openSettingsText}>Keep it on</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// §23.1 manual completion button.
export function CompleteWorkoutButton({ completing, onPress }) {
  return (
    <Pressable
      testID="complete-workout"
      accessibilityRole="button"
      accessibilityState={{ disabled: completing, busy: completing }}
      disabled={completing}
      onPress={onPress}
      style={({ pressed }) => [styles.complete, pressed && !completing ? styles.sink : styles.brandShadow, completing && styles.dim]}
    >
      {({ pressed }) => (
        <>
          <View style={[StyleSheet.absoluteFill, styles.completeClip]}>
            <GradientFill colors={['#f7ce4f', '#f4b400']} />
            <View style={[StyleSheet.absoluteFill, { opacity: pressed && !completing ? 1 : 0 }]}>
              <GradientFill colors={['#f4b400', '#dda000']} />
            </View>
          </View>
          {completing ? <Spinner size={20} thickness={2} color={colors.navy} track="rgba(17, 24, 39, 0.4)" /> : null}
          <Text numberOfLines={1} textBreakStrategy="simple" style={styles.completeText}>COMPLETE WORKOUT</Text>
        </>
      )}
    </Pressable>
  );
}

export function DiscardButton({ abandoning, onPress }) {
  return (
    <Pressable testID="discard-workout" accessibilityRole="button" disabled={abandoning} onPress={onPress} style={styles.discardLink}>
      {({ pressed }) => <Text style={[styles.discardLinkText, pressed && styles.discardLinkPressed]}>{abandoning ? 'Exiting…' : 'Discard workout'}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rotated: {
    transform: [{ rotate: '-90deg' }],
  },
  disc: {
    position: 'absolute',
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    boxShadow: `${shadows.lift3}, 0px 0px 0px 1px rgba(17, 24, 39, 0.10)`,
  },
  countdownSmall: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.navy,
  },
  countdownLarge: {
    fontSize: 60,
    lineHeight: 60,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    color: colors.navy,
  },
  countdownDanger: {
    color: colors.danger800,
  },
  minimize: {
    position: 'absolute',
    top: 28,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.10)',
  },
  minimizeText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: 'rgba(17, 24, 39, 0.70)',
  },
  resting: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 3.3,
    textTransform: 'uppercase',
    color: 'rgba(17, 24, 39, 0.80)',
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  adjust: {
    width: 48,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.10)',
  },
  adjustText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: colors.navy,
  },
  skip: {
    position: 'absolute',
    bottom: 32,
    borderRadius: radii.full,
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: '#f7ce4f',
  },
  popupHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  popupScrim: {
    backgroundColor: colors.scrim,
  },
  dialogScrim: {
    backgroundColor: colors.scrim,
  },
  popupCard: {
    width: '100%',
    maxWidth: 448,
    borderRadius: 32,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
    boxShadow: '0px 20px 48px -12px rgba(17, 24, 39, 0.25), inset 0px 0px 0px 1px rgba(17, 24, 39, 0.05)',
  },
  popupTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  popupText: {
    flex: 1,
    minWidth: 0,
  },
  popupEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  popupTitle: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  popupBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  popupGrid: {
    gap: 12,
    marginTop: 20,
  },
  popupGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  popupLine: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand700,
  },
  // Android blank-render class (see RuntimeParts actionClip): the pressable's
  // shadow changes on press, so only the inner pillClip layer clips.
  awesome: {
    marginTop: 24,
  },
  brandShadow: {
    boxShadow: shadows.brand,
  },
  sink: {
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  dim: {
    opacity: 0.6,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 384,
    borderRadius: radii.xxxl,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
    boxShadow: '0px 20px 48px -12px rgba(17, 24, 39, 0.25), inset 0px 0px 0px 1px rgba(17, 24, 39, 0.05)',
  },
  dialogTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  dialogBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  keep: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.lift1,
  },
  keepPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  keepText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  discard: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.danger600,
    boxShadow: shadows.lift2,
  },
  discardPressed: {
    backgroundColor: colors.danger700,
  },
  openSettings: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
  },
  openSettingsPressed: {
    backgroundColor: colors.brand500,
  },
  siriLink: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
  },
  siriLinkPressed: {
    opacity: 0.7,
  },
  siriLinkText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
    textDecorationLine: 'underline',
  },
  openSettingsText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.navy,
  },
  discardText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  complete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // No overflow here: its shadow changes on press (Android blank-render
    // class); completeClip clips the gradients instead.
    borderRadius: 24,
    paddingVertical: 16,
  },
  completeClip: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  completeText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: 0.45,
    color: colors.navy,
  },
  discardLink: {
    alignItems: 'center',
    borderRadius: radii.full,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  discardLinkText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  discardLinkPressed: {
    color: colors.danger,
  },
});
