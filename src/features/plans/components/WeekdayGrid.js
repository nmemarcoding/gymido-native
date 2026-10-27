import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, spacing, typography } from '../../../shared/theme/tokens';
import { WEEKDAYS, selectedWeekdaysLabel } from '../libraryFormat';

// The weekday picker of RN-SPEC-plans §4.6, shared with S3 (§5): seven
// chips Mon…Sun and the "Selected: …" line; `fullNames` spells the Selected
// line out in full (S3). v2 look (RN-SPEC-v2-foundation §4.4): 52 × 52
// cells (narrower on a small phone, never taller), gap 8, radius 16.
export default function WeekdayGrid({ selected, onToggle, testIDPrefix, fullNames = false }) {
  return (
    <>
      <View style={styles.grid}>
        {WEEKDAYS.map((weekday) => {
          const isSelected = selected.includes(weekday.id);
          return (
            <Pressable
              key={weekday.id}
              testID={`${testIDPrefix}-${weekday.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onToggle(weekday.id)}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.selected : pressed ? styles.pressed : styles.idle,
              ]}
            >
              <Text style={[styles.text, isSelected ? styles.textOn : styles.textOff]}>{weekday.label}</Text>
              {/* Selected is more than the gold fill: the ring and an 11/700 ✓
                  (v2 retires v1's 9px exception). */}
              {isSelected ? (
                <Text style={styles.check} accessibilityElementsHidden importantForAccessibility="no">
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.selectedLabel}>{selectedWeekdaysLabel(selected, fullNames)}</Text>
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
});
