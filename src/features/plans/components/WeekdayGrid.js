import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, TOKEN_TEXT } from '../../../shared/components/largeText';
import { colors, font, radii, spacing, textScale, typography } from '../../../shared/theme/tokens';
import { WEEKDAYS, selectedWeekdaysLabel } from '../libraryFormat';

// The weekday picker of RN-SPEC-plans §4.6, shared with S3 (§5): seven
// chips Mon…Sun and the "Selected: …" line; `fullNames` spells the Selected
// line out in full (S3). v2 look (RN-SPEC-v2-foundation §4.4): 52 × 52
// cells (narrower on a small phone, never taller), gap 8, radius 16.
// `variant="detail"` = the Plan detail ScheduleCard chips (UX H): 7 equal
// columns, gap 6, 48 tall, 14/600, unselected fill-glass + text-strong-2,
// the ✓ at 10/700, "Selected: …" 13 muted; a chip narrower than 44 extends
// its hit area into the gap.
const DETAIL_SLOP = Object.freeze({ top: 0, bottom: 0, left: 3, right: 3 });

export default function WeekdayGrid({ selected, onToggle, testIDPrefix, fullNames = false, variant = 'default' }) {
  const detail = variant === 'detail';
  return (
    <>
      <View testID={`${testIDPrefix}-grid`} style={[styles.grid, detail && styles.gridDetail]}>
        {WEEKDAYS.map((weekday) => {
          const isSelected = selected.includes(weekday.id);
          return (
            <Pressable
              key={weekday.id}
              testID={`${testIDPrefix}-${weekday.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onToggle(weekday.id)}
              hitSlop={detail ? DETAIL_SLOP : undefined}
              style={({ pressed }) => [
                styles.chip,
                detail && styles.chipDetail,
                isSelected ? styles.selected : pressed ? styles.pressed : detail ? styles.idleDetail : styles.idle,
              ]}
            >
              {/* Ruling 5 (UX native final audit 27 Oct 2026, B208): the
                  label never breaks inside the word ("Mo/n"); in a narrow
                  card it shrinks to the chip. The cap stays as it was. */}
              <Text
                {...TOKEN_TEXT}
                maxFontSizeMultiplier={detail ? textScale.pill : undefined}
                style={[styles.text, detail && styles.textDetail, isSelected ? styles.textOn : detail ? styles.textOffDetail : styles.textOff]}
              >
                {weekday.label}
              </Text>
              {/* Selected is more than the gold fill: the ring and an 11/700 ✓
                  (v2 retires v1's 9px exception). */}
              {isSelected ? (
                <Text {...CAP_BODY} style={[styles.check, detail && styles.checkDetail]} accessibilityElementsHidden importantForAccessibility="no">
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text {...CAP_BODY} style={[styles.selectedLabel, detail && styles.selectedLabelDetail]}>{selectedWeekdaysLabel(selected, fullNames)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  chip: {
    flex: 1,
    maxWidth: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    // Always 1 px so the chip keeps its size when it turns on.
    borderWidth: 1,
  },
  // Gold + ring-selected (a 2 px ground inset, a 1 px gold outer ring): the
  // 1 px border in ground + a 1 px ground inset make the 2 px inner ring.
  selected: {
    backgroundColor: colors.gold,
    borderColor: colors.ground,
    boxShadow: `inset 0px 0px 0px 1px ${colors.ground}, 0px 0px 0px 1px ${colors.gold}`,
  },
  check: {
    ...font(700),
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 11,
    lineHeight: 12,
    color: colors.onGold,
  },
  idle: {
    backgroundColor: colors.fillChip,
    borderColor: colors.hairlineStrong,
  },
  pressed: {
    backgroundColor: colors.fillButton,
    borderColor: colors.hairlineStrong,
  },
  text: {
    fontSize: 13,
    lineHeight: 16,
  },
  textOn: {
    ...font(600),
    color: colors.onGold,
  },
  textOff: {
    ...font(500),
    color: colors.textSecondary,
  },
  selectedLabel: {
    ...typography.caption,
    marginTop: spacing[3],
    color: colors.textMuted,
  },
  // v2 detail variant (UX H Plan detail ScheduleCard).
  gridDetail: {
    gap: spacing['1_5'],
  },
  // 48 tall (the drawn radius 14 folds into 16, §3); no 52 cap: 7 equal columns.
  chipDetail: {
    maxWidth: undefined,
    minHeight: 48,
  },
  idleDetail: {
    backgroundColor: colors.fillGlass,
    borderColor: colors.hairlineStrong,
  },
  textDetail: {
    fontSize: 14,
    lineHeight: 18,
  },
  textOffDetail: {
    ...font(600),
    color: colors.textStrong2,
  },
  checkDetail: {
    top: 3,
    fontSize: 10,
    lineHeight: 12,
  },
  selectedLabelDetail: {
    ...typography.label,
    ...font(400),
    color: colors.textMuted,
  },
});
