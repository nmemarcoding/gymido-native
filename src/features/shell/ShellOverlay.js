import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { breakpoints } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import NotificationPanel from '../notifications/NotificationPanel';
import BottomNav from './BottomNav';
import { TAB_ROOTS, getScreenPath } from './shellNavigation';
import { resolveMode } from './shellRules';
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
export default function ShellOverlay({ state }) {
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const storedPreference = useAuthStore((s) => s.workspace);
  const panelOpen = useShellUiStore((s) => s.panelOpen);
  const isSessionActive = useShellUiStore((s) => s.isSessionActive);
  const path = getTabsPath(state);
  const mode = resolveMode({ user, path, storedPreference });
  const tablet = width >= breakpoints.md;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {panelOpen ? (
        // Phone: the dimmed scrim. Tablet: the same layer, transparent.
        <Pressable
          testID="notification-scrim"
          accessibilityLabel="Close notifications"
          onPressIn={closePanel}
          style={[styles.layer, !tablet && styles.scrim]}
        />
      ) : null}
      {!tablet && !isSessionActive ? <BottomNav mode={mode} path={path} /> : null}
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
  scrim: {
    backgroundColor: 'rgba(17, 24, 39, 0.30)',
  },
});
