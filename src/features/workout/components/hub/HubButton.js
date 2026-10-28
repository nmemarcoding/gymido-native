import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAP_BODY } from '../../../../shared/components/largeText';
import Spinner from '../../../../shared/components/Spinner';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';

// T-76 hub actions as drawn: the one gold action (56, 17/700, no glow: the
// brief allows no coloured glow) and the outlined one (52, 16/600, white
// 0.18 edge). Pressed: the rest colour stays under the 4 % overlay (UX §8.6).
// Labels wrap at large text and the pill grows from its minimum.
const LOOKS = {
  gold: { box: { minHeight: 56, backgroundColor: colors.gold }, text: colors.onGold, label: { ...font(700), fontSize: 17, lineHeight: 22 }, overlay: colors.pressOverlayInk },
  outline: {
    box: { minHeight: 52, borderWidth: 1, borderColor: colors.hairlineBright },
    text: colors.textPrimary,
    label: { ...font(600), fontSize: 16, lineHeight: 22 },
    overlay: colors.pressOverlay,
  },
};

export default function HubButton({ title, onPress, variant = 'gold', icon, loading = false, disabled = false, accessibilityLabel, testID, style }) {
  const look = LOOKS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.base, look.box, inactive && styles.inactive, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: look.overlay }]} /> : null}
          <View style={styles.row}>
            {loading ? <Spinner size={18} thickness={2} color={look.text} /> : typeof icon === 'function' ? icon({ color: look.text }) : icon}
            <Text {...CAP_BODY} style={[styles.label, look.label, { color: look.text }]}>
              {title}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
  },
  overlay: {
    borderRadius: radii.full,
  },
  inactive: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
