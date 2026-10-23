import { Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '../../../shared/components/GradientFill';
import Spinner from '../../../shared/components/Spinner';
import { colors, shadows } from '../../../shared/theme/tokens';

const RESTING = ['#f7ce4f', '#f4b400'];
const PRESSED = ['#f4b400', '#dda000'];

// The gold `to bottom` buttons (START TODAY'S WORKOUT, Browse plans). §19.10:
// both gradients are created at mount and a press only reveals the pressed
// layer (exact colours, no drawable created by a press); press-3d adds the
// 1px sink and inset shadow.
export default function BrandButton({ label, onPress, loading = false, disabled = false, style, labelStyle, testID }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && !inactive ? styles.pressed : styles.resting,
        inactive && styles.inactive,
      ]}
    >
      {({ pressed }) => (
        <>
          <View style={[StyleSheet.absoluteFill, styles.clip]}>
            <GradientFill colors={RESTING} />
            <View style={[StyleSheet.absoluteFill, { opacity: pressed && !inactive ? 1 : 0 }]}>
              <GradientFill colors={PRESSED} />
            </View>
          </View>
          {loading ? <Spinner size={20} thickness={2} color={colors.navy} track="rgba(17, 24, 39, 0.4)" /> : null}
          <Text numberOfLines={1} textBreakStrategy="simple" style={[styles.label, labelStyle]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clip: {
    borderRadius: 9999,
    overflow: 'hidden',
  },
  resting: {
    boxShadow: shadows.brand,
  },
  pressed: {
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  inactive: {
    opacity: 0.6,
  },
  label: {
    color: colors.navy,
    fontWeight: '900',
  },
});
