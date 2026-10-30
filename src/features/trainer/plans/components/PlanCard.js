import { Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../../../shared/components/GradientFill';
import { CAP_BODY, LINE_TEXT, NAME_TITLE_TEXT } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { colors, font, gradients, radii, spacing, typography } from '../../../../shared/theme/tokens';
import { planCategoryLabel } from '../planCategoryColor';
import { formatDaysPerWeek } from '../planFormat';
import { CategoryChip, PrivateChip } from './TrainerChips';
import { keepUnitsTogether } from '../../../../shared/format/counts';

// Spec §A4.3 + v2 Phase 6 O (TrainerPlans / TabletTrainerPlans). UX ruling 1:
// every card is the same dark gradient-card (no featured gold card). T-121
// H1: the whole card opens the plan (View stays the visible cue and the one
// screen-reader control, so the card itself isn't an a11y element); Assign
// stays its own button. `privateChip`: "Private" before the category chip
// ("Your plans"). In assign mode
// (`onAssign` set) "Assign" follows "View" as the gold-TINT secondary
// (ruling 4). `tablet`: the 2-col tablet card (radius 28, padding 22, min 200,
// name 28/30); otherwise the phone grid card (radius 24, padding 16, name
// 16/21). `stacked` (text > 1.3×, UX §9): View + Assign stack full width.
export default function PlanCard({ plan, onView, onAssign, assignLoading = false, tablet = false, stacked = false, privateChip = false, style }) {
  const name = keepUnitsTogether(plan.name);
  const buttonStyle = stacked ? styles.buttonStacked : null;
  return (
    <Pressable
      testID={`plan-card-${plan.id}`}
      accessible={false}
      onPress={onView}
      style={[styles.card, tablet ? styles.cardTablet : styles.cardPhone, style]}
    >
      <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
      <View style={styles.chips}>
        {privateChip ? <PrivateChip testID={`plan-card-private-${plan.id}`} size={tablet ? 'tablet' : 'phone'} /> : null}
        <CategoryChip testID={`plan-card-category-${plan.id}`} label={planCategoryLabel(plan)} size={tablet ? 'tablet' : 'phone'} />
      </View>
      {/* The plan name is each card's heading (UX a11y: h2 per card). */}
      <Text {...NAME_TITLE_TEXT} accessibilityRole="header" style={[styles.name, tablet ? styles.nameTablet : styles.namePhone]}>
        {name}
      </Text>
      <Text {...LINE_TEXT} style={[styles.meta, tablet && styles.metaTablet]}>
        {formatDaysPerWeek(plan)}
      </Text>
      {plan.description ? (
        // Code-kept (UX O): the description, at most 2 lines.
        <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={[styles.description, tablet && styles.descriptionTablet]}>
          {plan.description}
        </Text>
      ) : null}
      <View style={styles.spacer} />
      <View testID={`plan-card-actions-${plan.id}`} style={[styles.actions, stacked && styles.actionsStacked]}>
        <PillButton
          testID={`plan-card-view-${plan.id}`}
          title="View"
          accessibilityLabel={`View ${name}`}
          variant="secondary"
          size="compact"
          onPress={onView}
          style={buttonStyle}
        />
        {onAssign ? (
          <PillButton
            testID={`plan-card-assign-${plan.id}`}
            title="Assign"
            accessibilityLabel={`Assign ${name}`}
            // UX O ruling 4: gold text on the 14 % gold tint, goldLine edge.
            variant="goldTint"
            size="compact"
            loading={assignLoading}
            onPress={onAssign}
            style={buttonStyle}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The radius never changes, so clipping the gradient is safe here.
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.choiceBorder,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['1_5'],
  },
  cardPhone: {
    borderRadius: radii.xl,
    padding: spacing[4],
  },
  cardTablet: {
    borderRadius: radii.xxl,
    padding: spacing['5_5'],
    minHeight: 200,
  },
  name: {
    color: colors.textPrimary,
  },
  // 16/21/600 −0.02em (TrainerPlans compact card).
  namePhone: {
    ...font(600),
    marginTop: spacing[3],
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.32,
  },
  // 28/30/700 −0.04em (TabletTrainerPlans).
  nameTablet: {
    ...font(700),
    marginTop: spacing[4],
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.12,
  },
  meta: {
    ...typography.label,
    ...font(400),
    marginTop: spacing[1],
    color: colors.textMuted,
  },
  metaTablet: {
    ...typography.bodySm,
    marginTop: spacing['1_5'],
  },
  description: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.textSecondary,
  },
  descriptionTablet: {
    fontSize: 13,
    lineHeight: 19,
  },
  // Buttons sit at the bottom of a card stretched by its row (mt auto).
  spacer: {
    flexGrow: 1,
  },
  actions: {
    marginTop: spacing[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2_5'],
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  buttonStacked: {
    alignSelf: 'stretch',
  },
});
