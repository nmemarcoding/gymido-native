import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, CAP_PILL, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { colors, font, radii, spacing, typography } from '../../../shared/theme/tokens';
import { openShellPath } from '../../shell/shellLinks';
import { activePlanDaysLabel, activePlanSubline, trainingDaysLabel } from '../libraryFormat';
import { OnGoldButton, useIsTablet, useReflow } from './planUi';
import { keepUnitsTogether } from '../../../shared/format/counts';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

// UX H Plans / Tablet: Plans: the active plan = the FLAT gold card as drawn
// (N4; the canvas gradient is retired), dark text, a decorative ink ring,
// the week (phone chips; tablet a 7-day grid with the day titles) and the
// T-35 on-gold pair. `chips` = weekChips(schedule) (empty → no week block).
export default function ActivePlanCard({ plan, chips, onView }) {
  const tablet = useIsTablet();
  const reflow = useReflow();
  const category = plan?.category?.name;

  return (
    <View testID="plans-active-card" style={[styles.card, tablet && styles.cardTablet]}>
      <View {...HIDDEN} testID="plans-active-ring" style={tablet ? styles.ringTablet : styles.ring} />
      <View style={[styles.topRow, reflow && styles.topRowStacked]}>
        <View testID="plans-active-badge" style={[styles.badge, tablet && styles.badgeTablet]}>
          <View {...HIDDEN} style={styles.badgeDot} />
          <Text {...CAP_PILL} style={[styles.badgeText, tablet && styles.badgeTextTablet]}>
            Active plan
          </Text>
        </View>
        {tablet ? (
          activePlanSubline(plan) ? (
            <Text {...CAP_BODY} style={styles.sublineTablet}>
              {activePlanSubline(plan)}
            </Text>
          ) : null
        ) : category ? (
          <Text {...CAP_BODY} style={styles.category}>
            {category}
          </Text>
        ) : null}
      </View>
      <Text {...DISPLAY_TITLE_TEXT} accessibilityRole="header" style={tablet ? styles.nameTablet : styles.name}>
        {keepUnitsTogether(plan?.name)}
      </Text>
      {tablet ? null : (
        <Text {...CAP_BODY} style={styles.days}>
          {activePlanDaysLabel(plan)}
        </Text>
      )}
      {chips.length ? (
        tablet && !reflow ? (
          <View testID="plans-week-grid" accessible accessibilityLabel={trainingDaysLabel(chips)} style={styles.weekGrid}>
            {chips.map((chip) => (
              <View key={chip.id} testID={`plans-week-cell-${chip.id}`} style={[styles.cell, chip.training ? styles.cellOn : styles.cellOff]}>
                <Text style={chip.training ? styles.cellDayOn : styles.cellDayOff}>{chip.label}</Text>
                {chip.training && chip.title ? (
                  <Text numberOfLines={1} style={styles.cellTitle}>
                    {chip.title}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <>
            <Text {...CAP_BODY} style={styles.weekLabel}>
              Your week
            </Text>
            <View testID="plans-week-chips" accessible accessibilityLabel={trainingDaysLabel(chips)} style={styles.chips}>
              {chips.map((chip) => (
                <View key={chip.id} testID={`plans-week-chip-${chip.id}`} style={[styles.chip, chip.training ? styles.chipOn : styles.chipOff]}>
                  <Text {...CAP_PILL} style={chip.training ? styles.chipTextOn : styles.chipTextOff}>
                    {chip.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )
      ) : null}
      <View testID="plans-active-actions" style={[styles.actions, tablet && styles.actionsTablet, reflow && styles.actionsStacked]}>
        <OnGoldButton
          testID="plans-go-to-workout"
          title="Go to workout"
          tone="dark"
          large={tablet}
          grow={!tablet && !reflow}
          fullWidth={reflow}
          onPress={() => openShellPath('/workout')}
        />
        {plan?.id ? (
          <OnGoldButton testID="plans-view-active" title="View plan" tone="ink" large={tablet} fullWidth={reflow} onPress={() => onView(plan.id)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    backgroundColor: colors.gold,
    padding: spacing['5_5'],
  },
  cardTablet: {
    borderRadius: radii.xxxl,
    padding: spacing[8],
  },
  // 220 ring, 28 border at ink 0.08, right −40 bottom −70 (decorative).
  ring: {
    position: 'absolute',
    right: -40,
    bottom: -70,
    width: 220,
    height: 220,
    borderRadius: radii.full,
    borderWidth: 28,
    borderColor: colors.inkFaint,
  },
  ringTablet: {
    position: 'absolute',
    right: -50,
    bottom: -110,
    width: 340,
    height: 340,
    borderRadius: radii.full,
    borderWidth: 40,
    borderColor: colors.inkFaint,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  topRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  badge: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.full,
    backgroundColor: colors.inkTint,
  },
  badgeTablet: {
    minHeight: 30,
    paddingHorizontal: spacing[3],
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.onGold,
  },
  badgeText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.onGold,
  },
  badgeTextTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  category: {
    ...typography.label,
    flexShrink: 1,
    textAlign: 'right',
    color: colors.onGoldMuted,
  },
  sublineTablet: {
    ...font(500),
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onGoldMuted,
  },
  // 34/36/700 −0.04em.
  name: {
    ...font(700),
    marginTop: spacing['5_5'],
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.36,
    color: colors.onGold,
  },
  nameTablet: {
    ...typography.displayXl,
    marginTop: spacing[8],
    color: colors.onGold,
  },
  days: {
    ...typography.body,
    marginTop: spacing[2],
    color: colors.onGoldMuted,
  },
  weekLabel: {
    ...font(600),
    marginTop: spacing['3_5'],
    marginBottom: spacing['1_5'],
    fontSize: 12,
    lineHeight: 16,
    color: colors.onGoldMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['1_5'],
  },
  // 30 tall, pad 0 10, 13 px (the drawn radius 10 has no token: sm 12).
  chip: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing['2_5'],
    borderRadius: radii.sm,
  },
  chipOn: {
    backgroundColor: colors.ground,
  },
  chipOff: {
    backgroundColor: colors.inkTint,
  },
  chipTextOn: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  chipTextOff: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.onGold,
  },
  weekGrid: {
    flexDirection: 'row',
    gap: spacing[2],
    maxWidth: 560,
    marginTop: spacing[6],
  },
  cell: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
    borderRadius: radii.md,
  },
  cellOn: {
    backgroundColor: colors.ground,
  },
  cellOff: {
    backgroundColor: colors.inkTint,
  },
  cellDayOn: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  cellDayOff: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.onGold,
  },
  cellTitle: {
    ...font(500),
    fontSize: 11,
    lineHeight: 14,
    color: colors.textStrong2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[5],
  },
  actionsTablet: {
    gap: spacing['2_5'],
    marginTop: spacing[7],
  },
  actionsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
});
