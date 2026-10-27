import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CAP_PILL } from '../../../../shared/components/largeText';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { CATEGORY_FILL_ALPHA, categoryColor } from '../planCategoryColor';

// Phase 6 O §0.2: the teal trainer eyebrow chip ("Coaching", "Builder"):
// 28 tall, padding 0 12, pill, 13/600 teal on teal 14 %, a 6 px dot. Teal is
// the trainer accent as drawn (UX O "Open"). Decorative chrome around a text
// label: capped like a pill; it grows (minHeight) instead of clipping.
export const COACHING_CHIP_HEIGHT = 28;

export function CoachingChip({ label = 'Coaching', testID = 'coaching-chip', style }) {
  return (
    <View testID={testID} style={[styles.coaching, style]}>
      <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" />
      <Text {...CAP_PILL} style={styles.coachingText}>
        {label}
      </Text>
    </View>
  );
}

// UX O ruling 3: the plan card's category chip, the deterministic colour per
// category NAME at 14 % (an opacity layer, so no colour literal) with the
// colour as the text. `size` "tablet" = 26 tall 12/700 (TabletTrainerPlans);
// phone = 24 tall 12/600 (TrainerPlans pill).
export function CategoryChip({ label, size = 'phone', testID }) {
  const color = categoryColor(label);
  const tablet = size === 'tablet';
  return (
    <View testID={testID} style={[styles.category, tablet ? styles.categoryTablet : styles.categoryPhone]}>
      <View
        testID={testID ? `${testID}-fill` : undefined}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: CATEGORY_FILL_ALPHA }]}
      />
      <Text {...CAP_PILL} style={[tablet ? styles.categoryTextTablet : styles.categoryText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

// The "+" of "Create a plan" (boards: a 2-stroke plus). Explicit size (the
// Android SVG rule); hidden from screen readers (the label names the action).
export function PlusIcon({ color, size = 16 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  coaching: {
    alignSelf: 'flex-start',
    minHeight: COACHING_CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1_5'],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.tealTint,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  coachingText: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.teal,
  },
  category: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  categoryPhone: {
    minHeight: 24,
    paddingHorizontal: 9,
  },
  categoryTablet: {
    minHeight: 26,
    paddingHorizontal: spacing['2_5'],
  },
  categoryText: {
    ...font(600),
    fontSize: 12,
    lineHeight: 16,
  },
  categoryTextTablet: {
    ...font(700),
    fontSize: 12,
    lineHeight: 16,
  },
});
