import { StyleSheet, Text, View } from 'react-native';

import PillButton from '../../../shared/components/PillButton';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { formatDaysPerWeek } from '../../trainer/plans/planFormat';

// §M1 MyPlanCard: TRAINER-PLANS §A4.3 PlanCard with an "Inactive" pill beside
// the eyebrow (⚠M-6: the only sign on M1) and a single "Open" action.
export default function MyPlanCard({ plan, onOpen, style }) {
  return (
    <View testID={`my-plan-card-${plan.id}`} style={[styles.card, style]}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{plan.category?.name || 'Plan'}</Text>
        {plan.is_active === false ? (
          <Text testID={`my-plan-card-inactive-${plan.id}`} style={styles.pill}>
            Inactive
          </Text>
        ) : null}
      </View>
      <Text textBreakStrategy="simple" numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
        {plan.name}
      </Text>
      <Text style={styles.meta}>{formatDaysPerWeek(plan)}</Text>
      {plan.description ? (
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.description}>
          {plan.description}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PillButton testID={`my-plan-card-open-${plan.id}`} title="Open" variant="secondary" onPress={onOpen} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    flexShrink: 1,
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  pill: {
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  title: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
