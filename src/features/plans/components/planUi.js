import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CAP_BODY } from '../../../shared/components/largeText';
import { breakpoints, colors, font, layout, radii, spacing, textScale } from '../../../shared/theme/tokens';
import PlanIcon from './planIcons';

// v2 pieces shared by Plans, Plan detail and My plans (UX H).

// v2 device split (§3): tablets are ≥ md (768) in both orientations.
export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= breakpoints.md;
}

// UX §9 rule 4 (read live, so a text-size change re-lays the page out).
export function useReflow() {
  const { fontScale } = useWindowDimensions();
  return fontScale > textScale.reflowAbove;
}

// §8.6 STATE RULE: pressed = the rest colour + a 4 % overlay (white on dark
// surfaces, ink on gold). Drawn only while pressed; never a new alpha.
export function PressOverlay({ pressed, ink = false, radius = radii.full }) {
  if (!pressed) {
    return null;
  }
  return (
    <View
      testID="press-overlay"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: ink ? colors.pressOverlayInk : colors.pressOverlay }]}
    />
  );
}

// Phone Plan detail: the glass back pill (44, icon + "Plans"). Tablet: the
// plain secondary text link with the icon. Both are links to Plans.
export function BackToPlans({ onPress, tablet = false, label = 'Plans', testID = 'plan-detail-back' }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={tablet ? styles.backLink : styles.backPill}
    >
      {({ pressed }) => (
        <>
          {tablet ? null : <PressOverlay pressed={pressed} />}
          <PlanIcon name="back" size={18} color={tablet ? colors.textSecondary : colors.textPrimary} />
          <Text {...CAP_BODY} style={[styles.backText, tablet && styles.backTextTablet, tablet && pressed && styles.backTextPressed]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44 tall, pad 0 14 0 8, glass fill + hairline-strong (0.07 folds into the
  // glass button fill, U8).
  backPill: {
    minHeight: layout.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    paddingLeft: spacing[2],
    paddingRight: spacing['3_5'],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.fillGlass,
  },
  backLink: {
    minHeight: layout.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing['1_5'],
  },
  backText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  backTextTablet: {
    color: colors.textSecondary,
  },
  backTextPressed: {
    textDecorationLine: 'underline',
  },
});

// Splits items into lines of `size` (a grid drawn as rows of flex cells).
export function rowsOf(items, size) {
  const lines = [];
  for (let index = 0; index < items.length; index += size) {
    lines.push(items.slice(index, index + size));
  }
  return lines;
}

// CSS repeat(auto-fill/auto-fit, minmax(min(100%, min), 1fr)): how many
// `min`-wide columns with `gap` between them fit `width` (at least one).
export function gridColumns(width, min, gap) {
  return Math.max(1, Math.floor((width + gap) / (min + gap)));
}
