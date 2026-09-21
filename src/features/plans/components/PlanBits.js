import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorTransition } from '../../../shared/hooks/useColorTransition';
import { colors, radii, textStyles } from '../../../shared/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TRANSPARENT = 'rgba(0,0,0,0)';

// Pressable whose web `hover:` colors apply only while the finger is down, with
// the 150ms transition-colors (RN-SPEC-plans §9.1). Disabled controls get no
// pressed style. `colorsFor(pressed)` returns { backgroundColor, borderColor };
// `style` may be a function of { pressed }.
export function ColorPressable({ colorsFor, style, disabled, children, ...rest }) {
  const [pressed, setPressed] = useState(false);
  const active = pressed && !disabled;
  const target = colorsFor(active);
  const backgroundColor = useColorTransition(target.backgroundColor ?? TRANSPARENT);
  const borderColor = useColorTransition(target.borderColor ?? TRANSPARENT);
  const resolvedStyle = typeof style === 'function' ? style({ pressed: active }) : style;

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[resolvedStyle, { backgroundColor }, target.borderColor ? { borderColor } : null]}
      {...rest}
    >
      {typeof children === 'function' ? children(active) : children}
    </AnimatedPressable>
  );
}

export function Eyebrow({ children, color = colors.brand600, style }) {
  return <Text style={[textStyles.eyebrow, { color }, style]}>{children}</Text>;
}

export function SectionHeading({ children, style }) {
  return (
    <Text accessibilityRole="header" style={[textStyles.sectionHeading, { color: colors.textMuted }, style]}>
      {children}
    </Text>
  );
}

// Pill: radius full, surfaceMuted, 10×4, 12px/600 text-secondary.
export function Pill({ children }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

// ActiveBadge (§3.5); S2 reuses it with "Current plan".
export function StatusBadge({ label = 'Active' }) {
  return (
    <View style={styles.badge}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.badgeDot} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    ...textStyles.pill,
    color: colors.textSecondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.successTint,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  badgeText: {
    ...textStyles.badge,
    color: colors.success,
  },
});
