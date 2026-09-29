import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import Spinner from '../../../shared/components/Spinner';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { ColorPressable } from '../../plans/components/PlanBits';
import { hubStyles, PRESS_SHADOW, SHADOW_EMBOSS, SHADOW_LIFT_2_HOVER } from './hubChrome';

const RISE_IN_EASING = Easing.bezier(0.22, 1, 0.36, 1);

// §14 riseIn: opacity 0→1 + translateY 12→0 over 300ms, staggered by
// min(index, 6) × 45ms; disabled under reduced motion.
function RiseIn({ index, children }) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 6) * 45,
      easing: RISE_IN_EASING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reducedMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// PlanDayCard (RN-SPEC-workout §2.3). ⚠W2: every day always has a working
// Start, including one already done this week.
export default function PlanDayCard({ day, weekdays, isDone, isStarting, onStart, index = 0 }) {
  const [pressed, setPressed] = useState(false);

  return (
    <RiseIn index={index}>
      <View
        testID={`plan-day-card-${day.id}`}
        style={[hubStyles.card3d, styles.card, isDone && styles.cardDone, pressed && styles.cardPressed]}
      >
        <View importantForAccessibility="no" accessibilityElementsHidden style={styles.accent}>
          <View style={styles.accentGradient} />
          <View testID="plan-day-accent-solid" style={[styles.accentSolid, { opacity: isDone ? 0 : 1 }]} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{day.title || `Day ${day.day_number}`}</Text>
            {isDone ? (
              <View style={styles.donePill}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6 9 17l-5-5"
                    stroke={colors.navy}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.donePillLabel}>Done this week</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.pillRow}>
            {weekdays.length ? (
              weekdays.map((weekday) => (
                <View key={weekday.id} style={styles.weekdayPill}>
                  <Text style={styles.weekdayLabel}>{weekday.name}</Text>
                </View>
              ))
            ) : (
              <View style={styles.weekdayPill}>
                <Text style={[styles.weekdayLabel, styles.unscheduled]}>Unscheduled</Text>
              </View>
            )}
          </View>

          <View style={[styles.startWrap, isStarting && styles.startDisabled]}>
            <ColorPressable
              testID={`plan-day-start-${day.id}`}
              accessibilityRole="button"
              accessibilityLabel="Start"
              accessibilityState={{ disabled: isStarting, busy: isStarting }}
              disabled={isStarting}
              onPress={onStart}
              onPressIn={() => setPressed(true)}
              onPressOut={() => setPressed(false)}
              transitionMs={200}
              colorsFor={(active) => ({ backgroundColor: active ? colors.surfaceMuted : colors.surface })}
              style={({ pressed: isPressed }) => [styles.start, isPressed && !isStarting && styles.startPressed]}
            >
              {isStarting ? (
                <Spinner size={16} thickness={2} trackColor={colors.textPrimary} arcColor="transparent" />
              ) : null}
              <Text style={styles.startLabel}>Start</Text>
            </ColorPressable>
          </View>
        </View>
      </View>
    </RiseIn>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardDone: {
    borderColor: colors.brand400,
  },
  // card-3d-hover → the pressed state on touch (RN-SPEC-plans §9.1).
  cardPressed: {
    boxShadow: SHADOW_LIFT_2_HOVER,
    transform: [{ translateY: -2 }],
  },
  accent: {
    width: 6,
  },
  // §19.10 "pre-create, don't acquire": the gradient is ALWAYS present and a
  // solid layer above it is faded out when the day completes. The bar's height
  // is stretched to the card, so a gradient ACQUIRED on the state change could
  // be drawn with zero height — the Android draw crash. Here the drawable is
  // created once, at mount, and the state change only changes an opacity.
  accentGradient: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #dda000)',
  },
  accentSolid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    flex: 1,
    minWidth: 0,
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
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
    experimental_backgroundImage: 'linear-gradient(135deg, #f7ce4f, #dda000)',
    boxShadow: shadows.lift1,
  },
  donePillLabel: {
    fontSize: 10.4,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.26,
    textTransform: 'uppercase',
    color: colors.navy,
  },
  pillRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  weekdayPill: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    boxShadow: SHADOW_EMBOSS,
  },
  weekdayLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  unscheduled: {
    color: colors.textMuted,
  },
  startWrap: {
    marginTop: 16,
  },
  startDisabled: {
    opacity: 0.6,
  },
  start: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.plansSoft,
  },
  startPressed: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  startLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
