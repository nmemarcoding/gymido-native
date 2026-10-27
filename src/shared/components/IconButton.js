import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, radii } from '../theme/tokens';

// RN-SPEC-v2-foundation §4.2 Icon button: a 44 × 44 circle, fill white at
// 7 % (colors.hairline), 1 px white at 10 % (colors.hairlineStrong), icon
// colors.textPrimary. Active: gold fill and
// border, colors.onGold icon. Badge dot: 8 px colors.dangerDot at top 9 /
// right 10 with a 2 px ring in the ground colour. Always labelled.
// The spec draws no pressed state: rest fill steps up to the button hairline
// (0.12); active gold presses to colors.goldDeep (the pressed-gold rule).
//
// `children` is the icon: a node, or ({ color, pressed }) => node so the icon
// takes the right ink. `badge` shows the dot; callers with a count badge
// (NotificationBell) draw their own inside `children`.
export default function IconButton({
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  onPress,
  active = false,
  badge = false,
  disabled = false,
  hitSlop,
  testID,
  children,
  // React 19: a plain prop (the bell measures its frame through it).
  ref,
}) {
  const color = active ? colors.onGold : colors.textPrimary;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...(disabled ? { disabled: true } : null), ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active && styles.active,
        pressed && !disabled && (active ? styles.activePressed : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <>
          {typeof children === 'function' ? children({ color, pressed }) : children}
          {badge ? <View testID={testID ? `${testID}-badge` : undefined} style={styles.dot} /> : null}
        </>
      )}
    </Pressable>
  );
}

const DOT = 8;
const RING = 2;

const styles = StyleSheet.create({
  button: {
    width: layout.touchMin,
    height: layout.touchMin,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.hairlineButton,
  },
  active: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  activePressed: {
    backgroundColor: colors.goldDeep,
    borderColor: colors.goldDeep,
  },
  disabled: {
    opacity: 0.5,
  },
  // The ring is drawn as a border outside the 8 px dot, so the dot itself
  // sits at top 9 / right 10 of the circle (the 1 px edge included).
  dot: {
    position: 'absolute',
    top: 9 - RING - 1,
    right: 10 - RING - 1,
    width: DOT + RING * 2,
    height: DOT + RING * 2,
    borderRadius: radii.full,
    borderWidth: RING,
    borderColor: colors.ground,
    backgroundColor: colors.dangerDot,
  },
});
