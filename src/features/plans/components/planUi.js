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

// The T-35 pair ON the gold active-plan card: `dark` = the ground fill with
// primary text ("Go to workout"); `ink` = the ink tint with on-gold text
// ("View plan"). The kit's PillButton has no on-gold variants (kit need).
export function OnGoldButton({ title, onPress, tone = 'dark', large = false, grow = false, fullWidth = false, testID, accessibilityLabel }) {
  const dark = tone === 'dark';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={[
        styles.onGold,
        large ? styles.onGoldLarge : null,
        dark ? styles.onGoldDark : styles.onGoldInk,
        dark ? (large ? styles.padDarkLarge : styles.padDark) : large ? styles.padInkLarge : styles.padInk,
        grow && styles.grow,
        fullWidth && styles.fullWidth,
      ]}
    >
      {({ pressed }) => (
        <>
          {/* Dark button = a dark surface (white 4 %); the ink one sits on gold (ink 4 %). */}
          <PressOverlay pressed={pressed} ink={!dark} />
          <Text
            {...CAP_BODY}
            textBreakStrategy="simple"
            style={[
              dark ? (large ? styles.darkLabelLarge : styles.darkLabel) : large ? styles.inkLabelLarge : styles.inkLabel,
              styles.center,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
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
  onGold: {
    minHeight: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },
  onGoldLarge: {
    minHeight: 56,
  },
  onGoldDark: {
    backgroundColor: colors.ground,
  },
  onGoldInk: {
    backgroundColor: colors.inkTint,
  },
  padDark: {
    paddingHorizontal: spacing[6],
  },
  padDarkLarge: {
    paddingHorizontal: spacing[8],
  },
  padInk: {
    paddingHorizontal: spacing[5],
  },
  padInkLarge: {
    paddingHorizontal: spacing[6],
  },
  grow: {
    flex: 1,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  center: {
    textAlign: 'center',
  },
  // 16/600 primary (label-lg) · tablet 17/600.
  darkLabel: {
    ...font(600),
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  darkLabelLarge: {
    ...font(600),
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  // 15/600 on-gold · tablet 16/600.
  inkLabel: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.onGold,
  },
  inkLabelLarge: {
    ...font(600),
    fontSize: 16,
    lineHeight: 20,
    color: colors.onGold,
  },
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
