import { Pressable, StyleSheet, Text, View } from 'react-native';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import { CAP_BODY, LINE_TEXT, NAME_TITLE_TEXT } from '../../../shared/components/largeText';
import { keepUnitsTogether } from '../../../shared/format/counts';
import { exerciseImageProps, THUMB_WIDTH } from '../../../shared/images/remoteImageSources';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import PlanIcon from './planIcons';
import { PressOverlay } from './planUi';

const PHOTO = 84;

// Dated change (27 Oct 2026, owner T-60; UX T60-plans-spec §4): one PHONE
// catalog card, the whole card one link to Plan detail. The 84 photo = the
// plan thumbnail (its first exercise's image) through the shared chain, else
// the neutral initials tile; the gold category kicker (13/600); the name (2
// lines, never shrinks); "{n} days a week · {level}" (1 line); the full
// description clamped to 2 lines + an ellipsis; a chevron.
export default function PlanCatalogCard({ plan, meta, onPress }) {
  const category = plan.category?.name;
  const label = [plan.name, category, meta, plan.description].filter(Boolean).join(', ');
  return (
    <Pressable
      testID={`plans-card-${plan.id}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} radius={radii.lgPlus} />
          <ExerciseImage
            {...exerciseImageProps(plan, { width: THUMB_WIDTH })}
            testID={`plans-card-photo-${plan.id}`}
            name={plan.name}
            muscleCode={null}
            size={PHOTO}
            style={styles.photo}
          />
          <View style={styles.text}>
            {category ? (
              <Text {...LINE_TEXT} testID={`plans-card-category-${plan.id}`} style={styles.category}>
                {category}
              </Text>
            ) : null}
            <Text {...NAME_TITLE_TEXT} testID={`plans-card-name-${plan.id}`} style={styles.name}>
              {keepUnitsTogether(plan.name)}
            </Text>
            {meta ? (
              <Text {...LINE_TEXT} testID={`plans-card-meta-${plan.id}`} style={styles.meta}>
                {meta}
              </Text>
            ) : null}
            {plan.description ? (
              <Text {...CAP_BODY} testID={`plans-card-description-${plan.id}`} numberOfLines={2} ellipsizeMode="tail" style={styles.description}>
                {plan.description}
              </Text>
            ) : null}
          </View>
          <PlanIcon name="chevronRight" size={18} color={colors.textFaint} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    padding: spacing[3],
    borderRadius: radii.lgPlus,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: {
    borderColor: colors.goldLine,
  },
  photo: {
    borderRadius: radii.md,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  category: {
    ...font(600),
    fontSize: 13,
    lineHeight: 16,
    color: colors.gold,
  },
  // 17/22/600 −0.02em.
  name: {
    ...font(600),
    marginTop: spacing['0_5'],
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.34,
    color: colors.textPrimary,
  },
  meta: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  description: {
    ...font(400),
    marginTop: spacing['0_5'],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textFaint,
  },
});
