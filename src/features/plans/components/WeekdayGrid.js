import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../../shared/theme/tokens';
import { WEEKDAYS, selectedWeekdaysLabel } from '../libraryFormat';

// The weekday picker of RN-SPEC-plans §4.6, shared with S3 (§5): seven
// chips Mon…Sun and the "Selected: …" line. Every chip is at least 44 pt
// tall (batch 2 #29; was S3 only); `fullNames` spells the Selected line out
// in full (S3).
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
              <Text style={[styles.text, { color: isSelected ? colors.navy : colors.textSecondary }]}>{weekday.label}</Text>
              {/* Design system v1 #14: selected is more than the gold fill. The
                  9px ✓ is the owner-approved exception to the 11px floor. */}
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
    gap: 6,
    marginTop: 16,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingVertical: 12,
    minHeight: 44,
  },
  selected: {
    backgroundColor: colors.brand400,
    // A 2px navy inset ring (no border, so the chip size never changes).
    boxShadow: `inset 0px 0px 0px 2px ${colors.navy}`,
  },
  check: {
    position: 'absolute',
    top: 3,
    right: 5,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '900',
    color: colors.navy,
  },
  idle: {
    backgroundColor: colors.background,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  text: {
    fontSize: 11.52,
    lineHeight: 17.28,
    fontWeight: '700',
  },
  selectedLabel: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
