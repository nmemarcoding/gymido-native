import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../../../shared/theme/tokens';

// Small pieces shared by S1 and S2 (RN-SPEC-plans §2.4, §3.5, §3.6).

// Batch A (A1, 23 Oct): eyebrows are brand-700.
export function Eyebrow({ children, color = colors.brand700, style }) {
  return <Text style={[styles.eyebrow, { color }, style]}>{children}</Text>;
}

export function Pill({ children, textColor = colors.textSecondary }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.pillText, { color: textColor }]}>{children}</Text>
    </View>
  );
}

// §3.5: "Active" on S1, "Current plan" on S2.
export function ActiveBadge({ label = 'Active', testID }) {
  return (
    <View testID={testID} style={styles.badge}>
      <View style={styles.badgeDot} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function SectionHeading({ children, style }) {
  return (
    <Text accessibilityRole="header" style={[styles.sectionHeading, style]}>
      {children}
    </Text>
  );
}

export const planStyles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
  },
  title2xl: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  titleXl: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  titleLg: {
    fontSize: 18,
    lineHeight: 22.5,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 6,
    borderRadius: radii.full,
    backgroundColor: colors.successTint,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.success700,
  },
  sectionHeading: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    // Design system v1 P9: section headings are muted.
    color: colors.textMuted,
  },
});
