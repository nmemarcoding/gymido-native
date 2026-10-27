import { StyleSheet, View, useWindowDimensions } from 'react-native';

import Skeleton from '../../../shared/components/Skeleton';
import { breakpoints, radii, spacing } from '../../../shared/theme/tokens';
import Card3D from './Card3D';

// H0 (RN-SPEC-workout §2.1): mirrors the hub layout. v2 look
// (RN-SPEC-v2-foundation §5): shared Skeleton blocks (fillSkeleton, radius
// 10, pills and the ring keep their shape); shimmer off under reduced motion.
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
            <Skeleton style={{ height: 12, width: 96 }} />
            <Skeleton style={{ height: 28, width: '66%' }} />
            <Skeleton style={{ height: 12, width: 128 }} />
          </View>
          <Skeleton radius={36} style={styles.circle} />
        </View>
        <Skeleton radius={radii.full} style={styles.cta} />
      </Card3D>
      <View style={styles.days}>
        <Skeleton style={{ height: 12, width: 144 }} />
        <View style={styles.grid}>
          {[0, 1, 2].map((index) => (
            <Card3D key={index} style={[styles.dayCard, { width: columns === 1 ? '100%' : `${100 / columns - 2}%` }]}>
              <Skeleton style={{ height: 20, width: 128 }} />
              <View style={styles.pills}>
                <Skeleton radius={radii.full} style={{ height: 24, width: 80 }} />
                <Skeleton radius={radii.full} style={{ height: 24, width: 80 }} />
              </View>
              <Skeleton radius={radii.full} style={styles.dayButton} />
            </Card3D>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[5],
    paddingBottom: spacing[5],
  },
  heroCard: {
    padding: spacing[5],
  },
  heroRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  heroText: {
    flex: 1,
    gap: spacing[3],
  },
  circle: {
    width: 72,
    height: 72,
  },
  cta: {
    height: 52,
    marginTop: spacing[5],
  },
  days: {
    gap: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  dayCard: {
    padding: spacing['4_5'],
  },
  pills: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  dayButton: {
    height: 44,
    marginTop: spacing[4],
  },
});
