import { StyleSheet, Text, View } from 'react-native';

import PillButton from '../../../../shared/components/PillButton';
import { colors, radii, shadows } from '../../../../shared/theme/tokens';
import { formatDaysPerWeek } from '../planFormat';

// Spec §A4.3. The card itself isn't pressable; only its buttons are. In
// assign mode (`onAssign` set) a primary "Assign" follows "View".
export default function PlanCard({ plan, onView, onAssign, assignLoading = false, style }) {
  return (
    <View testID={`plan-card-${plan.id}`} style={[styles.card, style]}>
      <Text style={styles.eyebrow}>{plan.category?.name || 'Plan'}</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
        {plan.name}
      </Text>
      <Text style={styles.meta}>{formatDaysPerWeek(plan)}</Text>
      {plan.description ? (
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.description}>
          {plan.description}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PillButton testID={`plan-card-view-${plan.id}`} title="View" variant="secondary" onPress={onView} />
        {onAssign ? (
          <PillButton testID={`plan-card-assign-${plan.id}`} title="Assign" loading={assignLoading} onPress={onAssign} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
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
