import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, textStyles } from '../../../shared/theme/tokens';
import { ColorPressable, Eyebrow, Pill, StatusBadge } from './PlanBits';

// ActivePlanCard (RN-SPEC-plans §3.4).
export function ActivePlanCard({ plan, weekdays, onGoToWorkout, onViewPlan }) {
  const focus = plan?.category?.name;
  return (
    <View testID="active-plan-card" style={styles.activeCard}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.accentBar} />
      <View style={styles.activeBody}>
        <View style={styles.topRow}>
          <View style={styles.minWidthColumn}>
            <Eyebrow>Active plan</Eyebrow>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[textStyles.title2xl, styles.primary, styles.mt6]}>
              {plan?.name}
            </Text>
            <Text style={[styles.activeMeta, styles.mt4]}>
              {plan?.days_per_week ? `${plan.days_per_week} training days / week` : 'Your active routine'}
              {focus ? ` · ${focus}` : ''}
            </Text>
          </View>
          <StatusBadge label="Active" />
        </View>

        {weekdays.length ? (
          <View style={styles.mt16}>
            <Eyebrow color={colors.textMuted}>Your week</Eyebrow>
            <View style={styles.weekRow}>
              {weekdays.map((weekday) => (
                <Pill key={weekday.id}>{weekday.name}</Pill>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <ColorPressable
            accessibilityRole="link"
            onPress={onGoToWorkout}
            colorsFor={(pressed) => ({ backgroundColor: pressed ? colors.brand500 : colors.brand400 })}
            style={styles.goButton}
          >
            <Text style={styles.goLabel}>Go to workout</Text>
          </ColorPressable>
          {plan?.id ? (
            <ColorPressable
              accessibilityRole="link"
              onPress={onViewPlan}
              colorsFor={(pressed) => ({ backgroundColor: pressed ? colors.surfaceMuted : colors.surface })}
              style={styles.viewButton}
            >
              <Text style={styles.viewLabel}>View plan</Text>
            </ColorPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// PlanCard (§3.6): the whole card is one pressable.
export function PlanCard({ plan, isActive = false, onPress }) {
  return (
    <ColorPressable
      accessibilityRole="link"
      testID={`plan-card-${plan.id}`}
      onPress={onPress}
      colorsFor={(pressed) => ({
        backgroundColor: colors.surface,
        borderColor: pressed ? colors.brand300 : colors.border,
      })}
      style={styles.planCard}
    >
      <View style={styles.topRow}>
        <View style={styles.minWidthColumn}>
          {plan.category?.name ? <Eyebrow>{plan.category.name}</Eyebrow> : null}
          <Text numberOfLines={1} ellipsizeMode="tail" style={[textStyles.titleLg, styles.primary, styles.mt6]}>
            {plan.name}
          </Text>
          <View style={styles.pillRow}>
            {/* JSX renders a missing days_per_week as nothing: " days / week". */}
            <Pill>{`${plan.days_per_week ?? ''} days / week`}</Pill>
          </View>
        </View>
        <View style={styles.cardSide}>
          {isActive ? <StatusBadge label="Active" /> : null}
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
            ›
          </Text>
        </View>
      </View>
      {plan.description ? (
        <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.body, styles.mt12]}>
          {plan.description}
        </Text>
      ) : null}
    </ColorPressable>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.plansSoft,
  },
  accentBar: {
    width: 6,
    flexShrink: 0,
    backgroundColor: colors.brand400,
  },
  activeBody: {
    flex: 1,
    minWidth: 0,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  minWidthColumn: {
    flexShrink: 1,
    minWidth: 0,
  },
  primary: {
    color: colors.textPrimary,
  },
  activeMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  goButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    paddingVertical: 12,
    boxShadow: shadows.plansGlow,
  },
  goLabel: {
    ...textStyles.ctaSmall,
    color: colors.navy,
  },
  viewButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  planCard: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    padding: 20,
    boxShadow: shadows.plansCard,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  cardSide: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 8,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.textMuted,
  },
  body: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
});
