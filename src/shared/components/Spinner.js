import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, motion } from '../theme/tokens';

// RN-SPEC-v2-foundation §5: a gold arc on a faint track. `color` is the arc,
// `track` the rest of the ring. 1 s per turn; under reduced motion it slows
// to `reducedMotionLoopMs` (default 3 s) and never stops.
export default function Spinner({
  size = 40,
  thickness = 4,
  color = colors.gold,
  track = colors.hairlineStrong,
  reducedMotionLoopMs = motion.spinnerReducedLoopMs,
}) {
  const reducedMotion = useReducedMotion();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: reducedMotion ? reducedMotionLoopMs : motion.spinnerLoopMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation, reducedMotion, reducedMotionLoopMs]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const half = size / 2;
  const radius = Math.max(0, half - thickness / 2);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { width: size, height: size, transform: [{ rotate }] }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={half} cy={half} r={radius} fill="none" stroke={track} strokeWidth={thickness} />
        {/* A quarter arc from 12 to 3 o'clock, round caps. */}
        <Path
          d={`M ${half} ${half - radius} A ${radius} ${radius} 0 0 1 ${half + radius} ${half}`}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {},
});
