import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { ColorPressable } from '../../plans/components/PlanBits';
import { hubStyles, PressedGradient, PRESS_SHADOW, SHADOW_BRAND, SHADOW_INSET_SOFT } from './hubChrome';

function useAnnounce(text, assertive = false) {
  useEffect(() => {
    if (Platform.OS === 'ios' && text) {
      AccessibilityInfo.announceForAccessibility(text);
    }
    // Announce once, when the state appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return assertive;
}

// H1 error (RN-SPEC-workout §2.1).
export function WorkoutErrorState({ message, onRetry }) {
  const [pressed, setPressed] = useState(false);
  useAnnounce(`Workout unavailable ${message ?? ''}`);
  return (
    <View
      testID="workout-error-state"
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[hubStyles.card3d, styles.stateCard, styles.errorPadding]}
    >
      <View style={styles.errorCircle}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            stroke="#ef4444"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.stateTitle}>Workout unavailable</Text>
      {message ? <Text style={styles.stateBody}>{message}</Text> : null}
      <ColorPressable
        testID="workout-error-retry"
        accessibilityRole="button"
        onPress={onRetry}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        transitionMs={200}
        colorsFor={() => ({ backgroundColor: colors.surface })}
        style={[styles.retry, pressed && styles.sunk]}
      >
        <Text style={styles.retryLabel}>Try again</Text>
      </ColorPressable>
    </View>
  );
}

// H2 empty (§2.1).
export function WorkoutEmptyState({ onBrowsePlans }) {
  const [pressed, setPressed] = useState(false);
  useAnnounce('No active workout plan');
  return (
    <View
      testID="workout-empty-state"
      accessibilityLiveRegion="polite"
      style={[hubStyles.card3d, styles.stateCard, styles.emptyPadding]}
    >
      <View style={styles.emptyCircle}>
        <Svg width={56} height={56} viewBox="0 0 64 64">
          <Rect x={6} y={24} width={8} height={16} rx={3} fill={colors.brand400} />
          <Rect x={16} y={27} width={5} height={10} rx={2} fill={colors.brand300} />
          <Rect x={43} y={27} width={5} height={10} rx={2} fill={colors.brand300} />
          <Rect x={50} y={24} width={8} height={16} rx={3} fill={colors.brand400} />
          <Rect x={21} y={30} width={22} height={4} rx={2} fill="rgba(17,24,39,0.70)" />
        </Svg>
      </View>
      <Text style={[styles.stateTitle, styles.emptyTitle]}>No active workout plan</Text>
      <Text style={styles.stateBody}>
        Pick a plan first, then come back here to start a workout with real backend data.
      </Text>
      <View style={styles.browseWrap}>
        <ColorPressable
          testID="workout-browse-plans"
          accessibilityRole="button"
          onPress={onBrowsePlans}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          colorsFor={() => ({})}
          style={[styles.browse, pressed && styles.browsePressed]}
        >
          <PressedGradient pressed={pressed} radius={radii.full} />
          <Text style={styles.browseLabel}>Browse plans</Text>
        </ColorPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    alignItems: 'center',
  },
  errorPadding: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyPadding: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  errorCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef2f2',
    boxShadow: SHADOW_INSET_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    experimental_backgroundImage: 'linear-gradient(135deg, #fef8e7, #eff1f4)',
    boxShadow: SHADOW_INSET_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyTitle: {
    marginTop: 24,
  },
  stateBody: {
    marginTop: 8,
    maxWidth: 384,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retry: {
    marginTop: 24,
    height: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    boxShadow: shadows.lift1,
  },
  sunk: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  retryLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  browseWrap: {
    marginTop: 24,
  },
  browse: {
    height: 48,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 28,
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #f4b400)',
    boxShadow: SHADOW_BRAND,
  },
  // The pressed stops come from the PressedGradient layer (§19.10).
  browsePressed: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  browseLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.35,
    color: colors.navy,
  },
});
