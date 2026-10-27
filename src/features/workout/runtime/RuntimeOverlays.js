import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import BlurLayer from '../../../shared/components/BlurLayer';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import GradientFill from '../../../shared/components/GradientFill';
import IconButton from '../../../shared/components/IconButton';
import PillButton from '../../../shared/components/PillButton';
import TextLink from '../../../shared/components/TextLink';
import { isTabletWidth } from '../../../shared/components/AppModal';
import { CAP_BODY, DISPLAY_TITLE_TEXT, useLargeTextReflow } from '../../../shared/components/largeText';
import { formatNumber } from '../../../shared/format/numbers';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { formatDuration } from '../../../shared/time/format';
import { blur, colors, font, gradients, layout, motion, radii, shadows, spacing, textScale, typography } from '../../../shared/theme/tokens';
import AlertSheet, { SheetBody } from './AlertSheet';
import useForegroundBlur from './useForegroundBlur';
import {
  AlarmIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  Countdown,
  DiscFill,
  NextCard,
  RestGlow,
  RestRing,
  ShareIcon,
  SpeakerIcon,
  TrashIcon,
} from './RestParts';
import {
  MINI_RING,
  MINI_RING_TABLET,
  REST_RING,
  SHARE_ERROR,
  completionSetsLine,
  completionVolume,
  personalBestLines,
  restTotalLabel,
  shareSummaryText,
  spokenRecordLine,
} from './restPresentation';
import { consumeRestBack, setRestBackConsumer } from './restBackGate';
import { setsWord } from './sessionMath';

const POP = Easing.bezier(...motion.easePop);
const MARGIN = 8;
const focusLater = (ref) => {
  const timer = setTimeout(() => {
    const node = findNodeHandle(ref.current);
    if (node) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, 300);
  return () => clearTimeout(timer);
};

function clampPosition(position, size, window, insets) {
  const minX = MARGIN + insets.left;
  const minY = MARGIN + insets.top;
  const maxX = Math.max(minX, window.width - insets.right - size - MARGIN);
  const maxY = Math.max(minY, window.height - insets.bottom - size - MARGIN);
  return { x: Math.min(Math.max(minX, position.x), maxX), y: Math.min(Math.max(minY, position.y), maxY) };
}

// UX F2 Rest minimised: phone disc 92 at right 20 / top 112; tablet disc 132
// at right 40 / bottom 60 (clear of the set card's "Did it" by default).
export const DISC_SIZE = Object.freeze({ phone: 92, tablet: 132 });

function defaultDiscPosition(tablet, size, window, insets) {
  if (tablet) {
    return { x: window.width - insets.right - 40 - size, y: window.height - insets.bottom - 60 - size };
  }
  return { x: window.width - insets.right - 20 - size, y: Math.max(insets.top + MARGIN, 112) };
}

const EXPAND_ACTIONS = [{ name: 'activate', label: 'Expand rest timer' }];

// v2 Phase 3 §4 (UX F2). Expanded = the full-screen Rest (phone) or the
// centred 600 card over the scrim (tablet); minimised = the dark disc over
// the live workout (§22.2: draggable, 4 pt threshold, 8 pt clamp from the
// safe-area edges, re-clamped on every tick, no release animation; tap
// expands). Behaviour is v1's: opens expanded at every new rest, re-expands
// once at ≤ 10 s (useRestTimer), −5/+5/Skip as before.
// `next`: restNextPreview() (U4); null hides the Next card.
export function RestTimerWidget({ timer, minimized, onMinimize, onExpand, onAdjust, onSkip, position, onPosition, next = null }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(window.width);
  const size = tablet ? DISC_SIZE.tablet : DISC_SIZE.phone;
  const current = clampPosition(position ?? defaultDiscPosition(tablet, size, window, insets), size, window, insets);
  const drag = useRef({ moved: false, startX: 0, startY: 0, origin: current });
  const latest = useRef({ current, minimized, onExpand, onPosition, size, window, insets });
  latest.current = { current, minimized, onExpand, onPosition, size, window, insets };
  const [pressed, setPressed] = useState(false);

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
          setPressed(true);
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
          setPressed(false);
          if (!drag.current.moved && latest.current.minimized) {
            latest.current.onExpand();
          }
        },
        onPanResponderTerminate: () => setPressed(false),
        onPanResponderTerminationRequest: () => false,
      }),
    []
  );

  // O14 / review M6: Android Back on the expanded Rest = Minimise (consumed,
  // the rest keeps running). Subscribed only while expanded.
  const expanded = Boolean(timer) && !minimized;
  const minimiseRef = useRef(onMinimize);
  minimiseRef.current = onMinimize;
  useEffect(() => {
    if (!expanded) {
      return undefined;
    }
    const release = setRestBackConsumer(() => minimiseRef.current?.());
    const subscription = BackHandler.addEventListener('hardwareBackPress', consumeRestBack);
    return () => {
      subscription.remove();
      release();
    };
  }, [expanded]);

  if (!timer) {
    return null;
  }

  if (minimized) {
    const ring = tablet ? MINI_RING_TABLET : MINI_RING;
    return (
      <View
        testID="rest-timer"
        {...pan.panHandlers}
        // §22.1 "Tap expands", for screen readers too: the PanResponder only
        // sees touches, so VoiceOver / TalkBack activation is wired explicitly.
        accessible
        accessibilityRole="button"
        accessibilityLabel="Expand rest timer"
        accessibilityActions={EXPAND_ACTIONS}
        onAccessibilityAction={(event) => event.nativeEvent.actionName === 'activate' && onExpand()}
        onAccessibilityTap={onExpand}
        style={[
          styles.disc,
          { left: current.x, top: current.y, width: size, height: size, borderRadius: size / 2 },
          pressed && styles.discPressed,
        ]}
      >
        {/* Remounted per size, so this clipping layer never changes radius. */}
        <DiscFill key={size} size={size} />
        <RestRing size={size} geometry={ring} secondsLeft={timer.secondsLeft} totalSeconds={timer.totalSeconds} testID="rest-mini-ring" />
        <Countdown seconds={timer.secondsLeft} style={tablet ? styles.discDigitsTablet : styles.discDigits} />
      </View>
    );
  }

  return tablet ? (
    <TabletRest timer={timer} next={next} onMinimize={onMinimize} onAdjust={onAdjust} onSkip={onSkip} window={window} insets={insets} />
  ) : (
    <PhoneRest timer={timer} next={next} onMinimize={onMinimize} onAdjust={onAdjust} onSkip={onSkip} window={window} insets={insets} />
  );
}

function MinimizeButton({ onMinimize }) {
  return (
    <IconButton testID="rest-timer-minimize" accessibilityLabel="Minimize rest timer" onPress={onMinimize}>
      {({ color }) => <ChevronDownIcon size={18} color={color} />}
    </IconButton>
  );
}

function AdjustButtons({ onAdjust, tablet, flex = false }) {
  const style = flex ? styles.adjustFlex : tablet ? styles.adjustTablet : styles.adjust;
  return (
    <>
      <PillButton
        testID="rest-timer-minus"
        title="−5s"
        variant="secondary"
        accessibilityLabel="Decrease rest timer by 5 seconds"
        onPress={() => onAdjust(-5)}
        style={style}
      />
      <PillButton
        testID="rest-timer-plus"
        title="+5s"
        variant="secondary"
        accessibilityLabel="Increase rest timer by 5 seconds"
        onPress={() => onAdjust(5)}
        style={style}
      />
    </>
  );
}

function SkipButton({ onSkip, tablet }) {
  return (
    <PillButton
      testID="rest-timer-skip"
      title="Skip rest"
      variant="light"
      size="cta"
      fullWidth
      icon={({ color }) => <ArrowRightIcon size={18} color={color} />}
      onPress={onSkip}
      style={tablet ? styles.skipTablet : null}
    />
  );
}

function RingFace({ timer, ringSize, tablet }) {
  return (
    <View testID="rest-ring-box" style={[styles.ringBox, { width: ringSize, height: ringSize }]}>
      <RestRing size={ringSize} geometry={REST_RING} secondsLeft={timer.secondsLeft} totalSeconds={timer.totalSeconds} />
      <View style={styles.ringCentre}>
        <Countdown seconds={timer.secondsLeft} style={tablet ? styles.digitsTablet : null} />
        <Text testID="rest-total" {...CAP_BODY} style={[styles.total, tablet && styles.totalTablet]}>
          {restTotalLabel(timer.totalSeconds)}
        </Text>
      </View>
    </View>
  );
}

// Phone (native and < 768): the full-screen Rest board. Column: header
// (spacer · "Resting" · minimise), ring 300, ±5 s, then Next card + Skip
// rest at the bottom. It scrolls when large text needs the room.
function PhoneRest({ timer, next, onMinimize, onAdjust, onSkip, window, insets }) {
  const ringSize = Math.min(REST_RING.viewBox, window.width - 2 * layout.gutter);
  return (
    <View testID="rest-timer" accessibilityViewIsModal role="dialog" accessibilityLabel="Rest timer" style={styles.full}>
      <RestGlow />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.fullContent,
          { paddingTop: insets.top + spacing[3], paddingBottom: insets.bottom + spacing[7] + spacing['0_5'], paddingLeft: insets.left + layout.gutter, paddingRight: insets.right + layout.gutter },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text {...CAP_BODY} accessibilityRole="header" style={styles.resting}>Resting</Text>
          <MinimizeButton onMinimize={onMinimize} />
        </View>
        <View style={styles.ringGap} />
        <RingFace timer={timer} ringSize={ringSize} />
        <View style={styles.adjustRow}>
          <AdjustButtons onAdjust={onAdjust} />
        </View>
        <View style={styles.bottomStack}>
          <NextCard next={next} />
          <SkipButton onSkip={onSkip} />
        </View>
      </ScrollView>
    </View>
  );
}

// Tablet: the centred 600 card over scrim-strong (the scrim never
// dismisses; Minimise is the dismiss).
function TabletRest({ timer, next, onMinimize, onAdjust, onSkip, window, insets }) {
  const cardWidth = Math.min(600, window.width - 2 * spacing[6]);
  const ringSize = Math.min(320, cardWidth - 2 * spacing[8]);
  return (
    <View testID="rest-timer" style={styles.overlay}>
      {Platform.OS === 'ios' ? <BlurLayer blurPx={blur.scrimTablet} /> : null}
      <View style={[StyleSheet.absoluteFill, styles.tabletScrim]} />
      <View
        testID="rest-card"
        accessibilityViewIsModal
        role="dialog"
        accessibilityLabel="Rest timer"
        style={[styles.restCard, { width: cardWidth, maxHeight: window.height - 2 * spacing[6] - insets.top - insets.bottom }]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.restCardClip]}>
          <RestGlow />
        </View>
        <ScrollView bounces={false} contentContainerStyle={styles.restCardContent}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text {...CAP_BODY} accessibilityRole="header" style={[styles.resting, styles.restingTablet]}>Resting</Text>
            <MinimizeButton onMinimize={onMinimize} />
          </View>
          <View style={styles.ringGapTablet} />
          <RingFace timer={timer} ringSize={ringSize} tablet />
          <View style={[styles.adjustRow, styles.adjustRowTablet]}>
            <AdjustButtons onAdjust={onAdjust} tablet />
          </View>
          <View style={styles.nextTabletGap}>
            <NextCard next={next} tablet />
          </View>
          <SkipButton onSkip={onSkip} tablet />
        </ScrollView>
      </View>
    </View>
  );
}

// ---- Workout complete ---------------------------------------------------------

// The badge: phone 132 (ring r58 stroke 10 on gold tint, full gold arc, an
// 84 gold centre with the on-gold check); tablet 156 (viewBox 76, r32,
// stroke 7 on the track, gold check 56, no centre disc).
function CompleteBadge({ popup, tablet }) {
  const label = `${popup.completedSets} of ${popup.totalSets} ${setsWord(popup.totalSets)} completed`;
  const size = tablet ? 156 : 132;
  const view = tablet ? 76 : 132;
  const radius = tablet ? 32 : 58;
  const stroke = tablet ? 7 : 10;
  return (
    <View testID="completion-ring" accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.badge, { width: size, height: size }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={size} height={size} viewBox={`0 0 ${view} ${view}`}>
          <Circle cx={view / 2} cy={view / 2} r={radius} fill="none" stroke={tablet ? colors.track : colors.goldTint} strokeWidth={stroke} />
          <Circle cx={view / 2} cy={view / 2} r={radius} fill="none" stroke={colors.gold} strokeWidth={stroke} strokeLinecap="round" />
        </Svg>
      </View>
      {tablet ? (
        <CheckIcon size={56} color={colors.gold} strokeWidth={2.6} />
      ) : (
        <View style={styles.badgeCentre}>
          <CheckIcon size={40} color={colors.onGold} strokeWidth={3} />
        </View>
      )}
    </View>
  );
}

function stats(popup) {
  return [
    { key: 'time', label: 'Time', value: formatDuration(popup.durationSeconds) },
    { key: 'volume', label: 'Volume', value: completionVolume(popup) },
    { key: 'reps', label: 'Reps', value: formatNumber(popup.totalReps, 0) },
    { key: 'progress', label: 'Progress', value: `${popup.completedExercises}/${popup.totalExercises} ex`, accent: true },
  ];
}

// Phone: 4 across (value over label); past the reflow point each tile is a
// label → value row (UX §9 rule 4). Tablet: 2×2, label over value, the
// Progress tile gold on gold tint.
function CompletionStats({ popup, tablet, reflow }) {
  const items = stats(popup);
  if (tablet) {
    return (
      <View testID="completion-stats" style={[styles.statsGrid, reflow && styles.statsStack]}>
        {items.map((item) => (
          <View
            key={item.key}
            testID={`completion-stat-${item.key}`}
            accessible
            accessibilityLabel={`${item.label}, ${item.value}`}
            style={[styles.statTablet, reflow && styles.statFull, item.accent && styles.statAccent]}
          >
            <Text {...CAP_BODY} style={styles.statLabel}>{item.label}</Text>
            <Text maxFontSizeMultiplier={textScale.title} style={[styles.statValueTablet, item.accent && styles.statValueAccent]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View testID="completion-stats" style={[styles.statsRow, reflow && styles.statsStack]}>
      {items.map((item) => (
        <View
          key={item.key}
          testID={`completion-stat-${item.key}`}
          accessible
          accessibilityLabel={`${item.label}, ${item.value}`}
          style={[styles.statPhone, reflow && styles.statRow]}
        >
          <Text maxFontSizeMultiplier={textScale.title} style={[styles.statValue, reflow && styles.statValueRow]}>{item.value}</Text>
          <Text {...CAP_BODY} style={[styles.statLabel, reflow && styles.statLabelRow]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// #15 New personal best: one card, ≤ 3 lines, weight records first; none →
// no card. Read as one item.
function PersonalBestCard({ lines, popup }) {
  if (lines.length === 0) {
    return null;
  }
  const first = lines[0];
  const image = popup.exerciseImages?.[first.exerciseId];
  const label = `New personal best, ${lines.map((line) => spokenRecordLine(line.text)).join('; ')}`;
  return (
    <View testID="completion-pb" accessible accessibilityLabel={label} style={styles.pb}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pbClip]}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      </View>
      <ExerciseImage url={image ?? null} name={first.text.split(' · ')[0]} size={52} testID="completion-pb-image" />
      <View style={styles.pbText}>
        <Text {...CAP_BODY} style={styles.pbEyebrow}>New personal best</Text>
        {lines.map((line) => (
          <Text key={line.text} testID="completion-pb-line" {...CAP_BODY} style={styles.pbLine}>
            {line.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

// U6 Share summary (phone only): the platform share sheet with the text
// summary. A dismissed sheet is silent; a failure shows the inline error
// (role alert) and announces it.
function ShareSummary({ popup, lines }) {
  const [error, setError] = useState('');
  const share = async () => {
    setError('');
    try {
      await Share.share({ message: shareSummaryText(popup, lines) });
    } catch {
      setError(SHARE_ERROR);
      try {
        AccessibilityInfo.announceForAccessibility(SHARE_ERROR);
      } catch {
        // Best effort.
      }
    }
  };
  return (
    <View>
      <PillButton
        testID="completion-share"
        title="Share summary"
        variant="secondary"
        fullWidth
        icon={({ color }) => <ShareIcon size={17} color={color} />}
        onPress={share}
      />
      {error ? (
        <Text testID="completion-share-error" {...CAP_BODY} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.shareError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// §23.2: closes only through "Awesome" (no scrim, no Android back), which
// returns to the Workout hub (the caller's onClose). Phone: full screen.
// Tablet: the centred 448 card over the scrim.
// `popup` (completionSnapshot) may also carry `personalRecords` (the complete
// response's `new_personal_records`), `volumeUnit` and `exerciseImages`
// ({ [exercise_id]: url }); without them the PB card is hidden and volume
// reads "lb" as in v1.
export function CompletionPopup({ popup, onClose }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tablet = isTabletWidth(width);
  const reflow = useLargeTextReflow();
  const { showBlur, blurKey } = useForegroundBlur();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const titleRef = useRef(null);
  useEffect(() => {
    if (!popup) {
      progress.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      // Reduced motion: fade only (the Modal's fade), no pop-in scale.
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, easing: POP, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [popup, progress, reducedMotion]);
  useEffect(() => (popup ? focusLater(titleRef) : undefined), [popup]);
  const lines = useMemo(() => personalBestLines(popup?.personalRecords), [popup]);
  if (!popup) {
    return null;
  }
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const body = `You finished ${popup.planName} and kept your momentum today.`;

  if (tablet) {
    return (
      <Modal transparent visible animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
        <View style={styles.popupHost}>
          {showBlur ? <BlurLayer key={blurKey} blurPx={blur.scrimTablet} overApp /> : null}
          <View style={[StyleSheet.absoluteFill, styles.popupScrim]} />
          <Animated.View
            testID="completion-popup"
            accessibilityViewIsModal
            role="dialog"
            accessibilityLabel="Workout complete"
            style={[styles.completeCard, { opacity: progress, transform: [{ scale }] }]}
          >
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.completeCardClip]}>
              <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
              <GradientFill radial={COMPLETE_CARD_GLOW} colors={gradients.welcomeGlow.colors} stops={[0, 0.6]} />
            </View>
            <ScrollView bounces={false} contentContainerStyle={styles.completeCardContent}>
              <CompleteBadge popup={popup} tablet />
              <Text {...CAP_BODY} style={[styles.eyebrow, styles.eyebrowTablet]}>Workout complete</Text>
              <Text ref={titleRef} {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={[styles.completeTitle, styles.completeTitleTablet]}>
                Great job!
              </Text>
              <Text {...CAP_BODY} style={[styles.completeBody, styles.completeBodyTablet]}>{body}</Text>
              <CompletionStats popup={popup} tablet reflow={reflow} />
              <PersonalBestCard lines={lines} popup={popup} />
              <Text {...CAP_BODY} style={[styles.setsLine, styles.setsLineTablet]}>{completionSetsLine(popup)}</Text>
              <View style={styles.awesomeTablet}>
                <PillButton testID="completion-awesome" title="Awesome" size="cta" fullWidth onPress={onClose} style={styles.awesomeTall} />
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <Animated.View
        testID="completion-popup"
        accessibilityViewIsModal
        role="dialog"
        accessibilityLabel="Workout complete"
        style={[styles.completeFull, { opacity: progress }]}
      >
        <GradientFill radial={gradients.accountGlow.radial} colors={gradients.accountGlow.colors} stops={gradients.accountGlow.stops} />
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.completeFullContent,
            { paddingTop: insets.top + spacing[8] + spacing[1], paddingBottom: insets.bottom + spacing[7] + spacing['0_5'], paddingLeft: insets.left, paddingRight: insets.right },
          ]}
        >
          <Animated.View style={[styles.completeHead, { transform: [{ scale }] }]}>
            <CompleteBadge popup={popup} />
            <Text {...CAP_BODY} style={styles.eyebrow}>Workout complete</Text>
            <Text ref={titleRef} {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={styles.completeTitle}>
              Great job!
            </Text>
            <Text {...CAP_BODY} style={styles.completeBody}>{body}</Text>
          </Animated.View>
          <View style={styles.completeSection}>
            <CompletionStats popup={popup} reflow={reflow} />
            <Text {...CAP_BODY} style={styles.setsLine}>{completionSetsLine(popup)}</Text>
            <PersonalBestCard lines={lines} popup={popup} />
          </View>
          <View style={styles.completeActions}>
            <PillButton testID="completion-awesome" title="Awesome" size="cta" fullWidth onPress={onClose} />
            <ShareSummary popup={popup} lines={lines} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// radial(120% 70% at 50% 0%) gold orb over the tablet card (TabletWorkoutComplete).
const COMPLETE_CARD_GLOW = Object.freeze({ cx: 0.5, cy: 0, rx: 1.2, ry: 0.7 });

// ---- Workout prompts (sheets on phones, cards on tablets) -------------------------

function useTablet() {
  const { width } = useWindowDimensions();
  return isTabletWidth(width);
}

// Two actions: on tablets a row (secondary then primary); on phones the A2/A3
// sheets keep the row too (flex 1 / 1.3) until large text stacks them,
// primary on top (UX §9 rule 4). `confirmStack` (Discard on phones, ND6):
// always stacked, the verb first.
function SheetActions({ secondary, primary, stack }) {
  const reflow = useLargeTextReflow();
  if (stack || reflow) {
    return (
      <View testID="sheet-actions" style={styles.actionsStack}>
        {primary}
        {secondary}
      </View>
    );
  }
  return (
    <View testID="sheet-actions" style={styles.actionsRow}>
      <View style={styles.actionSecondary}>{secondary}</View>
      <View style={styles.actionPrimary}>{primary}</View>
    </View>
  );
}

// §24 (UX F1 Discard): Android back = "Keep going"; the scrim does nothing.
// Phone: the verb first (Discard on top, ND6); tablet: Keep going · Discard.
export function DiscardDialog({ open, onKeep, onDiscard }) {
  const tablet = useTablet();
  const keepRef = useRef(null);
  useEffect(() => (open ? focusLater(keepRef) : undefined), [open]);
  const keep = <PillButton ref={keepRef} testID="discard-keep" title="Keep going" variant="secondary" fullWidth onPress={onKeep} style={tablet ? styles.action60 : styles.action56} />;
  const discard = <PillButton testID="discard-confirm" title="Discard" variant="danger" fullWidth onPress={onDiscard} style={tablet ? styles.action60 : styles.action56} />;
  return (
    <AlertSheet
      open={open}
      testID="discard-dialog"
      title="Discard this workout?"
      tone="danger"
      variant="confirm"
      icon={({ size }) => <TrashIcon size={size} color={colors.dangerText} />}
      onRequestClose={onKeep}
      actions={<SheetActions secondary={keep} primary={discard} stack={!tablet} />}
    >
      <SheetBody tablet={tablet} confirm>Your progress won't be saved and this session will be discarded.</SheetBody>
    </AlertSheet>
  );
}

// The aria-hidden "Alarms & reminders" settings preview (switch drawn on).
function AlarmSettingsPreview({ tablet }) {
  return (
    <View
      testID="exact-alarm-preview"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.preview, tablet && styles.previewTablet]}
    >
      <View style={[styles.previewMark, tablet && styles.previewMarkTablet]}>
        <Text maxFontSizeMultiplier={textScale.badge} style={[styles.previewMarkText, tablet && styles.previewMarkTextTablet]}>G</Text>
      </View>
      <Text {...CAP_BODY} style={[styles.previewLabel, tablet && styles.previewLabelTablet]}>Alarms & reminders</Text>
      <View style={[styles.switchTrack, tablet && styles.switchTrackTablet]}>
        <View style={[styles.switchThumb, tablet && styles.switchThumbTablet]} />
      </View>
    </View>
  );
}

// A2 rule 3 (time spec), v2 look (UX F2 Rest alerts on time): Android back
// and the scrim = "Not now"; focus starts on "Open settings".
export function ExactAlarmDialog({ open, onNotNow, onOpenSettings }) {
  const tablet = useTablet();
  const settingsRef = useRef(null);
  useEffect(() => (open ? focusLater(settingsRef) : undefined), [open]);
  return (
    <AlertSheet
      open={open}
      testID="exact-alarm-dialog"
      title="Get rest alerts on time?"
      tone="teal"
      icon={({ size }) => <AlarmIcon size={size} color={colors.teal} />}
      onRequestClose={onNotNow}
      onScrim={onNotNow}
      actions={
        <SheetActions
          secondary={<PillButton testID="exact-alarm-not-now" title="Not now" variant="secondary" fullWidth onPress={onNotNow} style={tablet ? styles.action60 : styles.action56} />}
          primary={
            <PillButton
              ref={settingsRef}
              testID="exact-alarm-open-settings"
              title="Open settings"
              fullWidth
              onPress={onOpenSettings}
              style={tablet ? styles.action60 : styles.action56}
            />
          }
        />
      }
    >
      <SheetBody tablet={tablet}>
        Android can hold back your rest alert, sometimes by minutes. Allow "Alarms & reminders" for Gymido so it arrives the moment your rest ends.
      </SheetBody>
      <AlarmSettingsPreview tablet={tablet} />
    </AlertSheet>
  );
}

// RN-SPEC-time A3, v2 look (UX F2 Hear your rest timer): the one-time
// pop-up at a rest start that showed no other dialog. Back, the scrim and
// "Keep it on" keep the spoken cue on; it never asks for notification
// permission. Focus lands on the title, then the primary button. The Siri
// line and link are iOS only.
export function SpeakIntroDialog({ open, onKeepOn, onTurnOff, onOpenAnnounceSettings }) {
  const tablet = useTablet();
  const titleRef = useRef(null);
  useEffect(() => (open ? focusLater(titleRef) : undefined), [open]);
  return (
    <AlertSheet
      open={open}
      testID="speak-intro-dialog"
      title="Hear your rest timer"
      titleRef={titleRef}
      tone="gold"
      icon={({ size }) => <SpeakerIcon size={size} color={colors.gold} />}
      onRequestClose={onKeepOn}
      onScrim={onKeepOn}
      actions={
        <SheetActions
          secondary={<PillButton testID="speak-intro-turn-off" title="Turn off" variant="secondary" fullWidth onPress={onTurnOff} style={tablet ? styles.action60 : styles.action56} />}
          primary={<PillButton testID="speak-intro-keep-on" title="Keep it on" fullWidth onPress={onKeepOn} style={tablet ? styles.action60 : styles.action56} />}
        />
      }
    >
      <SheetBody tablet={tablet}>We'll say "Rest complete" out loud when your rest ends. You can change this anytime in Profile.</SheetBody>
      {Platform.OS === 'ios' ? (
        <>
          <SheetBody tablet={tablet} muted>With AirPods, Siri can also read it out if Announce Notifications is on.</SheetBody>
          <View style={[styles.siriLink, tablet && styles.siriLinkTablet]}>
            <TextLink testID="speak-intro-siri" label="Set up Siri announcements" onPress={onOpenAnnounceSettings} />
          </View>
        </>
      ) : null}
    </AlertSheet>
  );
}

// ---- Page buttons (UX F1 ND4) -------------------------------------------------

// §23.1 manual completion. `primary` (SessionRuntime): true when no live set
// is left (the forward action, flat gold); otherwise the glass secondary, so
// "Did it" stays the one gold action. Defaults to v1's gold.
export function CompleteWorkoutButton({ completing, onPress, primary = true }) {
  return (
    <PillButton
      testID="complete-workout"
      title="Complete workout"
      variant={primary ? 'primary' : 'secondary'}
      size="cta"
      fullWidth
      loading={completing}
      onPress={onPress}
    />
  );
}

// "Discard workout": ghost with danger text; pressed = danger-faint (UX
// §8.6a 5, the transparent danger text button).
export function DiscardButton({ abandoning, onPress }) {
  return (
    <Pressable
      testID="discard-workout"
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(abandoning) }}
      disabled={abandoning}
      onPress={onPress}
      style={({ pressed }) => [styles.discardLink, pressed && !abandoning && styles.discardLinkPressed, abandoning && styles.dim]}
    >
      <Text {...CAP_BODY} textBreakStrategy="simple" style={styles.discardLinkText}>
        {abandoning ? 'Exiting…' : 'Discard workout'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Rest: minimised disc
  disc: {
    position: 'absolute',
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineBright,
    boxShadow: shadows.float,
  },
  discPressed: {
    transform: [{ scale: 0.96 }],
  },
  discDigits: {
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.72,
  },
  discDigitsTablet: {
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -0.96,
  },
  // Rest: phone full screen
  full: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    backgroundColor: colors.ground,
  },
  fullContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  headerSpacer: {
    width: layout.touchMin,
  },
  resting: {
    ...typography.body,
    ...font(600),
    flexShrink: 1,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  restingTablet: {
    fontSize: 17,
    lineHeight: 22,
  },
  ringGap: {
    height: 64,
  },
  ringGapTablet: {
    height: spacing[6],
  },
  ringBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCentre: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '86%',
  },
  digitsTablet: {
    fontSize: 100,
    lineHeight: 100,
    letterSpacing: -6,
  },
  total: {
    ...typography.body,
    marginTop: spacing[2],
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
    textAlign: 'center',
  },
  totalTablet: {
    ...typography.bodyLg,
  },
  adjustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[3],
    marginTop: 44,
  },
  adjustRowTablet: {
    marginTop: spacing[8] + spacing[1],
  },
  adjust: {
    minWidth: 96,
    paddingHorizontal: spacing[4],
  },
  adjustTablet: {
    minWidth: 112,
    minHeight: 56,
  },
  adjustFlex: {
    flex: 1,
  },
  bottomStack: {
    alignSelf: 'stretch',
    marginTop: 'auto',
    paddingTop: spacing[6],
    gap: spacing[3],
  },
  skipTablet: {
    minHeight: 62,
    marginTop: spacing['3_5'],
  },
  // Rest: tablet card
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabletScrim: {
    backgroundColor: colors.scrimStrong,
  },
  restCard: {
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    boxShadow: shadows.sheet,
  },
  restCardClip: {
    borderRadius: radii.tile,
    overflow: 'hidden',
  },
  restCardContent: {
    alignItems: 'center',
    paddingTop: spacing[7],
    paddingHorizontal: spacing[8] + spacing[2],
    paddingBottom: spacing[8] + spacing[2],
  },
  nextTabletGap: {
    alignSelf: 'stretch',
    marginTop: spacing[8],
  },
  // Workout complete
  popupHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  popupScrim: {
    backgroundColor: colors.scrim,
  },
  completeFull: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  completeFullContent: {
    flexGrow: 1,
  },
  completeHead: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCentre: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlow,
  },
  eyebrow: {
    ...typography.bodySm,
    ...font(600),
    marginTop: spacing[6],
    color: colors.gold,
    textAlign: 'center',
  },
  eyebrowTablet: {
    marginTop: spacing[5],
  },
  completeTitle: {
    ...typography.displayMd,
    lineHeight: 48,
    marginTop: spacing[1],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  completeTitleTablet: {
    ...typography.displayLg,
    lineHeight: 54,
    marginTop: spacing['1_5'],
  },
  completeBody: {
    ...typography.body,
    marginTop: spacing[2],
    color: colors.textSecondary,
    textAlign: 'center',
  },
  completeBodyTablet: {
    ...typography.bodyLg,
    maxWidth: 340,
    marginTop: spacing['2_5'],
    alignSelf: 'center',
  },
  completeSection: {
    marginTop: spacing[6],
    paddingHorizontal: layout.gutter,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2_5'],
    marginTop: spacing['5_5'],
    alignSelf: 'stretch',
  },
  statsStack: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  statPhone: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing['1_5'],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  statRow: {
    flex: 0,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  statValue: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statValueRow: {
    textAlign: 'right',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statLabelRow: {
    flexShrink: 1,
  },
  statTablet: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.fillWell,
  },
  statFull: {
    flexBasis: 'auto',
  },
  statAccent: {
    backgroundColor: colors.goldTint,
  },
  statValueTablet: {
    ...font(700),
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.2,
    marginTop: spacing['0_5'],
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statValueAccent: {
    color: colors.gold,
  },
  setsLine: {
    ...typography.bodySm,
    marginTop: spacing[3],
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
    textAlign: 'center',
  },
  setsLineTablet: {
    ...typography.body,
    marginTop: spacing['4_5'],
  },
  pb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing['3_5'],
    paddingTop: spacing['2_5'],
    paddingBottom: spacing['2_5'],
    paddingLeft: spacing['2_5'],
    paddingRight: spacing['3_5'],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  pbClip: {
    borderRadius: radii.lgPlus,
    overflow: 'hidden',
  },
  pbText: {
    flex: 1,
    minWidth: 0,
  },
  pbEyebrow: {
    ...typography.caption,
    ...font(600),
    color: colors.gold,
  },
  pbLine: {
    ...typography.body,
    ...font(600),
    marginTop: spacing['0_5'],
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  completeActions: {
    marginTop: 'auto',
    paddingTop: spacing[6],
    paddingHorizontal: layout.gutter,
    gap: spacing['2_5'],
  },
  shareError: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.dangerText,
    textAlign: 'center',
  },
  completeCard: {
    width: '100%',
    maxWidth: 448,
    maxHeight: '100%',
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    boxShadow: shadows.sheet,
  },
  completeCardClip: {
    borderRadius: radii.tile,
    overflow: 'hidden',
  },
  completeCardContent: {
    alignItems: 'center',
    paddingTop: spacing[8],
    paddingHorizontal: spacing[7],
    paddingBottom: spacing[6],
  },
  awesomeTablet: {
    alignSelf: 'stretch',
    marginTop: spacing['4_5'],
  },
  awesomeTall: {
    minHeight: 62,
  },
  // Prompts
  actionsRow: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  actionSecondary: {
    flex: 1,
  },
  actionPrimary: {
    flex: 1.3,
  },
  actionsStack: {
    gap: spacing['2_5'],
  },
  action56: {
    minHeight: 56,
  },
  action60: {
    minHeight: 60,
  },
  preview: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing['4_5'],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceWell,
  },
  previewTablet: {
    marginTop: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
  },
  previewMark: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  previewMarkTablet: {
    width: 40,
    height: 40,
  },
  previewMarkText: {
    ...font(700),
    fontSize: 16,
    lineHeight: 20,
    color: colors.onGold,
  },
  previewMarkTextTablet: {
    fontSize: 18,
    lineHeight: 22,
  },
  previewLabel: {
    ...typography.bodySm,
    ...font(500),
    flex: 1,
    color: colors.textPrimary,
  },
  previewLabelTablet: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
  },
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: radii.full,
    padding: 2,
    alignItems: 'flex-end',
    backgroundColor: colors.gold,
  },
  switchTrackTablet: {
    width: 52,
    height: 32,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.onGold,
  },
  switchThumbTablet: {
    width: 28,
    height: 28,
  },
  siriLink: {
    marginTop: spacing[1],
    alignItems: 'center',
  },
  siriLinkTablet: {
    alignItems: 'flex-start',
  },
  // Page buttons
  discardLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing[6],
    borderRadius: radii.full,
  },
  discardLinkPressed: {
    backgroundColor: colors.dangerFaint,
  },
  discardLinkText: {
    ...typography.body,
    ...font(600),
    textAlign: 'center',
    color: colors.dangerText,
  },
  dim: {
    opacity: 0.5,
  },
});
