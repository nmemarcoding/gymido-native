import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, radii } from '../../../shared/theme/tokens';
import { hubStyles } from './hubChrome';

// Shimmer bar (§2.1): radius 16, surfaceMuted, with a band sweeping -100%→100%
// over 1.6s linear. Under reduced motion the band is hidden entirely.
function Shimmer({ width, height, radius = radii.xl, style }) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [bandWidth, setBandWidth] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reducedMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-bandWidth, bandWidth] });

  return (
    <View
      onLayout={(event) => setBandWidth(event.nativeEvent.layout.width)}
      style={[styles.shimmer, { width, height, borderRadius: radius }, style]}
    >
      {reducedMotion ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, styles.band, { transform: [{ translateX }] }]} />
      )}
    </View>
  );
}

// H0 (§2.1): mirrors the real layout so nothing shifts.
export default function WorkoutSkeleton() {
  return (
    <View
      testID="workout-skeleton"
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      accessibilityLabel="Loading workout"
      style={styles.root}
    >
      <View style={[hubStyles.card3d, styles.heroBlock]}>
        <View style={styles.heroRow}>
          <View style={styles.heroColumn}>
            <Shimmer width={96} height={12} />
            <Shimmer width="66%" height={28} />
            <Shimmer width={128} height={12} />
          </View>
          <Shimmer width={72} height={72} radius={36} />
        </View>
        <Shimmer width="100%" height={48} style={styles.heroCta} />
      </View>

      <View style={styles.daysBlock}>
        <Shimmer width={144} height={12} />
        <View style={styles.grid}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[hubStyles.card3d, styles.dayCard]}>
              <Shimmer width={128} height={20} />
              <View style={styles.pillRow}>
                <Shimmer width={80} height={24} />
                <Shimmer width={80} height={24} />
              </View>
              <Shimmer width="100%" height={44} style={styles.dayCta} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 20,
    paddingBottom: 20,
  },
  shimmer: {
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  band: {
    experimental_backgroundImage: 'linear-gradient(to right, transparent, rgba(255,255,255,0.7), transparent)',
  },
  heroBlock: {
    padding: 20,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 16,
  },
  heroColumn: {
    flex: 1,
    gap: 12,
  },
  heroCta: {
    marginTop: 20,
  },
  daysBlock: {
    gap: 12,
  },
  grid: {
    gap: 12,
  },
  dayCard: {
    padding: 20,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dayCta: {
    marginTop: 16,
  },
});
