import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii, textStyles } from '../../../shared/theme/tokens';
import { formatClock, formatDuration, formatNumber, formatWeight } from '../../../shared/time/formatters';
import { ColorPressable } from '../../plans/components/PlanBits';
import ProgressRing from '../components/ProgressRing';
import { hubStyles, PRESS_SHADOW, SHADOW_BRAND } from '../components/hubChrome';
import { clampTimerPosition, exerciseName, muscleGroups, TIMER_DEFAULT_TOP } from './runtimeRules';
import { createTimerDragConfig } from './timerDrag';

export const TIMER_COLLAPSED_SIZE = 80;
export const TIMER_EXPANDED_SIZE = 288;

// §22.2. The whole widget drags; the four inner controls do not start one,
// matching the web's stopPropagation() on their pointer-down. A PanResponder
// covers this without a new native dependency — react-native-gesture-handler is
// not installed, and the spec allows either.
//
// Coordinates are the overlay box's, which is the window minus the top safe
// inset (see PageLayout's `overlay`). Dropping is instant: no release animation.
export function DraggableRestTimer({
  restTimer,
  minimized,
  position,
  onMove,
  onExpand,
  onMinimize,
  onAdjust,
  onSkip,
}) {
  const insets = useSafeAreaInsets();
  const [bounds, setBounds] = useState(null);
  const size = minimized ? TIMER_COLLAPSED_SIZE : TIMER_EXPANDED_SIZE;

  const geometry = useRef({ size, bounds, insets, position });
  geometry.current = { size, bounds, insets, position };
  // Set by a control's onPressIn, cleared before every new touch on the widget.
  const controlHeld = useRef(false);
  const originRef = useRef(null);

  // §22.2: re-clamp on every countdown tick rather than on a resize event, so a
  // widget left off-screen by a rotation walks back inside within about a second.
  useEffect(() => {
    const { position: current, ...rest } = geometry.current;
    if (!current || !rest.bounds) {
      return;
    }
    const next = clampTimerPosition(current, rest);
    if (next.x !== current.x || next.y !== current.y) {
      onMove(next);
    }
  }, [restTimer, minimized, bounds, insets, onMove]);

  const responder = useMemo(
    () =>
      PanResponder.create(
        createTimerDragConfig({
          getGeometry: () => geometry.current,
          isControlHeld: () => controlHeld.current,
          releaseControl: () => {
            controlHeld.current = false;
          },
          onMove,
        })
      ),
    [onMove]
  );

  // Winning the responder terminates the collapsed disc's press, so a drag can
  // never expand it and a tap always does — the web's `moved` check, for free.
  const placement = position
    ? { left: position.x, top: position.y }
    : { top: insets.top + TIMER_DEFAULT_TOP, alignSelf: 'center' };

  const dragLock = {
    onPressIn: () => {
      controlHeld.current = true;
    },
    onPressOut: () => {
      controlHeld.current = false;
    },
  };

  return (
    <View
      testID="rest-timer-layer"
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBounds((current) =>
          current && current.width === width && current.height === height ? current : { width, height }
        );
      }}
    >
      <View testID="rest-timer-drag" style={[styles.timerAnchor, placement]} {...responder.panHandlers}>
        <RestTimerWidget
          restTimer={restTimer}
          minimized={minimized}
          dragLock={dragLock}
          onExpand={onExpand}
          onMinimize={onMinimize}
          onAdjust={onAdjust}
          onSkip={onSkip}
        />
      </View>
    </View>
  );
}

// RestTimerWidget (§22.1). Collapsed disc, or expanded with ±5s and Skip.
export function RestTimerWidget({ restTimer, minimized, dragLock, onExpand, onMinimize, onAdjust, onSkip }) {
  const reducedMotion = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(1));
  const finalStretch = restTimer.secondsLeft <= 10;

  useEffect(() => {
    if (!finalStretch || reducedMotion) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [finalStretch, reducedMotion, pulse]);

  const ratio = restTimer.totalSeconds > 0 ? restTimer.secondsLeft / restTimer.totalSeconds : 0;
  const digits = formatClock(restTimer.secondsLeft);

  if (minimized) {
    return (
      <Pressable
        testID="rest-timer-collapsed"
        accessibilityRole="button"
        accessibilityLabel="Expand rest timer"
        onPress={onExpand}
        style={[styles.timerBase, styles.timerCollapsed]}
      >
        <CountdownRing ratio={ratio} size={80} radius={18} stroke={2.5} />
        <Animated.Text style={[styles.timerDigits, finalStretch && styles.timerDigitsFinal, { transform: [{ scale: pulse }] }]}>
          {digits}
        </Animated.Text>
      </Pressable>
    );
  }

  return (
    <View testID="rest-timer-expanded" style={[styles.timerBase, styles.timerExpanded]}>
      <CountdownRing ratio={ratio} size={288} radius={18.5} stroke={2} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Minimize rest timer"
        {...dragLock}
        onPress={onMinimize}
        style={styles.minimize}
      >
        <Text style={styles.minimizeLabel}>–</Text>
      </Pressable>
      <Text style={styles.restingLabel}>Resting</Text>
      <Animated.Text
        testID="rest-timer-digits"
        style={[styles.timerDigitsLarge, finalStretch && styles.timerDigitsFinal, { transform: [{ scale: pulse }] }]}
      >
        {digits}
      </Animated.Text>
      <View style={styles.adjustRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease rest timer by 5 seconds"
          {...dragLock}
          onPress={() => onAdjust(-5)}
          style={styles.adjustPill}
        >
          <Text style={styles.adjustLabel}>−5s</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase rest timer by 5 seconds"
          {...dragLock}
          onPress={() => onAdjust(5)}
          style={styles.adjustPill}
        >
          <Text style={styles.adjustLabel}>+5s</Text>
        </Pressable>
      </View>
      <Pressable
        testID="rest-timer-skip"
        accessibilityRole="button"
        {...dragLock}
        onPress={onSkip}
        style={styles.skip}
      >
        <Text style={styles.skipLabel}>Skip rest</Text>
      </Pressable>
    </View>
  );
}

// The disc's gradient is drawn HERE, in SVG, rather than as the View's
// `experimental_backgroundImage`. On Android a CSS gradient becomes a
// BackgroundImageDrawable, and a zero-sized draw of one produces a degenerate
// shader whose native pointer is null — which throws IllegalArgumentException on
// the main thread and kills the process with no dialog (app-shell §1.0). This
// widget mounts when a rest starts and unmounts when it ends, so it was exposed
// to that pre-layout frame twice per rest. SVG never touches that code path.
function CountdownRing({ ratio, size, radius, stroke }) {
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="restDisc" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f7ce4f" />
          <Stop offset="0.5" stopColor="#f4b400" />
          <Stop offset="1" stopColor="#dda000" />
        </LinearGradient>
      </Defs>
      <Circle cx={20} cy={20} r={20} fill="url(#restDisc)" />
      <Circle cx={20} cy={20} r={radius} stroke="rgba(17,24,39,0.15)" strokeWidth={stroke} fill="none" />
      <Circle
        cx={20}
        cy={20}
        r={radius}
        stroke={colors.navy}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, ratio)))}
        transform="rotate(-90 20 20)"
      />
    </Svg>
  );
}

// DiscardDialog (§24).
// A2 (RN-SPEC-time): the one-time offer of exact rest alerts on Android. The
// ConfirmDialog anatomy of RN-SPEC-workout §24. The rest keeps running under
// it. Back or a tap on the scrim is "Not now"; focus starts on "Open settings".
const EXACT_ALARM_TITLE = 'Get rest alerts on time?';

export function ExactAlarmOfferDialog({ visible, onNotNow, onOpenSettings }) {
  const openRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (openRef.current) {
        AccessibilityInfo.sendAccessibilityEvent(openRef.current, 'focus');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <Pressable
        testID="exact-alarm-scrim"
        accessible={false}
        importantForAccessibility="no"
        onPress={onNotNow}
        style={styles.dialogScrim}
      >
        <Pressable
          accessibilityViewIsModal
          role="dialog"
          aria-label={EXACT_ALARM_TITLE}
          testID="exact-alarm-dialog"
          onPress={() => {}}
          style={[hubStyles.card3d, styles.dialog]}
        >
          <Text style={styles.dialogTitle}>{EXACT_ALARM_TITLE}</Text>
          <Text style={styles.dialogBody}>
            Android can hold back your rest alert, sometimes by minutes. Allow &ldquo;Alarms &amp; reminders&rdquo;
            for Gymido so it arrives the moment your rest ends.
          </Text>
          <View style={styles.dialogRow}>
            <Pressable
              testID="exact-alarm-not-now"
              accessibilityRole="button"
              onPress={onNotNow}
              style={[styles.dialogButton, styles.keepGoing]}
            >
              <Text style={styles.keepGoingLabel}>Not now</Text>
            </Pressable>
            <Pressable
              ref={openRef}
              testID="exact-alarm-open-settings"
              accessibilityRole="button"
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.dialogButton, styles.openSettings, pressed && styles.openSettingsPressed]}
            >
              <Text style={styles.openSettingsLabel}>Open settings</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DiscardDialog({ visible, onKeepGoing, onDiscard }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepGoing}>
      <View style={styles.dialogScrim}>
        <View accessibilityViewIsModal accessibilityRole="alert" testID="discard-dialog" style={[hubStyles.card3d, styles.dialog]}>
          <Text style={styles.dialogTitle}>Discard this workout?</Text>
          <Text style={styles.dialogBody}>Your progress won&apos;t be saved and this session will be discarded.</Text>
          <View style={styles.dialogRow}>
            <Pressable
              testID="discard-keep-going"
              accessibilityRole="button"
              onPress={onKeepGoing}
              style={[styles.dialogButton, styles.keepGoing]}
            >
              <Text style={styles.keepGoingLabel}>Keep going</Text>
            </Pressable>
            <Pressable
              testID="discard-confirm"
              accessibilityRole="button"
              onPress={onDiscard}
              style={[styles.dialogButton, styles.discard]}
            >
              <Text style={styles.discardLabel}>Discard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function CompletionPopup({ popup, onDismiss }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.popupScrim}>
        <View testID="completion-popup" style={[hubStyles.card3d, styles.popup]}>
          <View style={styles.popupHead}>
            <View style={styles.popupColumn}>
              <Text style={styles.popupEyebrow}>Workout complete</Text>
              <Text style={styles.popupTitle}>Great job!</Text>
              <Text style={styles.popupBody}>
                {`You finished ${popup.planName} and kept your momentum today.`}
              </Text>
            </View>
            <View style={styles.popupRing}>
              <ProgressRing
                value={popup.completedSets}
                total={popup.totalSets}
                size={76}
                thickness={9}
                label={`${popup.completedSets} of ${popup.totalSets} sets completed`}
              >
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6 9 17l-5-5"
                    stroke={colors.brand500}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </ProgressRing>
            </View>
          </View>

          <View style={styles.popupGrid}>
            <PopupTile label="Time" value={formatDuration(popup.durationSeconds)} />
            {/* ⚠W15: volume is unit-blind and always labelled lb. */}
            <PopupTile label="Volume" value={formatWeight(popup.totalVolume, 'lb', 0)} />
            <PopupTile label="Reps" value={formatNumber(popup.totalReps, 0)} />
            <PopupTile label="Progress" value={`${popup.completedExercises}/${popup.totalExercises} ex`} />
          </View>

          <Text style={styles.popupLine}>{`${popup.completedSets}/${popup.totalSets} sets done. Consistency wins.`}</Text>

          <ColorPressable
            testID="completion-dismiss"
            accessibilityRole="button"
            onPress={onDismiss}
            colorsFor={() => ({})}
            style={({ pressed }) => [styles.awesome, pressed && styles.sunk]}
          >
            <Text style={styles.awesomeLabel}>Awesome</Text>
          </ColorPressable>
        </View>
      </View>
    </Modal>
  );
}

function PopupTile({ label, value }) {
  return (
    <View style={styles.popupTile}>
      <Text style={styles.popupTileLabel}>{label}</Text>
      <Text style={styles.popupTileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timerAnchor: {
    position: 'absolute',
    // §22.2: a constant z-index, above the page and below the completion popup.
    zIndex: 50,
  },
  timerBase: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    // The gradient itself lives in CountdownRing's SVG — see the note there.
    backgroundColor: colors.brand400,
    overflow: 'hidden',
  },
  timerCollapsed: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  timerExpanded: {
    width: 288,
    height: 288,
    borderRadius: 144,
  },
  timerDigits: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  },
  timerDigitsLarge: {
    fontSize: 60,
    fontWeight: '900',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  },
  timerDigitsFinal: {
    color: '#ef4444',
  },
  minimize: {
    position: 'absolute',
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(17,24,39,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.navy,
  },
  restingLabel: {
    fontSize: 9.6,
    fontWeight: '900',
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    color: 'rgba(17,24,39,0.60)',
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  adjustPill: {
    width: 48,
    height: 36,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(17,24,39,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustLabel: {
    fontSize: 12,
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
  skipLabel: {
    fontSize: 9.6,
    fontWeight: '900',
    letterSpacing: 1.92,
    textTransform: 'uppercase',
    color: colors.brand300,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.50)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 12,
  },
  chip: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.brand400,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.navy,
  },
  sheetList: {
    marginBottom: 8,
  },
  sheetRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetRowName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetEmpty: {
    paddingVertical: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dialogScrim: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 384,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  dialogBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dialogRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  keepGoing: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  keepGoingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  discard: {
    backgroundColor: '#ef4444',
  },
  discardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  // A2: solid, not the gold gradient — the button is flex-width, and a solid
  // fill keeps it out of the §19.10 gradient rules entirely.
  openSettings: {
    backgroundColor: colors.brand400,
  },
  openSettingsPressed: {
    backgroundColor: colors.brand500,
  },
  openSettingsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
  popupScrim: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  popup: {
    width: '100%',
    maxWidth: 448,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  popupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  popupColumn: {
    flex: 1,
    minWidth: 0,
  },
  popupEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    color: colors.brand600,
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
  popupRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupGrid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  popupTile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  popupTileLabel: {
    ...textStyles.statLabel,
    letterSpacing: 1.56,
    color: colors.textMuted,
  },
  popupTileValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  popupLine: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand600,
  },
  awesome: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 20,
    paddingVertical: 14,
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #f4b400)',
    boxShadow: SHADOW_BRAND,
  },
  sunk: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  awesomeLabel: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.24,
    textTransform: 'uppercase',
    color: colors.navy,
  },
});
