import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PillButton from '../../../../shared/components/PillButton';
import { colors, radii, shadows } from '../../../../shared/theme/tokens';
import { formatDayTitle, formatExerciseCount } from '../planFormat';

// T3a (spec §A5.4.1), with the Part B day buttons (§B6).
export default function DayListCard({ days, selectedDayId, onSelect, capabilities, onEditDay, onDeleteDay }) {
  return (
    <View testID="plan-days-card" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Plan days</Text>
        <Text style={styles.heading}>Structure</Text>
      </View>
      <View style={styles.body}>
        {days.length === 0 ? (
          <Text style={styles.empty}>No days yet. Add the first training day to start building the plan.</Text>
        ) : (
          days.map((day) => {
            return (
              <DayArticle
                key={day.id}
                day={day}
                selected={day.id === selectedDayId}
                onSelect={() => onSelect(day.id)}
              >
                <View style={styles.footer}>
                  <Text numberOfLines={1} style={styles.footerText}>
                    {formatExerciseCount(day)}
                  </Text>
                  {capabilities.editDay || capabilities.deleteDay ? (
                    <View style={styles.dayButtons}>
                      {capabilities.editDay ? (
                        <PillButton
                          testID={`plan-day-edit-${day.id}`}
                          title="Edit"
                          variant="secondary"
                          size="small"
                          onPress={() => onEditDay(day)}
                        />
                      ) : null}
                      {capabilities.deleteDay ? (
                        <PillButton
                          testID={`plan-day-delete-${day.id}`}
                          title="Delete"
                          variant="danger"
                          size="small"
                          accessibilityLabel={`Delete day ${day.day_number}`}
                          onPress={() => onDeleteDay(day)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </DayArticle>
            );
          })
        )}
      </View>
    </View>
  );
}

// One day: only the title row selects it; the footer (count + Part B
// buttons) sits outside that button, as on the web.
function DayArticle({ day, selected, onSelect, children }) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={[styles.day, selected ? styles.daySelected : styles.dayIdle, !selected && pressed && styles.dayPressed]}>
      <Pressable
        testID={`plan-day-${day.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onSelect}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <View style={styles.dayRow}>
          <View style={styles.dayText}>
            <Text style={styles.dayTitle}>{formatDayTitle(day)}</Text>
            {day.description ? <Text style={styles.dayDescription}>{day.description}</Text> : null}
          </View>
          <Text style={styles.pill}>#{day.day_number}</Text>
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kicker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  heading: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    padding: 16,
    gap: 12,
  },
  empty: {
    borderRadius: radii.xxl,
    backgroundColor: colors.background,
    paddingVertical: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  day: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    padding: 16,
  },
  daySelected: {
    borderColor: colors.brand400,
    backgroundColor: colors.brand50,
  },
  dayIdle: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dayPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayText: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 12,
    overflow: 'hidden',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  // C7: wraps at narrow widths; the buttons never shrink and the count
  // stays on one line.
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayButtons: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
