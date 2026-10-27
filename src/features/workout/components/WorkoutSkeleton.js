import { StyleSheet, View, useWindowDimensions } from 'react-native';

import Skeleton from '../../../shared/components/Skeleton';
import { breakpoints, colors, radii, spacing, textScale } from '../../../shared/theme/tokens';
import Card3D from './Card3D';

// H0 (RN-SPEC-workout §2.1): mirrors the hub layout. v2 look (UX G "Workout
// hub" Loading row; "Tablet: Workout hub": same layout, ring circle 132):
// the header, the hero (radius 32, padding 22 / 32, ring 104 / 132, Start
// 60 / 62), "All training days" and 4 day cards (radius 28, min 188, padding
// 16 / 22) in the hub's columns. Geometry follows 3a's WorkoutScreen Hub,
// TodayHeroCard and PlanDayCard. Shared Skeleton blocks (fillSkeleton,
// radius 10; pills and the ring keep their shape); shimmer off under reduced
// motion (the kit Skeleton). §9: text blocks grow to their role's cap as
// minHeight; the ring keeps its size; past textScale.reflowAbove the hero
// stacks and the days drop to one column, as the hub does. Day cards are the
// flat surface on every width (no gradient that could appear on a width
// change: Android gradient rule).
export const SKELETON_DAY_COUNT = 4;
const DAYS = Array.from({ length: SKELETON_DAY_COUNT }, (_, index) => index);

export default function WorkoutSkeleton() {
  const { width, fontScale = 1 } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const reflow = fontScale > textScale.reflowAbove;
  const columns = reflow ? 1 : width >= breakpoints.xl ? 3 : 2;
  // A text line's block: its line height at the role's capped scale.
  const line = (lineHeight, cap) => ({ minHeight: lineHeight * Math.max(1, Math.min(fontScale, cap)) });
  const rows = [];
  for (let start = 0; start < DAYS.length; start += columns) {
    rows.push(DAYS.slice(start, start + columns));
  }
  const statusPill = <Skeleton radius={radii.full} style={styles.statusPill} />;

  return (
    <View
      testID="workout-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading workout"
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={[styles.page, tablet && styles.pageTablet]}
    >
      <View style={styles.header}>
        <View testID="workout-skeleton-back" style={styles.backLink}>
          <Skeleton style={[styles.backText, line(20, textScale.body)]} />
        </View>
        <Skeleton testID="workout-skeleton-title" style={[styles.title, tablet && styles.titleTablet, line(tablet ? 64 : 52, textScale.display)]} />
      </View>

      <Card3D hero testID="workout-skeleton-hero" style={[styles.hero, tablet && styles.heroTablet]}>
        {tablet ? null : (
          <View testID="workout-skeleton-label-row" style={[styles.labelRow, reflow && styles.stacked]}>
            <Skeleton style={[styles.eyebrow, line(18, textScale.body)]} />
            {statusPill}
          </View>
        )}
        <View testID="workout-skeleton-hero-top" style={[styles.topRow, !tablet && styles.topRowPhone, reflow && styles.stacked]}>
          <View style={[styles.textColumn, reflow && styles.textColumnStacked]}>
            {tablet ? <Skeleton style={[styles.eyebrowTablet, line(20, textScale.body)]} /> : null}
            <Skeleton testID="workout-skeleton-plan" style={[styles.planName, tablet && styles.planNameTablet, line(tablet ? 58 : 40, textScale.display)]} />
            <Skeleton style={[styles.dayCount, tablet && styles.dayCountTablet, line(tablet ? 24 : 22, textScale.body)]} />
            {tablet ? <View style={styles.pillTablet}>{statusPill}</View> : null}
          </View>
          <Skeleton testID="workout-skeleton-ring" radius={radii.full} style={tablet ? styles.ringTablet : styles.ring} />
        </View>
        <Skeleton testID="workout-skeleton-detail" style={[styles.detail, line(tablet ? 24 : 22, textScale.body)]} />
        <Skeleton testID="workout-skeleton-start" radius={radii.full} style={[styles.start, tablet && styles.startTablet]} />
      </Card3D>

      <View style={styles.section}>
        <Skeleton style={[styles.heading, tablet && styles.headingTablet, line(tablet ? 22 : 28, textScale.title)]} />
        <View testID="workout-skeleton-days" style={[styles.days, tablet && styles.daysTablet]}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} testID={`workout-skeleton-day-row-${rowIndex}`} style={[styles.row, tablet && styles.rowTablet]}>
              {row.map((index) => (
                <Card3D key={index} testID={`workout-skeleton-day-${index}`} style={[styles.dayCard, tablet && styles.dayCardTablet]}>
                  <Skeleton
                    testID={`workout-skeleton-day-title-${index}`}
                    style={[styles.dayTitle, tablet && styles.dayTitleTablet, line(tablet ? 32 : 30, textScale.title)]}
                  />
                  <Skeleton radius={radii.full} style={[styles.weekdayPill, tablet && styles.weekdayPillTablet]} />
                  <Skeleton testID={`workout-skeleton-day-start-${index}`} radius={radii.full} style={[styles.dayStart, tablet && styles.dayStartTablet]} />
                </Card3D>
              ))}
              {Array.from({ length: columns - row.length }, (_, spacer) => (
                <View key={`spacer-${spacer}`} testID={`workout-skeleton-day-spacer-${spacer}`} style={styles.spacer} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // WorkoutScreen Hub: page gap 14 (tablet 18), bottom 20.
  page: { gap: spacing['3_5'], paddingBottom: spacing[5] },
  pageTablet: { gap: spacing['4_5'] },
  // HubHeader: padding 0 4; "← Today" 32 min; H1 52 / 64, mt 2.
  header: { paddingHorizontal: spacing[1] },
  backLink: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  backText: { width: 64 },
  title: { width: 200, marginTop: spacing['0_5'] },
  titleTablet: { width: 260 },
  // TodayHeroCard: radius 32, hairline-strong border, padding 22 / 32.
  hero: { borderRadius: radii.xxxl, borderColor: colors.hairlineStrong, padding: spacing['5_5'] },
  heroTablet: { padding: spacing[8] },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  eyebrow: { width: 72 },
  eyebrowTablet: { width: 80 },
  statusPill: { width: 112, minHeight: 28 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[5] },
  topRowPhone: { alignItems: 'flex-end', gap: spacing[3], marginTop: spacing['3_5'] },
  textColumn: { flex: 1, minWidth: 0 },
  textColumnStacked: { flex: 0, alignSelf: 'stretch' },
  planName: { width: '72%' },
  planNameTablet: { width: '80%', marginTop: spacing[2] },
  dayCount: { width: 120, marginTop: spacing['2_5'] },
  dayCountTablet: { width: 140, marginTop: spacing[2] },
  pillTablet: { marginTop: spacing['3_5'] },
  // ProgressRing 104 phone / 132 tablet: a circle keeps its size (§9 rule 3).
  ring: { width: 104, height: 104 },
  ringTablet: { width: 132, height: 132 },
  detail: { width: '62%', marginTop: spacing['4_5'] },
  // Hero Start: 60 tall, mt 16; tablet 62, max 420, mt 22.
  start: { minHeight: 60, marginTop: spacing[4] },
  startTablet: { minHeight: 62, maxWidth: 420, marginTop: spacing['5_5'] },
  // "All training days": section gap 12; heading mt 12 (tablet 6), padding 0 4.
  section: { gap: spacing[3] },
  heading: { width: 180, marginTop: spacing[3], marginHorizontal: spacing[1] },
  headingTablet: { width: 150, marginTop: spacing['1_5'] },
  // DayGrid: gap 12 (tablet 14) between rows and columns.
  days: { gap: spacing[3] },
  daysTablet: { gap: spacing['3_5'] },
  row: { flexDirection: 'row', gap: spacing[3] },
  rowTablet: { gap: spacing['3_5'] },
  spacer: { flex: 1 },
  // PlanDayCard (not done): radius 28, min 188, padding 16 / 22.
  dayCard: { flex: 1, minWidth: 0, minHeight: 188, borderRadius: radii.xxl, padding: spacing[4] },
  dayCardTablet: { padding: spacing['5_5'] },
  // The not-done title keeps the done cards' baseline (mt 40, as PlanDayCard).
  dayTitle: { width: '64%', marginTop: 40 },
  dayTitleTablet: { marginTop: 0 },
  weekdayPill: { width: 84, minHeight: 26, marginTop: spacing[2] },
  weekdayPillTablet: { marginTop: spacing['2_5'] },
  dayStart: { minHeight: 44, marginTop: 'auto' },
  dayStartTablet: { minHeight: 50, marginTop: spacing[4] },
});
