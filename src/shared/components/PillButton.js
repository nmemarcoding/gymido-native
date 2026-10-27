import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../theme/tokens';
import Spinner from './Spinner';

const VARIANTS = {
  primary: { rest: { backgroundColor: colors.brand400 }, pressed: { backgroundColor: colors.brand500 }, text: colors.navy },
  secondary: {
    rest: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    pressed: { backgroundColor: colors.surfaceMuted },
    text: colors.textPrimary,
  },
  danger: { rest: { backgroundColor: colors.danger600 }, pressed: { backgroundColor: colors.danger700 }, text: colors.onDanger },
};

// Trainer plans spec §A3.3. The pill-shaped app button; the older `Button`
// keeps the Login spec look.
export default function PillButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  size = 'default',
  accessibilityLabel,
  testID,
  // React 19: a plain prop, for callers that move accessibility focus here.
  ref,
}) {
  const inactive = disabled || loading;
  const look = VARIANTS[variant];

  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        look.rest,
        size === 'small' && styles.small,
        pressed && look.pressed,
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
      ]}
    >
      <View style={[styles.row, fullWidth && styles.rowFullWidth]}>
        {loading ? <Spinner size={16} thickness={2} color={look.text} track="transparent" /> : null}
        {/* Android's high-quality line breaking can measure a bold label slightly
            short and clip its last word ("Add a day" → "Add a"). */}
        <Text
          textBreakStrategy="simple"
          style={[styles.label, size === 'small' && styles.smallLabel, { color: look.text }]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.soft,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Android can measure a shrink-wrapped label short inside a stretched
  // button and cut its last word; full-width buttons lay it out full width.
  rowFullWidth: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  inactive: {
    opacity: 0.6,
  },
});
