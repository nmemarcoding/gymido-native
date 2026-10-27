import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../../shared/components/largeText';
import { colors, font, layout, radii, shadows, spacing } from '../../../../shared/theme/tokens';
import { formatDayTitle } from '../planFormat';
import { TextAction, slopFor } from './builderParts';
import { PlusIcon } from './pickerIcons';

// The PHONE days control (UX phase4 I §1, phase6 O phone): a tablist
// "Plan days" of pills controlling one panel (the selected day). Member:
// 40 tall, the selected pill light (text-primary + on-light), "Add a day" a
// 40 dashed circle at the end. Trainer: the "Plan days" label, 48-tall pills,
// the selected one gold, and a full-width dashed "Add a day" below.
export default function DayTabs({ days, selectedDayId, onSelect, look = 'member', canAddDay = false, onAddDay }) {
  const trainer = look === 'trainer';
  const addDay = canAddDay ? (
    <Pressable
      testID="plan-add-day"
      accessibilityRole="button"
      accessibilityLabel="Add a day"
      onPress={onAddDay}
      hitSlop={trainer ? undefined : 2}
      style={trainer ? styles.addWide : styles.addCircle}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          <PlusIcon color={colors.textPrimary} size={16} />
          {trainer ? (
            <Text {...CAP_BODY} style={styles.addLabel}>
              Add a day
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  ) : null;

  return (
    <View style={styles.section}>
      {trainer ? (
        <Text {...CAP_BODY} style={styles.label}>
          Plan days
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="plan-day-tabs"
        accessibilityRole="tablist"
        accessibilityLabel="Plan days"
        contentContainerStyle={styles.tabs}
      >
        {days.map((day) => {
          const selected = day.id === selectedDayId;
          return (
            <Pressable
              key={day.id}
              testID={`plan-day-${day.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onSelect(day.id)}
              hitSlop={trainer ? undefined : slopFor(40)}
              style={[
                styles.tab,
                trainer && styles.tabTrainer,
                selected ? (trainer ? styles.tabOnTrainer : styles.tabOn) : trainer ? styles.tabOffTrainer : styles.tabOff,
              ]}
            >
              {({ pressed }) => (
                <>
                  {pressed && !selected ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
                  <Text
                    {...CAP_BODY}
                    style={[
                      styles.tabLabel,
                      selected ? (trainer ? styles.tabLabelOnTrainer : styles.tabLabelOn) : styles.tabLabelOff,
                    ]}
                  >
                    {formatDayTitle(day)}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
        {trainer ? null : addDay}
      </ScrollView>
      {trainer ? addDay : null}
    </View>
  );
}

// The selected day's strip under the tabs (UX phase4 I Behaviour 1): its
// description, then "Edit" / "Delete" for that day (the code's day buttons).
export function SelectedDayStrip({ day, capabilities, onEditDay, onDeleteDay }) {
  if (!day) {
    return null;
  }
  const hasButtons = capabilities.editDay || capabilities.deleteDay;
  if (!day.description && !hasButtons) {
    return null;
  }
  return (
    <View testID="plan-day-strip" style={styles.strip}>
      {day.description ? (
        <Text {...CAP_BODY} style={styles.stripText}>
          {day.description}
        </Text>
      ) : null}
      {hasButtons ? (
        <View style={styles.stripButtons}>
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
  section: {
    gap: spacing[2],
    marginTop: spacing[1],
  },
  label: {
    ...font(600),
    marginHorizontal: spacing[1],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  tab: {
    minHeight: 40,
    paddingHorizontal: spacing['3_5'],
    borderRadius: radii.full,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabTrainer: {
    minHeight: 48,
    paddingHorizontal: spacing['4_5'],
  },
  tabOn: {
    backgroundColor: colors.textPrimary,
  },
  tabOff: {
    backgroundColor: colors.fillChip,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  tabOnTrainer: {
    backgroundColor: colors.gold,
    boxShadow: shadows.goldGlow,
  },
  tabOffTrainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  tabLabelOn: {
    ...font(600),
    color: colors.onLight,
  },
  tabLabelOnTrainer: {
    ...font(700),
    color: colors.onGold,
  },
  tabLabelOff: {
    ...font(500),
    color: colors.textStrong2,
  },
  // UX draws the dashed edge at white 22 % (no token): hairlineBright 18 %.
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineBright,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addWide: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hairlineBright,
    overflow: 'hidden',
  },
  addLabel: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing[3],
    paddingHorizontal: spacing[1],
    minHeight: layout.touchMin,
  },
  stripText: {
    ...font(400),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  stripButtons: {
    flexDirection: 'row',
    gap: spacing[4],
    marginLeft: 'auto',
  },
});
