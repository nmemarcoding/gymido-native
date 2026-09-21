import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { plansMotion } from '../theme/tokens';
import { useReducedMotion } from './useReducedMotion';

// Tailwind's default `transition-colors` timing function.
const TAILWIND_EASE = Easing.bezier(0.4, 0, 0.2, 1);

// Animates a color to `target` over 150ms, like the web's transition-colors
// (RN-SPEC-plans §2.6). With reduce motion on it jumps to the end state.
export function useColorTransition(target, duration = plansMotion.colorMs) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  const range = useRef({ from: target, to: target });

  if (range.current.to !== target) {
    range.current = { from: range.current.to, to: target };
  }

  useLayoutEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: TAILWIND_EASE,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, reducedMotion, progress, duration]);

  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: [range.current.from, range.current.to],
  });
}
