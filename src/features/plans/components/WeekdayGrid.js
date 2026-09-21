import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, textStyles } from '../../../shared/theme/tokens';
import { WEEKDAY_OPTIONS, weekdaySummary } from '../planRules';
import { ColorPressable } from './PlanBits';

// 7-column weekday picker shared by S2 and S3 (RN-SPEC-plans §4.6, §5). Chips
// stay tappable while a request is in flight (⚠14).
export function WeekdayGrid({ selected, onToggle, style }) {
  return (
    <View style={[styles.grid, style]}>
      {WEEKDAY_OPTIONS.map((weekday) => {
        const isSelected = selected.includes(weekday.id);
        return (
          <ColorPressable
            key={weekday.id}
            accessibilityRole="button"
            accessibilityLabel={weekday.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onToggle(weekday.id)}
            colorsFor={(pressed) => ({
              backgroundColor: isSelected ? colors.brand400 : pressed ? colors.surfaceMuted : colors.background,
            })}
            style={styles.chip}
          >
            <Text style={[textStyles.weekdayChip, { color: isSelected ? colors.navy : colors.textSecondary }]}>
              {weekday.label}
            </Text>
          </ColorPressable>
        );
      })}
    </View>
  );
}

export function SelectedSummary({ selected }) {
  return <Text style={styles.summary}>{`Selected: ${weekdaySummary(selected) || 'None yet'}`}</Text>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.xl,
    paddingVertical: 12,
  },
  summary: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
