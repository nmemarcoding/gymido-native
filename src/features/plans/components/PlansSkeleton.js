import { StyleSheet, View } from 'react-native';

import Skeleton from '../../../shared/components/Skeleton';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

const CIRCLES = [1, 2, 3, 4, 5, 6, 7];

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §5, audit X5):
// the PHONE Plans loading state in the page's final shapes: the active card
// (150 header block, the name and meta bars, the week inset with 7 × 36
// circles, the 54 Start pill), the "Make it your own" list card (2 × 76
// rows) and 2 × 108 catalog cards. Kit Skeleton blocks (shimmer off under
// reduced motion); the region is busy and labelled "Loading plans".
export default function PlansSkeleton() {
  return (
    <View
      testID="plans-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading plans"
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={styles.page}
    >
      <View testID="plans-skeleton-card" style={styles.card}>
        <Skeleton testID="plans-skeleton-photo" radius={0} style={styles.photo} />
        <View style={styles.body}>
          <Skeleton style={styles.name} />
          <Skeleton style={styles.meta} />
          <View style={styles.week}>
            {CIRCLES.map((id) => (
              <Skeleton key={id} testID="plans-skeleton-circle" radius={radii.full} style={styles.circle} />
            ))}
          </View>
          <Skeleton testID="plans-skeleton-start" radius={radii.full} style={styles.start} />
        </View>
      </View>
      <Skeleton style={styles.heading} />
      <View style={styles.list}>
        <Skeleton testID="plans-skeleton-row" radius={0} style={styles.row} />
        <View style={styles.divider} />
        <Skeleton testID="plans-skeleton-row" radius={0} style={styles.row} />
      </View>
      <Skeleton style={styles.heading} />
      <Skeleton testID="plans-skeleton-plan" radius={radii.lgPlus} style={styles.plan} />
      <Skeleton testID="plans-skeleton-plan" radius={radii.lgPlus} style={styles.plan} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  photo: {
    height: 150,
  },
  body: {
    gap: spacing[2],
    padding: spacing[5],
  },
  name: {
    width: '70%',
    height: 30,
  },
  meta: {
    width: '50%',
    height: 15,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing['2_5'],
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWell,
  },
  circle: {
    width: 36,
    height: 36,
  },
  start: {
    height: 54,
    marginTop: spacing['2_5'],
  },
  heading: {
    width: '45%',
    height: 26,
    marginTop: spacing[4],
  },
  list: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  row: {
    height: 76,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  plan: {
    height: 108,
  },
});
