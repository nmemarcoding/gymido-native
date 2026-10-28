import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { breakpoints, colors, font, layout, radii, spacing } from '../theme/tokens';
import { CAP_BODY } from './largeText';

// UX native final audit 27 Oct 2026, ruling 6: the boards' glass back pill
// ("‹ All trainers", "‹ Coaching", "‹ Profile", "‹ All clients"). 44 tall on
// phones, 40 on tablets (≥ 768; the hit area stays 44), white 7 % fill
// (colors.hairline) + 1 px white 10 %, a decorative chevron and the parent's
// name in 14/600 primary text. A link: its name is just the parent. Pressed
// = the rest fill + the 4 % press overlay (§8.6).
// Kit (one component): the coaching pages, the trainer Client detail and the
// shell header's back links all draw this.
const TABLET_HEIGHT = 40;
const TABLET_HIT_SLOP = { top: (layout.touchMin - TABLET_HEIGHT) / 2, bottom: (layout.touchMin - TABLET_HEIGHT) / 2 };

// A back link's words as the pill shows them: the chevron replaces a leading "←".
export const backPillLabel = (label) => String(label ?? '').replace(/^←\s*/, '');

export default function BackPill({ label, onPress, testID, accessibilityLabel, style }) {
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={tablet ? TABLET_HIT_SLOP : undefined}
      style={[styles.pill, tablet && styles.pillTablet, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID={testID ? `${testID}-pressed` : undefined} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg testID={testID ? `${testID}-chevron` : undefined} width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text {...CAP_BODY} textBreakStrategy="simple" style={styles.label}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Pad 0 14 0 8 around the 18 chevron (the Plan detail pill's spacing).
  pill: {
    minHeight: layout.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: spacing[1],
    paddingLeft: spacing[2],
    paddingRight: spacing['3_5'],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.hairline,
  },
  pillTablet: {
    minHeight: TABLET_HEIGHT,
  },
  pressed: {
    borderRadius: radii.full,
    backgroundColor: colors.pressOverlay,
  },
  label: {
    ...font(600),
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
