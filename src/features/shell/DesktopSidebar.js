import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radii, typography } from '../../shared/theme/tokens';
import { logout } from '../auth/authService';
import GymIcon from './GymIcon';
import { openShellPath } from './shellLinks';
import { SIDEBAR_INTRO, getSidebarItems, isNavItemActive } from './shellRules';

// App-shell spec §6.4 (tablets, ≥ 768). v2: the icon rail (§7.2) is deferred
// to Phase 8 (PM), so tablets keep this sidebar, restyled to the v2 tokens:
// a surface card with a hairline, items as the web sidebar (§7.3: radius 12,
// 14 px, gap 10; active gold tint + gold 600, inactive text-secondary 500).
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
                  const color = active ? colors.gold : pressed ? colors.textPrimary : colors.textSecondary;
                  // 5-tab nav: each item leads with its tab icon (decorative).
                  return (
                    <>
                      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <GymIcon name={item.icon} size={22} color={color} />
                      </View>
                      <Text style={[styles.itemText, active && styles.itemTextActive, { color }]}>{item.label}</Text>
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
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  intro: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  // v2 eyebrow: 12/600 gold, sentence case (never tracked caps).
  eyebrow: typography.eyebrow,
  title: {
    ...typography.titleMd,
    marginTop: 8,
    color: colors.textPrimary,
  },
  body: {
    ...typography.bodySm,
    marginTop: 8,
    color: colors.textSecondary,
  },
  nav: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  item: {
    minHeight: 44,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemActive: {
    backgroundColor: colors.goldTint,
  },
  itemPressed: {
    backgroundColor: colors.fillChip,
  },
  itemText: {
    ...font(500),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  itemTextActive: font(600),
  quick: {
    padding: 16,
  },
  quickTitle: {
    ...typography.caption,
    ...font(600),
    color: colors.textMuted,
  },
  logout: {
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: 16,
  },
  logoutText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
