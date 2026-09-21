import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, motion } from '../theme/tokens';

// thickness / trackColor / arcColor let the Plans screens draw their 20px,
// 2px-ring spinners (RN-SPEC-plans §3.7, §4.6); defaults are unchanged.
export default function Spinner({
  size = 40,
  thickness = 4,
  trackColor = colors.border,
  arcColor = colors.brand400,
}) {
  const reducedMotion = useReducedMotion();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      rotation.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: motion.spinnerLoopMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation, reducedMotion]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: trackColor,
          borderTopColor: arcColor,
          transform: [{ rotate }],
        },
      ]}
    />
  );
}
