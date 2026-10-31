import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle } from 'react-native';

import FeedbackIcon from '../../../shared/components/FeedbackIcon';
import { colors, font, radii, titleTracking } from '../../../shared/theme/tokens';
import HubButton from './hub/HubButton';
import { CalendarIcon } from './hub/HubIcons';
import { CAP_BODY, TITLE_TEXT } from '../../../shared/components/largeText';

// Whole-page Workout states. T-76 (boards "Workout hub states" 6 and 8, UX
// check U2/U3, 28 Oct 2026): the hub's card language (r24/r28, 56 tile,
// 24/30 title) in place of the Phase 2 glow cards. Copy is the brief's.

// Tablet/web rule (UX D): whole-page states are the card at max 640,
// horizontally centred, under the page header.
export const STATE_MAX_WIDTH = 640;
// As the app's other focus moves: give the screen time to lay out first.
export const FOCUS_DELAY_MS = 300;


// State 8 "Workout unavailable" / "Please try again." / "Try again" (U3: the
// ErrorAlert tokens, r24 and the danger line). `role=alert`; the TITLE gets
// the initial focus; "Try again" re-runs the full load.
export function WorkoutErrorState({ message = 'Please try again.', onRetry, retrying = false }) {
  const titleRef = useRef(null);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(['Workout unavailable', message].filter(Boolean).join(' '));
  }, [message]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const node = findNodeHandle(titleRef.current);
      if (node) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View testID="workout-error" accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.card, styles.errorCard]}>
      <View testID="workout-error-icon" style={[styles.tile, styles.errorTile]}>
        <FeedbackIcon name="warning" size={26} color={colors.dangerText} />
      </View>
      <Text ref={titleRef} testID="workout-error-title" {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
        Workout unavailable
      </Text>
      {message ? (
        <Text {...CAP_BODY} style={styles.body}>
          {message}
        </Text>
      ) : null}
      <HubButton testID="workout-error-retry" variant="outline" title="Try again" loading={retrying} onPress={onRetry} style={styles.actions} />
    </View>
  );
}

// State 6 "No active workout plan": "Browse plans" is the one gold action;
// "Build me a plan" (outlined) only while the generator is on (U2).
export function WorkoutEmptyState({ onBrowse, onBuild, generatorAvailable = false }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('No active workout plan');
  }, []);
  return (
    <View testID="workout-empty" accessibilityLiveRegion="polite" style={[styles.card, styles.emptyCard]}>
      <View testID="workout-empty-icon" style={[styles.tile, styles.emptyTile]}>
        <CalendarIcon size={22} color={colors.gold} />
      </View>
      <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
        No active workout plan
      </Text>
      <Text {...CAP_BODY} style={[styles.body, styles.emptyBody]}>
        Pick a plan first, then come back here to start a workout.
      </Text>
      <View style={[styles.actions, styles.stack]}>
        <HubButton testID="workout-browse-plans" title="Browse plans" onPress={onBrowse} />
        {generatorAvailable ? <HubButton testID="workout-build-plan" variant="outline" title="Build me a plan" onPress={onBuild} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: STATE_MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
  },
  errorCard: {
    borderRadius: radii.xl,
    borderColor: colors.dangerLine,
  },
  emptyCard: {
    borderRadius: radii.xxl,
    borderColor: colors.hairlineStrong,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTile: {
    backgroundColor: colors.dangerTint,
  },
  emptyTile: {
    backgroundColor: colors.goldTint,
  },
  title: {
    ...font(700),
    marginTop: 16,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: titleTracking(24, -0.03),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...font(400),
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 300,
  },
  actions: {
    marginTop: 20,
  },
  stack: {
    alignSelf: 'stretch',
    gap: 10,
  },
});
