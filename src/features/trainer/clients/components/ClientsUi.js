import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../../../../shared/theme/tokens';

// Shared pieces of RN-SPEC-TRAINER-CLIENTS §C1.

const STAT_TONES = {
  brand: colors.brand700,
  emerald: '#007a55',
  amber: '#bb4d00',
  slate: colors.textPrimary,
};

// §C1.2
export function TrainerStatCard({ label, value, tone = 'slate', subtitle, style }) {
  return (
    <View style={[styles.statCard, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: STAT_TONES[tone] }]}>{value}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const BADGES = {
  pending: { backgroundColor: '#fffbeb', color: '#973c00', borderColor: '#fee685' },
  active: { backgroundColor: '#ecfdf5', color: '#007a55', borderColor: '#a4f4cf' },
  approved: { backgroundColor: '#ecfdf5', color: '#007a55', borderColor: '#a4f4cf' },
  rejected: { backgroundColor: '#fef2f2', color: '#c10007', borderColor: '#ffc9c9' },
};
const FALLBACK_BADGE = { backgroundColor: '#f1f5f9', color: '#314158', borderColor: '#e2e8f0' };

// §C1.3: styled by `status`, text = `label` or else that status.
export function TrainerStatusBadge({ status, label }) {
  const key = String(status ?? '').trim().toLowerCase();
  const look = BADGES[key] ?? FALLBACK_BADGE;
  return (
    <Text
      style={[
        styles.badge,
        { backgroundColor: look.backgroundColor, color: look.color, borderColor: look.borderColor },
      ]}
    >
      {label ?? status}
    </Text>
  );
}

// §C1.4: a list card with dividers between rows.
export function ListCard({ children, style }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={[styles.listCard, style]}>
      {rows.map((row, index) => (
        <View key={row.key ?? index} style={index > 0 && styles.divider}>
          {row}
        </View>
      ))}
    </View>
  );
}

// A pressable list row (D1/C1 client rows, C2 sessions): pressed bg surfaceMuted.
export function ListRow({ onPress, children, testID, style }) {
  if (!onPress) {
    return <View style={[styles.row, style]}>{children}</View>;
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, style, pressed && styles.rowPressed]}
    >
      {children}
    </Pressable>
  );
}

// §C1.5
export function SectionHeading({ children }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionHeading}>
      {children}
    </Text>
  );
}

// §C1.6
export function CoachingHeader({ title, subtitle, children }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.eyebrow}>Coaching</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children ? <View style={styles.headerRight}>{children}</View> : null}
    </View>
  );
}

// "Manage →" / "← All clients" style link.
export function BrandLink({ label, onPress, testID }) {
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={onPress} hitSlop={8}>
      {({ pressed }) => <Text style={[styles.link, pressed && styles.linkPressed]}>{label}</Text>}
    </Pressable>
  );
}

export const clientStyles = StyleSheet.create({
  rowLabel: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  viewLink: {
    flexShrink: 0,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
});

const styles = StyleSheet.create({
  statCard: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.soft,
  },
  statLabel: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statValue: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '900',
  },
  statSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 12,
    overflow: 'hidden',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  listCard: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  sectionHeading: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 2.52,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    minWidth: 0,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 0,
    gap: 8,
  },
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  title: {
    marginTop: 4,
    fontSize: 30,
    lineHeight: 37.5,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  linkPressed: {
    textDecorationLine: 'underline',
  },
});
