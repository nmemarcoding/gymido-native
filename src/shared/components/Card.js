import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, motion, shadows } from '../theme/tokens';

// CSS `ease-out`, matching the web card entrance.
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

export default function Card({ children, style }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.cardEntranceMs,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.cardOffsetY, 0],
  });

  return (
    <Animated.View style={[styles.card, { opacity: progress, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    boxShadow: shadows.soft,
  },
});
