import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../shared/components/largeText';
import Skeleton from '../../../shared/components/Skeleton';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';

// T-76 state 7 (board "Workout hub states" 6 · Loading, UX U3): under the
// real page header, the today card (eyebrow, title, meta, 4 photos, the 56
// action), the week card (title, bar, 7 circles) and 3 day rows, then
// "Loading your workout…" as the polite status (the progressbar's label stays
// "Loading workout", RN-SPEC T-76). Kit Skeleton blocks (shimmer
// off under reduced motion). `split`: the tablet layout, week and rows side
// by side under the today card, as the loaded hub.
export const SKELETON_ROW_COUNT = 3;

export default function WorkoutSkeleton({ split = false }) {
  const week = (
    <View testID="workout-skeleton-week" style={[styles.card, styles.weekCard, split && styles.column]}>
      <Skeleton style={styles.weekTitle} />
      <Skeleton radius={6} style={styles.bar} />
      <View style={styles.circles}>
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} radius={radii.full} style={styles.circle} />
        ))}
      </View>
    </View>
  );
  const rows = (
    <View testID="workout-skeleton-rows" style={[styles.card, styles.rowsCard, split && styles.columnWide]}>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton radius={14} style={styles.rowPhoto} />
          <View style={styles.rowText}>
            <Skeleton style={styles.rowTitle} />
            <Skeleton style={styles.rowMeta} />
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <View testID="workout-skeleton" accessibilityRole="progressbar" accessibilityLabel="Loading workout" accessibilityState={{ busy: true }} style={styles.page}>
      <View testID="workout-skeleton-today" style={[styles.card, styles.todayCard]}>
        <Skeleton style={styles.eyebrow} />
        <Skeleton style={styles.title} />
        <Skeleton style={styles.meta} />
        <View style={styles.photos}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} radius={14} style={styles.photo} />
          ))}
        </View>
        <Skeleton radius={radii.full} style={styles.action} />
      </View>
      {split ? (
        <View style={styles.split}>
          {week}
          {rows}
        </View>
      ) : (
        <>
          {week}
          {rows}
        </>
      )}
      <Text testID="workout-skeleton-status" accessibilityLiveRegion="polite" {...CAP_BODY} style={styles.status}>
        Loading your workout…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  todayCard: {
    borderRadius: radii.xxl,
    padding: 18,
  },
  weekCard: {
    borderRadius: radii.xl,
    padding: spacing[4],
  },
  rowsCard: {
    borderRadius: radii.xl,
    padding: 14,
    gap: 14,
  },
  split: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  column: {
    flex: 1,
  },
  columnWide: {
    flex: 1.15,
  },
  eyebrow: { width: '40%', minHeight: 14 },
  title: { width: '60%', minHeight: 30, marginTop: 10 },
  meta: { width: '70%', minHeight: 14, marginTop: 10 },
  photos: { marginTop: spacing[4], flexDirection: 'row', gap: 8 },
  photo: { flex: 1, height: 64 },
  action: { marginTop: 18, height: 56 },
  weekTitle: { width: '35%', minHeight: 16 },
  bar: { marginTop: 14, height: 6 },
  circles: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  circle: { width: 34, height: 34 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowPhoto: { width: 56, height: 56 },
  rowText: { flex: 1, gap: 8 },
  rowTitle: { width: '50%', minHeight: 14 },
  rowMeta: { width: '70%', minHeight: 12 },
  status: {
    ...font(400),
    marginHorizontal: spacing[1],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
