import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { usesRail } from '../../shared/hooks/useLayoutClass';
import { colors } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import NotificationPanel from '../notifications/NotificationPanel';
import BottomNav from './BottomNav';
import { useShowsRail } from './TabletFrame';
import TabletRail from './TabletRail';
import { TAB_ROOTS, getScreenPath } from './shellNavigation';
import { resolveMode, showsPhoneTabBar } from './shellRules';
import { usePhoneChromeStore } from './phoneChromeStore';
import { closePanel, useShellUiStore } from './shellUiStore';

// The current web path from the tab navigator's state.
export function getTabsPath(state) {
  const tabRoute = state.routes[state.index];
  const stack = tabRoute.state;
  const leaf = stack?.routes?.[stack.index ?? 0];
  return leaf ? getScreenPath(leaf.name, leaf.params) : getScreenPath(TAB_ROOTS[tabRoute.name]);
}

// The bottom-tabs `tabBar`: the chrome drawn over the screens, in the spec's
// paint order (§11): panel scrim, tab bar, notification panel. Toasts sit
// above all of it in the app root.
// T-56: on tablets this one overlay (above every tab stack) also draws the
// icon rail, first, so it stays below the scrim as it did inside the page.
// One instance for the whole shell: a stack push/pop slides the page under
// it and the rail never moves or remounts; the active item follows the
// focused route (getTabsPath). Pages reserve its width (TabletFrame).
export default function ShellOverlay({ state }) {
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const storedPreference = useAuthStore((s) => s.workspace);
  const panelOpen = useShellUiStore((s) => s.panelOpen);
  const isSessionActive = useShellUiStore((s) => s.isSessionActive);
  const path = getTabsPath(state);
  const mode = resolveMode({ user, path, storedPreference });
  // T-55: < 768 the tab bar; ≥ 768 (both orientations) the rail.
  const tablet = usesRail(width);
  // T-56: the same rule pages use to reserve the space (no rail during a live workout).
  const showsRail = useShowsRail();
  // T-65 (PHONE-NAV spec §1 / §2): phones draw the bar on the main tab pages
  // only (the allowlist); a pushed inner page has none from its first frame
  // (this render), with no animation. The session flag still hides it.
  const phoneTabBar = !tablet && !isSessionActive && showsPhoneTabBar(path);
  const setPhoneTabBar = usePhoneChromeStore((s) => s.setPhoneTabBar);
  // Mirrored for the app-level toasts (outside the navigator); outside the shell they keep the bar's clearance.
  useEffect(() => {
    setPhoneTabBar(phoneTabBar);
  }, [setPhoneTabBar, phoneTabBar]);
  useEffect(() => () => setPhoneTabBar(true), [setPhoneTabBar]);

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {showsRail ? (
        <View testID="shell-rail-layer" pointerEvents="box-none" style={styles.railLayer}>
          <TabletRail mode={mode} path={path} />
        </View>
      ) : null}
      {panelOpen ? (
        // Phone: the dimmed scrim. Tablet: the same layer, transparent.
        <Pressable
          testID="notification-scrim"
          accessibilityLabel="Close notifications"
          onPressIn={closePanel}
          style={[styles.layer, !tablet && styles.scrim]}
        />
      ) : null}
      {phoneTabBar ? <BottomNav mode={mode} path={path} /> : null}
      {panelOpen ? <NotificationPanel /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  // Fixed at the left, full height; the rail stretches in the row.
  railLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
  },
  scrim: {
    backgroundColor: colors.scrimLight,
  },
});
