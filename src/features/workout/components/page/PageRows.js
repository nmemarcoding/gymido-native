import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, LINE_TEXT } from '../../../../shared/components/largeText';
import { colors, font } from '../../../../shared/theme/tokens';
import { CheckIcon, ChevronRightIcon } from '../hub/HubIcons';

// T-140 (UX build ruling §3, §7): the stats card, the Last workout row and the
// missed line, under the week card.

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export function StatsCard({ time, volume, large = false }) {
  return (
    <View testID="workout-stats" style={styles.stats}>
      <View accessible accessibilityLabel={`Time this week, ${time}`} style={[styles.cell, styles.cellDivider]}>
        <Text {...CAP_BODY} style={styles.statLabel}>
          Time this week
        </Text>
        <Text {...CAP_BODY} testID="workout-stats-time" style={[styles.statValue, large && styles.statValueLarge]}>
          {time}
        </Text>
      </View>
      <View accessible accessibilityLabel={`Volume, ${volume ?? 'none'}`} style={styles.cell}>
        <Text {...CAP_BODY} style={styles.statLabel}>
          Volume
        </Text>
        <Text {...CAP_BODY} testID="workout-stats-volume" style={[styles.statValue, large && styles.statValueLarge]}>
          {volume ?? '—'}
        </Text>
      </View>
    </View>
  );
}

// `wrap` (past the large-text reflow, UX (a)): the text takes up to 2 lines
// and keeps its "Last workout ·" lead; the when-text + chevron stay right, top.
export function LastWorkoutRow({ title, when, onPress, tall = false, wrap = false, ref }) {
  return (
    <Pressable
      ref={ref}
      testID="workout-last"
      accessibilityRole="button"
      accessibilityLabel={`Last workout: ${title}, ${when}`}
      accessibilityHint="Opens that day's workout"
      onPress={onPress}
      style={[styles.last, tall && styles.lastTall, wrap && styles.lastWrap]}
    >
      <View {...hidden} style={styles.lastTick}>
        <CheckIcon size={14} color={colors.onGold} />
      </View>
      <Text {...LINE_TEXT} numberOfLines={wrap ? 2 : 1} style={styles.lastText}>
        <Text style={styles.lastLead}>Last workout · </Text>
        <Text style={styles.lastName}>{title}</Text>
      </Text>
      <Text {...CAP_BODY} style={styles.lastWhen}>
        {when}
      </Text>
      <View {...hidden}>
        <ChevronRightIcon size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

// "Missed {Weekday} · +N more"; the whole line opens that day's sheet.
export function MissedLine({ weekday, more, onPress, ref }) {
  return (
    <Pressable
      ref={ref}
      testID="workout-missed-line"
      accessibilityRole="button"
      accessibilityLabel={`Missed ${weekday}${more > 0 ? `, ${more} more missed this week` : ''}`}
      accessibilityHint="Opens that day's workout"
      onPress={onPress}
      style={styles.missed}
    >
      <View {...hidden} style={styles.missedDot} />
      <Text {...CAP_BODY} style={styles.missedText}>
        Missed <Text style={styles.missedDay}>{weekday}</Text>
        {more > 0 ? <Text style={styles.missedMore}>{` · +${more} more`}</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    marginTop: -6,
    borderRadius: 20,
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cellDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.hairlineFaint,
  },
  statLabel: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  statValue: {
    ...font(700),
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statValueLarge: {
    fontSize: 26,
    lineHeight: 32,
  },
  last: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    marginTop: -8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
  },
  lastTall: {
    minHeight: 60,
    marginTop: 0,
  },
  lastWrap: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  lastTick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
  },
  lastLead: {
    ...font(400),
    color: colors.textMuted,
  },
  lastName: {
    ...font(600),
    color: colors.textPrimary,
  },
  lastWhen: {
    ...font(400),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  missed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    marginBottom: -10,
  },
  missedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.warning,
  },
  missedText: {
    ...font(400),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  missedDay: {
    ...font(700),
  },
  missedMore: {
    color: colors.textMuted,
  },
});
