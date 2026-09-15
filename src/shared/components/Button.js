import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, shadows } from '../theme/tokens';

// Touch has no hover, so the pressed state stands in for web's hover styles.
export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }) {
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        disabled && !loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.brand400,
    boxShadow: shadows.glow,
  },
  primaryPressed: {
    backgroundColor: colors.brand500,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  secondaryPressed: {
    backgroundColor: colors.background,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
