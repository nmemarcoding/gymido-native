import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logout } from '../../features/auth/authService';
import { useResolvedMode } from '../../features/workspace/useWorkspaceMode';
import { Workspace } from '../../features/workspace/workspace';
import { colors, radii, shadows } from '../../shared/theme/tokens';
import {
  DESKTOP_CONTENT_BOTTOM_PADDING,
  DESKTOP_ROW_MAX_WIDTH,
  MOBILE_COLUMN_MAX_WIDTH,
  MOBILE_CONTENT_BOTTOM_PADDING,
  SIDEBAR_WIDTH,
  useLayoutMetrics,
} from './layoutMetrics';
import { findTabNavigation, openTab } from './shellNavigation';
import { isActivePath, MEMBER_SIDEBAR, TRAINER_SIDEBAR } from './shellRules';

const INTRO = {
  [Workspace.member]: {
    eyebrow: 'Workout App',
    title: 'Stay on track',
    body: 'Quick access to your daily workout tools.',
  },
  [Workspace.trainer]: {
    eyebrow: 'Coaching',
    title: 'Coach your clients',
    body: 'Manage clients, plans, and your trainer profile.',
  },
};

function PressableRow({ style, pressedStyle, children, ...rest }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[style, pressed && pressedStyle]}
      {...rest}
    >
      {children(pressed)}
    </Pressable>
  );
}

// DesktopSidebar (RN-SPEC-app-shell §6.4), width ≥ 768 only. No icons.
function DesktopSidebar({ path }) {
  const navigation = useNavigation();
  const { mode } = useResolvedMode(path);
  const intro = INTRO[mode];
  const items = mode === Workspace.trainer ? TRAINER_SIDEBAR : MEMBER_SIDEBAR;

  const open = (routeName) => {
    const tabNavigation = findTabNavigation(navigation);
    if (tabNavigation) {
      openTab(tabNavigation, routeName);
    }
  };

  return (
    <View testID="desktop-sidebar" style={styles.sidebar}>
      <View style={styles.card}>
        <View style={styles.intro}>
          <Text style={styles.introEyebrow}>{intro.eyebrow}</Text>
          <Text style={styles.introTitle}>{intro.title}</Text>
          <Text style={styles.introBody}>{intro.body}</Text>
        </View>
        <View style={styles.nav}>
          {items.map((item) => {
            const active = isActivePath(path, item.path, item.exact);
            return (
              <PressableRow
                key={item.route}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => open(item.route)}
                style={[styles.navItem, active && styles.navItemActive]}
                pressedStyle={active ? null : styles.pressedBg}
              >
                {(pressed) => (
                  <Text
                    style={[
                      styles.navLabel,
                      { color: active ? colors.brand700 : pressed ? colors.textPrimary : colors.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                )}
              </PressableRow>
            );
          })}
        </View>
      </View>
      <View style={[styles.card, styles.quickCard]}>
        <Text style={styles.quickLabel}>Quick actions</Text>
        <PressableRow
          accessibilityRole="button"
          onPress={() => logout()}
          style={styles.logout}
          pressedStyle={styles.pressedBg}
        >
          {() => <Text style={styles.logoutLabel}>Logout</Text>}
        </PressableRow>
      </View>
    </View>
  );
}

// The member shell (§4): content scrolls under the status bar inset with the
// header inside the scroll content. [O2] safe areas are respected: bottom
// inset added to the content padding, side insets to the shell padding.
// keyboardShouldPersistTaps="handled": with the default ("never") the scroll
// view claims the first tap while the keyboard is up and only dismisses it, so
// a button needs two taps. Modals rendered from a page (ChangePasswordModal)
// sit under this ScrollView in the React tree and lose that tap too. On web
// one click always reaches the button.
export default function PageLayout({ children, testID, path = '/' }) {
  const { isDesktop, gutter } = useLayoutMetrics();
  const insets = useSafeAreaInsets();

  if (isDesktop) {
    return (
      <View testID={testID} style={[styles.root, { paddingTop: insets.top }]}>
        <View
          style={[
            styles.desktopRow,
            { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right },
          ]}
        >
          <DesktopSidebar path={path} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.desktopContent}
            contentContainerStyle={{ paddingBottom: DESKTOP_CONTENT_BOTTOM_PADDING + insets.bottom }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.mobileScroll,
          { paddingBottom: MOBILE_CONTENT_BOTTOM_PADDING + insets.bottom },
        ]}
      >
        <View
          style={[
            styles.mobileColumn,
            { paddingLeft: gutter + insets.left, paddingRight: gutter + insets.right },
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileScroll: {
    alignItems: 'center',
  },
  mobileColumn: {
    width: '100%',
    maxWidth: MOBILE_COLUMN_MAX_WIDTH,
  },
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 32,
    width: '100%',
    maxWidth: DESKTOP_ROW_MAX_WIDTH,
    alignSelf: 'center',
    paddingTop: 24,
  },
  desktopContent: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    gap: 16,
  },
  card: {
    borderRadius: radii.surfaceCard,
    backgroundColor: colors.surface,
    boxShadow: shadows.plansSoft,
    overflow: 'hidden',
  },
  intro: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  introEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  introTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  introBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  nav: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  navItem: {
    minHeight: 44,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: colors.brand50,
    borderColor: colors.brandBorder,
  },
  pressedBg: {
    backgroundColor: colors.surfaceMuted,
  },
  navLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  quickCard: {
    padding: 16,
  },
  quickLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  logout: {
    marginTop: 12,
    width: '100%',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  logoutLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
