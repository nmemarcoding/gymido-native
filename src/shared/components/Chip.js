import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, layout, radii, spacing } from '../theme/tokens';

// RN-SPEC-v2-foundation §4.4 filter chip: 38 tall with a 44 hit area
// (hitSlop), white when on, a faint glass pill when off. The selected state
// is exposed (accessibilityState.selected). Callers adopt it in Phase 4.
export const CHIP_HEIGHT = 38;
const SLOP = (layout.touchMin - CHIP_HEIGHT) / 2;
export const CHIP_HIT_SLOP = Object.freeze({ top: SLOP, bottom: SLOP, left: 0, right: 0 });

export default function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  style,
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={CHIP_HIT_SLOP}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.on : [styles.off, pressed && styles.offPressed],
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text numberOfLines={1} style={[styles.label, selected ? styles.labelOn : styles.labelOff]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    // Always 1 px so the chip keeps its size when it turns on.
    borderWidth: 1,
  },
  // On: the light fill (text-primary) + on-light text 600.
  on: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  off: {
    backgroundColor: colors.fillChip,
    borderColor: colors.hairlineStrong,
  },
  offPressed: {
    // Pressed off chip: white 12 % (UX, 26 Oct).
    backgroundColor: colors.hairlineButton,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
  },
  labelOn: {
    ...font(600),
    color: colors.onLight,
  },
  labelOff: {
    ...font(500),
    color: colors.textStrong2,
  },
});
