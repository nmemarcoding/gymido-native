import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, CAP_PILL } from '../../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { CheckIcon } from './HubIcons';

// T-76 "This week": "X of Y done", the teal bar and the Mon–Sun strip from
// GET /my-plans/current/week (hubModel weekStrip / weekProgress). Labels are
// 13/600 (N1); rest and missed use text-muted (N2); missed is the dashed
// circle (C3). Each day is one screen-reader stop ("Thu: today, training").
// Past the large-text reflow the strip wraps to 3 columns. A week WITH a
// missed day wraps to 4 columns while the card's CONTENT (the strip itself,
// inside the 14 padding + 1 border) is narrower than 352 ("Missed" needs ~46
// of a 7th; RN-SPEC T-76, web 219447b5).
const CIRCLE = 34;
export const MISSED_WRAP_BELOW = 352;

export default function HubWeekCard({ strip, progress, reflow = false, style }) {
  const [width, setWidth] = useState(0);
  const ratio = progress.total > 0 ? Math.min(progress.done / progress.total, 1) : 0;
  const columns = reflow ? 3 : width > 0 && width < MISSED_WRAP_BELOW && strip.some((cell) => cell.kind === 'missed') ? 4 : 7;
  const wrapped = columns < 7;
  return (
    <View testID="workout-week" style={[styles.card, style]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" {...CAP_BODY} style={styles.title}>
          This week
        </Text>
        <Text testID="workout-week-count" {...CAP_BODY} style={styles.count}>
          <Text style={styles.countStrong}>{`${progress.done} of ${progress.total}`}</Text> done
        </Text>
      </View>
      <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View testID="workout-week-bar" style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <View testID="workout-week-strip" style={[styles.strip, wrapped && styles.stripWrap]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {strip.map((cell) => (
          <View
            key={cell.key}
            testID={`workout-week-day-${cell.key}`}
            accessible
            accessibilityLabel={cell.a11y}
            style={[styles.cell, wrapped && styles.cellWrap, wrapped && { width: `${100 / columns}%` }]}
          >
            <DayCircle cell={cell} />
            <Text {...CAP_PILL} style={[styles.label, LABEL_COLORS[cell.kind]]}>
              {cell.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DayCircle({ cell }) {
  if (cell.kind === 'done') {
    return (
      <View testID={`workout-week-circle-${cell.key}`} style={[styles.circle, styles.done]}>
        <CheckIcon size={13} color={colors.onGold} strokeWidth={3.2} />
      </View>
    );
  }
  return (
    <View testID={`workout-week-circle-${cell.key}`} style={[styles.circle, CIRCLE_LOOKS[cell.kind]]}>
      <Text {...CAP_PILL} style={[styles.letter, LETTER_LOOKS[cell.kind]]}>
        {cell.letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    paddingTop: spacing[4],
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
  },
  title: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  count: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  countStrong: {
    ...font(700),
    color: colors.textPrimary,
  },
  track: {
    marginTop: 12,
    marginHorizontal: spacing[1],
    marginBottom: 14,
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.teal,
  },
  strip: {
    flexDirection: 'row',
  },
  stripWrap: {
    flexWrap: 'wrap',
    rowGap: 12,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  cellWrap: {
    flex: 0,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    backgroundColor: colors.teal,
  },
  letter: {
    ...font(600),
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  // N1: 13/600 and never clipped; "Missed" is wider than a 320 column, so the
  // label gets a fixed box centred on its column (it may overhang the gap).
  label: {
    ...font(600),
    width: 60,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

const CIRCLE_LOOKS = StyleSheet.create({
  today: { backgroundColor: colors.gold },
  todayRest: { borderWidth: 2, borderColor: colors.gold },
  // RN-SPEC T-76: 2px text-muted (the token for the board's white 0.35).
  train: { borderWidth: 2, borderColor: colors.textMuted },
  missed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.hairlineBright },
  rest: {},
});

const LETTER_LOOKS = StyleSheet.create({
  today: { ...font(700), color: colors.onGold },
  todayRest: { ...font(700), color: colors.gold },
  train: { color: colors.textPrimary },
  missed: { color: colors.textMuted },
  rest: { ...font(400), color: colors.textMuted },
});

const LABEL_COLORS = StyleSheet.create({
  done: { color: colors.teal },
  today: { color: colors.gold },
  todayRest: { color: colors.gold },
  train: { color: colors.textSecondary },
  missed: { color: colors.textMuted },
  rest: { color: colors.textMuted },
});
