import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '../../shared/theme/tokens';
import { logout } from '../auth/authService';
import GymIcon from './GymIcon';
import { openShellPath } from './shellLinks';
import { SIDEBAR_INTRO, getSidebarItems, isNavItemActive } from './shellRules';

// App-shell spec §6.4 (tablets, ≥ 768). No icons.
export default function DesktopSidebar({ mode, path }) {
  const intro = SIDEBAR_INTRO[mode];

  return (
    <View testID="desktop-sidebar" style={styles.sidebar}>
      <View style={styles.card}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{intro.eyebrow}</Text>
          <Text style={styles.title}>{intro.title}</Text>
          <Text style={styles.body}>{intro.body}</Text>
        </View>
        <View style={styles.nav}>
          {getSidebarItems(mode).map((item) => {
            const active = isNavItemActive(item, path);
            return (
              <Pressable
                key={item.path}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => openShellPath(item.path)}
                style={({ pressed }) => [styles.item, active && styles.itemActive, !active && pressed && styles.itemPressed]}
              >
                {({ pressed }) => {
                  const color = active ? colors.brand700 : pressed ? colors.textPrimary : colors.textSecondary;
                  // 5-tab nav: each item leads with its tab icon (decorative).
                  return (
                    <>
                      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <GymIcon name={item.icon} size={24} color={color} />
                      </View>
                      <Text style={[styles.itemText, { color }]}>{item.label}</Text>
                    </>
                  );
                }}
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={[styles.card, styles.quick]}>
        <Text style={styles.quickTitle}>Quick actions</Text>
        <Pressable
          accessibilityRole="button"
          onPress={logout}
          style={({ pressed }) => [styles.logout, pressed && styles.itemPressed]}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 256,
    gap: 16,
    alignSelf: 'flex-start',
  },
  card: {
    borderRadius: radii.surfaceCard,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  intro: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  title: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  nav: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  item: {
    minHeight: 44,
    borderRadius: radii.xxl,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemActive: {
    backgroundColor: colors.brand50,
    borderColor: 'rgba(221, 160, 0, 0.30)',
  },
  itemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quick: {
    padding: 16,
  },
  quickTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  logout: {
    marginTop: 12,
    borderRadius: radii.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
