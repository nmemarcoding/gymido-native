import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import GradientFill from '../../../shared/components/GradientFill';
import { colors, shadows } from '../../../shared/theme/tokens';
import PillButton from '../../../shared/components/PillButton';
import Card3D from './Card3D';

// H1 (RN-SPEC-workout §2.1): the transport message, else "Please try again."
export function WorkoutErrorState({ message, onRetry }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(['Workout unavailable', message].filter(Boolean).join(' '));
  }, [message]);
  return (
    <Card3D testID="workout-error" style={styles.errorCard}>
      <View accessibilityLiveRegion="assertive" style={styles.center}>
        <View style={styles.errorCircle}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </Svg>
        </View>
        <Text textBreakStrategy="simple" style={styles.title}>Workout unavailable</Text>
        {message ? <Text style={styles.body}>{message}</Text> : null}
        <Pressable
          testID="workout-error-retry"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed ? styles.retryPressed : styles.retryResting]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    </Card3D>
  );
}

// H2 (RN-SPEC-workout §2.1).
export function WorkoutEmptyState({ onBrowse }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('No active workout plan');
  }, []);
  return (
    <Card3D testID="workout-empty" style={styles.emptyCard}>
      <View accessibilityLiveRegion="polite" style={styles.center}>
        <View style={styles.emptyCircle}>
          <GradientFill angle={135} colors={['#fef8e7', '#eff1f4']} />
          <Svg width={56} height={56} viewBox="0 0 64 64">
            <Rect x={6} y={24} width={8} height={16} rx={3} fill="#f4b400" />
            <Rect x={16} y={27} width={5} height={10} rx={2} fill="#f7ce4f" />
            <Rect x={43} y={27} width={5} height={10} rx={2} fill="#f7ce4f" />
            <Rect x={50} y={24} width={8} height={16} rx={3} fill="#f4b400" />
            <Rect x={21} y={30} width={22} height={4} rx={2} fill="rgba(17, 24, 39, 0.70)" />
          </Svg>
        </View>
        <Text textBreakStrategy="simple" style={[styles.title, styles.emptyTitle]}>No active workout plan</Text>
        <Text style={styles.body}>Pick a plan first, then come back here to start a workout with real backend data.</Text>
        {/* Design system v1 #18: the hero gradient is only for Start/Complete workout. */}
        <View style={styles.browse}>
          <PillButton testID="workout-browse-plans" title="Browse plans" onPress={onBrowse} />
        </View>
      </View>
    </Card3D>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  errorCard: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  errorCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    boxShadow: shadows.press,
  },
  title: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
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
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
  },
  retryResting: {
    boxShadow: shadows.lift1,
  },
  retryPressed: {
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  retryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyCard: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.press,
  },
  emptyTitle: {
    marginTop: 24,
  },
  browse: {
    marginTop: 24,
  },
});
