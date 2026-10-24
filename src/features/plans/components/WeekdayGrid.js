import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../../shared/theme/tokens';
import { WEEKDAYS, selectedWeekdaysLabel } from '../libraryFormat';

// The weekday picker of RN-SPEC-plans §4.6, shared with S3 (§5): seven
// chips Mon…Sun and the "Selected: …" line. `touchHeight` adds A3's 44 pt
// minimum where a spec asks for it (S3); `fullNames` spells the Selected line
// out in full (S3).
export default function WeekdayGrid({ selected, onToggle, testIDPrefix, touchHeight = false, fullNames = false }) {
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
                touchHeight && styles.touch,
                isSelected ? styles.selected : pressed ? styles.pressed : styles.idle,
              ]}
            >
              <Text style={[styles.text, { color: isSelected ? colors.navy : colors.textSecondary }]}>{weekday.label}</Text>
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
    borderRadius: radii.xl,
    paddingVertical: 12,
  },
  touch: {
    minHeight: 44,
  },
  selected: {
    backgroundColor: colors.brand400,
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
