import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardHeroFill } from '../../../../shared/components/Card';
import { CAP_BODY } from '../../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { formatDayTitle, formatExerciseCount } from '../planFormat';
import { TextAction } from './builderParts';

// T3a (spec §A5.4.1) with the Part B day buttons (§B6): the TABLET days
// column (phone: DayTabs). v2 look (UX phase4 I §2, phase6 O tablet):
// member = the gradient days card with "Plan days" / "Structure"; trainer =
// the panel with the "Plan days" label. Each day: the title block selects
// it (gold tint + inset gold ring when selected), "{n} exercises" stays (code),
// the "#n" pill is dropped as drawn, Edit / Delete sit in the day's footer.
// `footer` is the "Add a day" control (inside the panel on the trainer).
export default function DayListCard({ days, selectedDayId, onSelect, capabilities, onEditDay, onDeleteDay, look = 'member', footer = null }) {
  const trainer = look === 'trainer';
  return (
    <View style={styles.column}>
      <View testID="plan-days-card" style={[styles.card, trainer && styles.cardTrainer]}>
        <CardHeroFill />
        {trainer ? (
          <Text {...CAP_BODY} style={styles.label}>
            Plan days
          </Text>
        ) : (
          <View style={styles.header}>
            <Text {...CAP_BODY} style={styles.kicker}>
              Plan days
            </Text>
            <Text {...CAP_BODY} accessibilityRole="header" style={styles.heading}>
              Structure
            </Text>
          </View>
        )}
        <View testID="plan-days-list" accessibilityRole="list" style={trainer ? styles.listTrainer : styles.list}>
          {days.length === 0 ? (
            <Text {...CAP_BODY} style={styles.empty}>
              No days yet. Add the first training day to start building the plan.
            </Text>
          ) : (
            days.map((day) => (
              <DayItem
                key={day.id}
                day={day}
                trainer={trainer}
                selected={day.id === selectedDayId}
                capabilities={capabilities}
                onSelect={() => onSelect(day.id)}
                onEditDay={onEditDay}
                onDeleteDay={onDeleteDay}
              />
            ))
          )}
        </View>
        {trainer ? footer : null}
      </View>
      {trainer ? null : footer}
    </View>
  );
}

// One day: only the title block selects it; the footer (Part B buttons)
// sits outside that button, as on the web.
function DayItem({ day, trainer, selected, capabilities, onSelect, onEditDay, onDeleteDay }) {
  return (
    <View style={[styles.day, trainer && styles.dayTrainer, selected ? styles.daySelected : trainer ? styles.dayIdleTrainer : styles.dayIdle]}>
      <Pressable
        testID={`plan-day-${day.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.dayButton}
      >
        {({ pressed }) => (
          <>
            {pressed && !selected ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
            <Text {...CAP_BODY} style={styles.dayTitle}>
              {formatDayTitle(day)}
            </Text>
            {day.description ? (
              <Text {...CAP_BODY} style={styles.dayDescription}>
                {day.description}
              </Text>
            ) : null}
            {/* C7: the count never breaks across lines. */}
            <Text {...CAP_BODY} numberOfLines={1} style={[styles.count, selected && styles.countSelected]}>
              {formatExerciseCount(day)}
            </Text>
          </>
        )}
      </Pressable>
      {capabilities.editDay || capabilities.deleteDay ? (
        <View style={styles.footer}>
          {capabilities.editDay ? <TextAction testID={`plan-day-edit-${day.id}`} label="Edit" onPress={() => onEditDay(day)} /> : null}
          {capabilities.deleteDay ? (
            <TextAction
              testID={`plan-day-delete-${day.id}`}
              label="Delete"
              tone="danger"
              accessibilityLabel={`Delete day ${day.day_number}`}
              onPress={() => onDeleteDay(day)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing[3],
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    overflow: 'hidden',
  },
  cardTrainer: {
    padding: spacing[3],
    gap: spacing['1_5'],
  },
  header: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  kicker: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.gold,
  },
  heading: {
    ...font(700),
    marginTop: spacing[1],
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  label: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  list: {
    padding: spacing[2],
    gap: spacing['1_5'],
  },
  listTrainer: {
    gap: spacing['1_5'],
  },
  empty: {
    ...font(400),
    padding: spacing[3],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  day: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  dayTrainer: {
    minHeight: 56,
  },
  daySelected: {
    backgroundColor: colors.goldTint,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  dayIdle: {
    backgroundColor: colors.fillWell,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayIdleTrainer: {
    backgroundColor: colors.fillChip,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayButton: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing['3_5'],
    gap: spacing['0_5'],
  },
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  dayTitle: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  dayDescription: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  count: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  countSelected: {
    color: colors.gold,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    paddingHorizontal: spacing['3_5'],
    paddingBottom: spacing['1_5'],
  },
});
