import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, motion } from '../theme/tokens';

// `color` is the moving top segment, `track` the rest of the ring. Under
// reduced motion the ring stops, unless `reducedMotionLoopMs` is given: then
// it keeps turning at that slower pace.
export default function Spinner({ size = 40, thickness = 4, color = colors.brand400, track = colors.border, reducedMotionLoopMs }) {
  const reducedMotion = useReducedMotion();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion && !reducedMotionLoopMs) {
      rotation.setValue(0);
      return undefined;
    }
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

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: track,
          borderTopColor: color,
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {},
});
