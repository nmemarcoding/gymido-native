import { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors } from '../../../shared/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// RN-SPEC-workout §2.4: viewBox 100, rotated −90° so the arc starts at 12
// o'clock and runs clockwise; the gradient rotates with it (lower-left
// lightest, upper-right darkest). The label sits in an overlay View, never
// SVG text. `total ≤ 0` draws no arc.
// `flat` (v2 §4.8 Progress ring, Phase 3 Today/Hub/Progress boards): a solid
// gold round-cap arc on the 0.08 `track`, no groove and no gradient. Off by
// default so the other callers keep their look until they adopt it.
export default function ProgressRing({ value, total, size, thickness, label, children, flat = false, accessibilityRole = 'image', accessibilityValue }) {
  const id = useId().replace(/:/g, '');
  const reducedMotion = useReducedMotion();
  const radius = 50 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(Math.max(value, 0), total) / total : 0;
  const offset = circumference * (1 - ratio);
  const animated = useRef(new Animated.Value(offset)).current;

  useEffect(() => {
    if (reducedMotion) {
      animated.setValue(offset);
      return undefined;
    }
    const animation = Animated.timing(animated, { toValue: offset, duration: 300, easing: EASE_OUT, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [animated, offset, reducedMotion]);

  return (
    <View
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityValue={accessibilityValue}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" style={styles.rotated}>
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={colors.brand300} />
            <Stop offset="1" stopColor={colors.brand500} />
          </LinearGradient>
        </Defs>
        {flat ? (
          <Circle testID="progress-ring-track" cx={50} cy={50} r={radius} fill="none" stroke={colors.track} strokeWidth={thickness} />
        ) : (
          <>
            <Circle cx={50} cy={50} r={radius} fill="none" stroke={colors.surfaceMuted} strokeWidth={thickness} />
            {/* The groove sits 0.6 up on screen; after the −90° turn that is +x. */}
            <Circle cx={50.6} cy={50} r={radius} fill="none" stroke={colors.ringTrack} strokeWidth={thickness} />
          </>
        )}
        {ratio > 0 ? (
          <AnimatedCircle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            testID="progress-ring-arc"
            stroke={flat ? colors.gold : `url(#${id})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={animated}
          />
        ) : null}
      </Svg>
      <View style={styles.label} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
  },
  rotated: {
    transform: [{ rotate: '-90deg' }],
  },
  label: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
