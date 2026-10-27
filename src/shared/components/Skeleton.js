import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/tokens';
import GradientFill from './GradientFill';

// RN-SPEC-v2-foundation §5 Skeleton: a soft block (colors.fillSkeleton,
// radius 10) in the content's shape, hidden from screen readers (the
// surrounding loading region carries the label). A faint band sweeps across
// it every 1.6 s; under reduced motion the shimmer is off (the band is hidden
// and its loop stopped). The band's GradientFill is mounted from the first
// render and only hidden, never added later (Android gradient rule).
export const SKELETON_RADIUS = 10;
export const SHIMMER_MS = 1600;

export default function Skeleton({ style, radius = SKELETON_RADIUS, shimmer = true, testID }) {
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const sweeping = shimmer && !reducedMotion && width > 0;

  useEffect(() => {
    if (!sweeping) {
      return undefined;
    }
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: SHIMMER_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [progress, sweeping]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { borderRadius: radius }, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {shimmer ? (
        <Animated.View
          testID={testID ? `${testID}-shimmer` : undefined}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: sweeping ? 1 : 0, transform: [{ translateX }] }]}
        >
          <GradientFill angle={90} colors={[colors.skeletonShimmerEdge, colors.skeletonShimmer, colors.skeletonShimmerEdge]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
    backgroundColor: colors.fillSkeleton,
  },
});
