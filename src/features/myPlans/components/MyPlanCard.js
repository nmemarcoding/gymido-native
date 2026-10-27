import { StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, DISPLAY_TITLE_TEXT, TITLE_TEXT } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import StatusPill from '../../../shared/components/StatusPill';
import { colors, font, gradients, radii, spacing, typography } from '../../../shared/theme/tokens';
import { formatDaysPerWeek } from '../../trainer/plans/planFormat';
import { keepUnitsTogether } from '../../../shared/format/counts';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };
// glow-gold-ambient (0.18) as the featured card's 260 circle, top-right.
const FEATURED_GLOW = Object.freeze({ radial: Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }), colors: gradients.accountGlow.colors, stops: Object.freeze([0, 1]) });

// §M1 MyPlanCard, v2 look (UX H My plans, N4: EVERY card is dark, so
// "Create a plan" stays the one gold action): gradient-card, radius 28, the
// gold category + the "Inactive" status pill (⚠M-6: the only sign on M1),
// the name as the card's heading, "{d} days / week", the description (2
// lines) and one glass "Open" (labelled "Open {name}"; the card itself is
// not a second link). `tablet` uses the tablet sizes; `featured` (tablet, the
// first card) is the large card with the ambient glow.
export default function MyPlanCard({ plan, onOpen, tablet = false, featured = false, style }) {
  const big = tablet && featured;
  return (
    <View testID={`my-plan-card-${plan.id}`} style={[styles.card, tablet && styles.cardTablet, big && styles.cardFeatured, style]}>
      <View {...HIDDEN} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GradientFill angle={gradients.card.angle} colors={gradients.card.colors} />
        {big ? (
          <View testID="my-plan-card-glow" style={styles.glow}>
            <GradientFill radial={FEATURED_GLOW.radial} colors={FEATURED_GLOW.colors} stops={FEATURED_GLOW.stops} />
          </View>
        ) : null}
      </View>
      <View style={styles.topRow}>
        <Text {...CAP_BODY} style={[styles.category, big && styles.categoryFeatured]}>
          {plan.category?.name || 'Plan'}
        </Text>
        {plan.is_active === false ? (
          <StatusPill testID={`my-plan-card-inactive-${plan.id}`} label="Inactive" tone="inactive" compact={!tablet} />
        ) : null}
      </View>
      <Text
        {...(big ? DISPLAY_TITLE_TEXT : TITLE_TEXT)}
        accessibilityRole="header"
        style={big ? styles.nameFeatured : tablet ? styles.nameTablet : styles.name}
      >
        {keepUnitsTogether(plan.name)}
      </Text>
      <Text {...CAP_BODY} style={[styles.days, tablet && styles.daysTablet, big && styles.daysFeatured]}>
        {formatDaysPerWeek(plan)}
      </Text>
      {plan.description ? (
        <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={[styles.description, big && styles.descriptionFeatured]}>
          {plan.description}
        </Text>
      ) : null}
      <PillButton
        testID={`my-plan-card-open-${plan.id}`}
        title="Open"
        accessibilityLabel={`Open ${plan.name ?? 'plan'}`}
        variant="secondary"
        size={big ? 'default' : 'compact'}
        onPress={onOpen}
        style={[styles.open, tablet && styles.openTablet]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // radius 28, padding 20 (tablet 24; featured 26), the 0.08 edge → hairline.
  card: {
    overflow: 'hidden',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[5],
  },
  cardTablet: {
    padding: spacing[6],
  },
  cardFeatured: {
    padding: 26,
  },
  glow: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 260,
    height: 260,
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  category: {
    ...font(600),
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  categoryFeatured: {
    fontSize: 14,
    lineHeight: 20,
  },
  // 28/30/700 −0.04em (phone), 26/30/700 −0.035em (tablet), display-lg (featured).
  name: {
    ...font(700),
    marginTop: spacing[3],
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.12,
    color: colors.textPrimary,
  },
  nameTablet: {
    ...font(700),
    marginTop: spacing[3],
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.91,
    color: colors.textPrimary,
  },
  nameFeatured: {
    ...typography.displayLg,
    marginTop: spacing[3],
    color: colors.textPrimary,
  },
  days: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textSecondary,
  },
  daysTablet: {
    ...typography.body,
  },
  daysFeatured: {
    ...typography.bodyLg,
  },
  description: {
    ...typography.bodySm,
    marginTop: spacing['1_5'],
    color: colors.textMuted,
  },
  descriptionFeatured: {
    ...typography.body,
  },
  open: {
    alignSelf: 'flex-start',
    marginTop: spacing[4],
  },
  openTablet: {
    marginTop: spacing['4_5'],
  },
});
