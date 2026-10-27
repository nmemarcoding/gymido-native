import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { breakpoints, colors } from '../../../shared/theme/tokens';
import Card3D from './Card3D';

// H0 (RN-SPEC-workout §2.1): mirrors the hub layout. Each bar's band sweeps
// −100% → 100% in 1.6 s; under reduced motion the band is hidden.
export default function WorkoutSkeleton() {
  const { width } = useWindowDimensions();
  const columns = width >= 1280 ? 3 : width >= breakpoints.sm ? 2 : 1;
  return (
    <View
      testID="workout-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading workout"
      accessibilityLiveRegion="polite"
      style={styles.page}
    >
      <Card3D style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Shimmer style={{ height: 12, width: 96 }} />
            <Shimmer style={{ height: 28, width: '66%' }} />
            <Shimmer style={{ height: 12, width: 128 }} />
          </View>
          <Shimmer style={styles.circle} />
        </View>
        <Shimmer style={styles.cta} />
      </Card3D>
      <View style={styles.days}>
        <Shimmer style={{ height: 12, width: 144 }} />
        <View style={styles.grid}>
          {[0, 1, 2].map((index) => (
            <Card3D key={index} style={[styles.dayCard, { width: columns === 1 ? '100%' : `${100 / columns - 2}%` }]}>
              <Shimmer style={{ height: 20, width: 128 }} />
              <View style={styles.pills}>
                <Shimmer style={{ height: 24, width: 80 }} />
                <Shimmer style={{ height: 24, width: 80 }} />
              </View>
              <Shimmer style={[styles.dayButton]} />
            </Card3D>
          ))}
        </View>
      </View>
    </View>
  );
}

function Shimmer({ style }) {
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion || width === 0) {
      return undefined;
    }
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [progress, reducedMotion, width]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  return (
    <View style={[styles.bar, style]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {!reducedMotion && width > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <GradientFill angle={90} colors={[colors.sheenClear, colors.sheenSkeleton, colors.sheenClear]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 20,
    paddingBottom: 20,
  },
  heroCard: {
    padding: 20,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 16,
  },
  heroText: {
    flex: 1,
    gap: 12,
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  cta: {
    height: 48,
    marginTop: 20,
  },
  days: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayCard: {
    padding: 20,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dayButton: {
    height: 44,
    marginTop: 16,
    borderRadius: 9999,
  },
  bar: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
});
