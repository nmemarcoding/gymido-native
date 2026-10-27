import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, CAP_PILL } from '../../../shared/components/largeText';
import { colors, font, radii, spacing, typography } from '../../../shared/theme/tokens';
import { planCardDaysLabel } from '../libraryFormat';
import { PressOverlay } from './planUi';
import { keepUnitsTogether } from '../../../shared/format/counts';

// UX H Plans (phone) / Tablet: Plans: one catalog plan, the whole card one
// link (§3.6) whose label is all of its text. Phone: radius 24, padding 16,
// the days pill, gold category, a 17/22 name (2 lines) and a 12/17 muted
// description (2 lines). Tablet: radius 28, padding 22, gap 36, a 24/28 name,
// the category as a 14 muted subline and a 14 muted description.
export default function PlanTile({ plan, onPress, tablet = false, style }) {
  const days = planCardDaysLabel(plan);
  const name = keepUnitsTogether(plan.name);
  const category = plan.category?.name;
  const label = [plan.name, category, days, plan.description].filter(Boolean).join(', ');
  return (
    <Pressable
      testID={`plans-card-${plan.id}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, tablet && styles.cardTablet, pressed && styles.pressed, style]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={tablet ? radii.xxl : radii.xl} />
          <View style={[styles.pill, tablet && styles.pillTablet]}>
            <Text {...CAP_PILL} style={[styles.pillText, tablet && styles.pillTextTablet]}>
              {days}
            </Text>
          </View>
          {tablet ? (
            <View>
              <Text numberOfLines={2} ellipsizeMode="tail" textBreakStrategy="simple" maxFontSizeMultiplier={1.6} style={styles.nameTablet}>
                {name}
              </Text>
              {category ? (
                <Text {...CAP_BODY} style={styles.sublineTablet}>
                  {category}
                </Text>
              ) : null}
              {plan.description ? (
                <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={styles.descriptionTablet}>
                  {plan.description}
                </Text>
              ) : null}
            </View>
          ) : (
            <View>
              {category ? (
                <Text {...CAP_BODY} style={styles.category}>
                  {category}
                </Text>
              ) : null}
              <Text numberOfLines={2} ellipsizeMode="tail" textBreakStrategy="simple" maxFontSizeMultiplier={1.6} style={styles.name}>
                {name}
              </Text>
              {plan.description ? (
                <Text {...CAP_BODY} numberOfLines={2} ellipsizeMode="tail" style={styles.description}>
                  {plan.description}
                </Text>
              ) : null}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['4_5'],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardTablet: {
    gap: 36,
    padding: spacing['5_5'],
    borderRadius: radii.xxl,
  },
  pressed: {
    borderColor: colors.goldLine,
  },
  // 24 tall, pad 0 9, fill 0.07, 12 px secondary.
  pill: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: radii.full,
    backgroundColor: colors.fillSkeleton,
  },
  pillTablet: {
    minHeight: 28,
    paddingHorizontal: spacing[3],
  },
  pillText: {
    ...font(400),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  pillTextTablet: {
    fontSize: 13,
    lineHeight: 18,
  },
  category: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
    color: colors.gold,
  },
  // 17/22/600 −0.02em (between title-xs and body-lg, as drawn).
  name: {
    ...font(600),
    marginTop: spacing[1],
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.34,
    color: colors.textPrimary,
  },
  description: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  nameTablet: {
    ...typography.titleMd,
    color: colors.textPrimary,
  },
  sublineTablet: {
    ...typography.bodySm,
    marginTop: spacing[1],
    color: colors.textMuted,
  },
  descriptionTablet: {
    ...typography.bodySm,
    marginTop: spacing[2],
    color: colors.textMuted,
  },
});
