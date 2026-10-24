import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import GradientFill from '../../../shared/components/GradientFill';
import Spinner from '../../../shared/components/Spinner';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { dayTitle } from '../workoutFormat';
import Card3D from './Card3D';

const RISE = Easing.bezier(0.22, 1, 0.36, 1);

// H5 (RN-SPEC-workout §2.3). The card is not pressable; only Start is.
// §19.10: the accent bar's gradient is always drawn and a solid layer above
// it fades out when the day is done, so completing never creates a gradient.
export default function PlanDayCard({ day, weekdays, isDone, starting, onStart, index, style }) {
  const reducedMotion = useReducedMotion();
  const rise = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      rise.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(rise, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 6) * 45,
      easing: RISE,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reducedMotion, rise]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[style, { opacity: rise, transform: [{ translateY }] }]}>
      <Card3D testID={`workout-day-${day.id}`} style={isDone ? styles.cardDone : undefined}>
        <View style={styles.clip}>
          <View style={styles.accent} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <GradientFill colors={['#f7ce4f', '#dda000']} />
            <View style={[StyleSheet.absoluteFill, styles.accentSolid, { opacity: isDone ? 0 : 1 }]} />
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{dayTitle(day)}</Text>
              {isDone ? (
                <View style={styles.donePill}>
                  <GradientFill angle={135} colors={['#f7ce4f', '#dda000']} />
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.navy} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6 9 17l-5-5" />
                  </Svg>
                  <Text style={styles.doneText}>Done this week</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.pills}>
              {weekdays.length ? (
                weekdays.map((weekday) => (
                  <View key={weekday.id} style={styles.pill}>
                    <Text style={styles.pillText}>{weekday.name}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Unscheduled</Text>
                </View>
              )}
            </View>
            <Pressable
              testID={`workout-day-start-${day.id}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: starting, busy: starting }}
              disabled={starting}
              onPress={onStart}
              style={({ pressed }) => [
                styles.start,
                pressed && !starting ? styles.startPressed : styles.startResting,
                starting && styles.startLoading,
              ]}
            >
              {starting ? <Spinner size={16} thickness={2} color={colors.textPrimary} track="transparent" /> : null}
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          </View>
        </View>
      </Card3D>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The card's border changes when the day is done, so the card never clips
  // (Android blank-render class); the inner clip layer, whose style never
  // changes, rounds the accent strip instead.
  clip: {
    flexGrow: 1,
    flexDirection: 'row',
    borderRadius: radii.xxxl,
    overflow: 'hidden',
  },
  cardDone: {
    borderWidth: 1,
    borderColor: colors.brand400,
  },
  accent: {
    width: 6,
  },
  accentSolid: {
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    flex: 1,
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
    boxShadow: shadows.lift1,
  },
  doneText: {
    fontSize: 10.4,
    lineHeight: 15.6,
    fontWeight: '700',
    letterSpacing: 0.26,
    textTransform: 'uppercase',
    color: colors.navy,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    boxShadow: shadows.emboss,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    // A1: text-secondary on muted pills, "Unscheduled" included.
    color: colors.textSecondary,
  },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    minHeight: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  startResting: {
    boxShadow: shadows.soft,
  },
  startPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  startLoading: {
    opacity: 0.6,
  },
  startText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
