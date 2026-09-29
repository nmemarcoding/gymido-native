import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors } from '../../../shared/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ProgressRing (RN-SPEC-workout §2.4). viewBox 0 0 100 100, rotated -90° so the
// arc starts at 12 o'clock. The offset animates over 300ms ease-out on value
// change only; never under reduced motion.
//
// The label is `children`, exactly like the web, because it genuinely differs
// per usage (a stacked count, a fraction, a check icon) — do not unify it. It
// renders in an overlay covering the ring, centred both ways, and the ring is a
// single accessible image carrying `label`, so the number is never read twice.
export default function ProgressRing({ value, total, size = 84, thickness = 9, label, children }) {
  const reducedMotion = useReducedMotion();
  const radius = 50 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = total > 0 ? total : 0;
  const clamped = safeTotal > 0 ? Math.min(Math.max(value, 0), safeTotal) : 0;
  const ratio = safeTotal > 0 ? clamped / safeTotal : 0;
  const offset = circumference * (1 - ratio);

  const [animated] = useState(() => new Animated.Value(offset));
  const previous = useRef(offset);

  useEffect(() => {
    if (previous.current === offset) {
      return undefined;
    }
    previous.current = offset;
    if (reducedMotion) {
      animated.setValue(offset);
      return undefined;
    }
    const animation = Animated.timing(animated, {
      toValue: offset,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [offset, reducedMotion, animated]);

  return (
    <View
      testID="progress-ring"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" style={styles.svg}>
        <Defs>
          {/* Declared top-left → bottom-right like the web, but the Svg's
              −90° rotation (styles.svg) turns it with the arc, so on screen it
              runs lower-left (light) → upper-right (dark), as the web does. If
              the 12-o'clock start ever moves to a dash offset instead of the
              rotation, this must become 0,100% → 100%,0. */}
          <LinearGradient id="ringArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.brand300} />
            <Stop offset="100%" stopColor={colors.brand500} />
          </LinearGradient>
        </Defs>
        <Circle cx={50} cy={50} r={radius} stroke={colors.surfaceMuted} strokeWidth={thickness} fill="none" />
        {/* The groove: a second track offset 0.6 upward. */}
        <Circle cx={50} cy={49.4} r={radius} stroke="rgba(17,24,39,0.05)" strokeWidth={thickness} fill="none" />
        {safeTotal > 0 ? (
          <AnimatedCircle
            cx={50}
            cy={50}
            r={radius}
            stroke="url(#ringArc)"
            strokeWidth={thickness}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={animated}
          />
        ) : null}
      </Svg>
      <View
        testID="progress-ring-label"
        style={styles.center}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    transform: [{ rotate: '-90deg' }],
  },
  // Covers the whole ring (inset 0). No overflow clip on the wrapper, so an
  // over-long label overflows visibly rather than being cut off (§2.4).
  center: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// The per-usage labels (§2.4), kept beside the component so they stay in step.
export const ringLabelStyles = StyleSheet.create({
  // 1. Hub hero: the count, then "of {total}" 2pt below.
  heroCount: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroTotal: {
    marginTop: 2,
    fontSize: 9.6,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.34,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  // 2. ExerciseStage: one line, "{done}/{total}".
  fraction: {
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
