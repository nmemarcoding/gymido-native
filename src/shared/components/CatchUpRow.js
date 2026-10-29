import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, font, radii, textScale } from '../theme/tokens';
import { CAP_BODY } from './largeText';

// T-102 Catch-up row (UX ruling §3, owner D3; RN-SPEC-home T-102 block): one
// button under the hero. Min 56, padding 0 16, radius 24, surface + 1px
// hairline; the 32 amber disc with a 16 "!", line 1 15/20 600, line 2 13/18
// muted, the 18 chevron. Large text: it grows and wraps, never truncates;
// below 19rem of viewport (the 200 %-text phone) the disc hides so the words
// keep room. `copy` = catchUpRowCopy(); `ref` (React 19, a plain prop)
// reaches the pressable so a dialog can return focus to it.
const MIN_VIEWPORT_REM = 19;

export function showsDisc(width, fontScale = 1) {
  return width >= MIN_VIEWPORT_REM * 16 * Math.min(fontScale, textScale.body);
}

export default function CatchUpRow({ copy, onPress, disabled = false, testID = 'catch-up-row', style, ref }) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={copy.label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && styles.inactive, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View testID={`${testID}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
          {showsDisc(width, fontScale) ? (
            <View testID={`${testID}-disc`} style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text {...CAP_BODY} allowFontScaling={false} style={styles.mark}>
                !
              </Text>
            </View>
          ) : null}
          <View style={styles.text}>
            <Text testID={`${testID}-line1`} {...CAP_BODY} style={styles.line1}>
              {copy.line1}
            </Text>
            {copy.line2 ? (
              <Text testID={`${testID}-line2`} {...CAP_BODY} style={styles.line2}>
                {copy.line2}
              </Text>
            ) : null}
          </View>
          <Svg
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.textMuted}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M9 6l6 6-6 6" />
          </Svg>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  inactive: {
    opacity: 0.5,
  },
  disc: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningTint,
  },
  mark: {
    ...font(700),
    fontSize: 16,
    lineHeight: 20,
    color: colors.warning,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  line1: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  line2: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
