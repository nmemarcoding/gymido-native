import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { RetryButton } from '../../../shared/components/ErrorAlert';
import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { colors, font, gradients, radii, spacing } from '../../../shared/theme/tokens';

// RN-SPEC-v2-phase2 §D2 Workout states (UX D "Workout states"). Look only;
// copy and behaviour are RN-SPEC-workout §H1/§H2.

// Tablet/web rule (UX D): whole-page states are the card at max 640,
// horizontally centred, under the page header.
export const STATE_MAX_WIDTH = 640;
// As the app's other focus moves: give the screen time to lay out first.
export const FOCUS_DELAY_MS = 300;

// The boards' 32/34/700 -0.045em title (title-lg family; 32 has no token).
const TITLE_SIZE = 32;

// The top glow of both cards: radial 100 % 60 % at 50 % 0 %, fading by 65 %.
const TOP_GLOW = Object.freeze({ cx: 0.5, cy: 0, rx: 1, ry: 0.6 });
const GLOW_STOPS = Object.freeze([0, 0.65]);

// W2 / H1: the transport message, else "Please try again." (the caller
// passes it). `role=alert`; "Try again" (ruling 2 Retry) gets the initial
// focus (PM parity, 26 Oct) and re-runs the full load.
export function WorkoutErrorState({ message, onRetry, retrying = false }) {
  const retryRef = useRef(null);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(['Workout unavailable', message].filter(Boolean).join(' '));
  }, [message]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const node = findNodeHandle(retryRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View testID="workout-error" accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.card, styles.errorCard]}>
      {/* Both layers mount with the card (SVG; never added on a state change). */}
      <GradientFill angle={gradients.card.angle} colors={[colors.surfaceRaised, colors.surface]} />
      <GradientFill radial={TOP_GLOW} colors={[colors.dangerFocus, colors.skeletonShimmerEdge]} stops={GLOW_STOPS} />
      <View testID="workout-error-icon" style={styles.errorTile}>
        <FeedbackIcon name="warning" size={30} color={colors.dangerText} />
      </View>
      <Text textBreakStrategy="simple" accessibilityRole="header" style={[styles.title, styles.errorTitle]}>
        Workout unavailable
      </Text>
      {message ? <Text style={styles.body}>{message}</Text> : null}
      <RetryButton ref={retryRef} testID="workout-error-retry" title="Try again" loading={retrying} onPress={onRetry} style={styles.retry} />
    </View>
  );
}

// W1 / H2: polite; "Browse plans" is the one gold action (kit 52).
export function WorkoutEmptyState({ onBrowse }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('No active workout plan');
  }, []);
  return (
    <View testID="workout-empty" accessibilityLiveRegion="polite" style={[styles.card, styles.emptyCard]}>
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <GradientFill radial={TOP_GLOW} colors={gradients.goldAmbient.colors} stops={GLOW_STOPS} />
      <View testID="workout-empty-icon" style={styles.emptyDisc}>
        <GradientFill radial={{ cx: 0.35, cy: 0.3, rx: 0.7, ry: 0.7 }} colors={[gradients.goldAmbient.colors[0], colors.fillWell]} />
        <Svg width={64} height={64} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Rect x={6} y={24} width={8} height={16} rx={3} fill={colors.gold} />
          <Rect x={16} y={27} width={5} height={10} rx={2} fill={colors.goldLight} />
          <Rect x={43} y={27} width={5} height={10} rx={2} fill={colors.goldLight} />
          <Rect x={50} y={24} width={8} height={16} rx={3} fill={colors.gold} />
          <Rect x={21} y={30} width={22} height={4} rx={2} fill={colors.textMuted} />
        </Svg>
      </View>
      <Text textBreakStrategy="simple" accessibilityRole="header" style={[styles.title, styles.emptyTitle]}>
        No active workout plan
      </Text>
      <Text style={styles.body}>Pick a plan first, then come back here to start a workout with real backend data.</Text>
      <View style={styles.browse}>
        <PillButton testID="workout-browse-plans" title="Browse plans" onPress={onBrowse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Radius 32 on the board (no token → radius-2xl 28).
  card: {
    width: '100%',
    maxWidth: STATE_MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: radii.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing[6],
  },
  errorCard: {
    paddingVertical: spacing[8],
    borderColor: colors.dangerTextBorder,
    backgroundColor: colors.surface,
  },
  emptyCard: {
    paddingVertical: 40,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
  },
  errorTile: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.dangerTextTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDisc: {
    width: 132,
    height: 132,
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...font(700),
    fontSize: TITLE_SIZE,
    lineHeight: 34,
    letterSpacing: -1.44,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorTitle: {
    marginTop: spacing['4_5'],
  },
  emptyTitle: {
    marginTop: spacing['5_5'],
  },
  body: {
    ...font(400),
    marginTop: spacing[2],
    maxWidth: 290,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing[5],
  },
  browse: {
    marginTop: spacing['5_5'],
  },
});
