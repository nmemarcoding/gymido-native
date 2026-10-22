import { useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { breakpoints, colors } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import AppHeader from './AppHeader';
import DesktopSidebar from './DesktopSidebar';
import ModeSwitch from './ModeSwitch';
import { getScreenPath } from './shellNavigation';
import { resolveMode, showsMobileModeSwitch } from './shellRules';

// App-shell spec §4: every shell screen scrolls its header and content
// together. Phone: a centred column (max 430) above the tab bar; tablet
// (≥ 768): the sidebar beside the content. [O2] safe-area insets added.
// `nestable` hosts a draggable list (T3's sortable exercises).
export default function ShellPage({ children, nestable = false, testID = 'app-root' }) {
  const route = useRoute();
  const path = getScreenPath(route.name, route.params);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const storedPreference = useAuthStore((state) => state.workspace);
  const mode = resolveMode({ user, path, storedPreference });
  const tablet = width >= breakpoints.md;
  const gutter = tablet ? 24 : width >= breakpoints.sm ? 20 : 16;
  const Scroller = nestable ? NestableScrollContainer : ScrollView;

  const content = (
    <View style={[styles.content, { paddingBottom: (tablet ? 40 : 112) + insets.bottom }]}>
      <AppHeader path={path} mode={mode} />
      {!tablet && showsMobileModeSwitch({ user, path }) ? (
        <View style={styles.mobileSwitch}>
          <Text style={styles.mobileSwitchLabel}>Workspace</Text>
          <ModeSwitch mode={mode} />
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    // [O2] The status-bar band is page background; content never scrolls under it.
    <View testID={testID} style={[styles.screen, { paddingTop: insets.top }]}>
      <Scroller
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: tablet ? 24 : 0,
          paddingLeft: gutter + insets.left,
          paddingRight: gutter + insets.right,
        }}
      >
        {tablet ? (
          <View style={styles.tabletRow}>
            <DesktopSidebar mode={mode} path={path} />
            {content}
          </View>
        ) : (
          <View style={styles.phoneColumn}>{content}</View>
        )}
      </Scroller>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  phoneColumn: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  tabletRow: {
    width: '100%',
    maxWidth: 1152,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 32,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  mobileSwitch: {
    marginBottom: 20,
  },
  mobileSwitchLabel: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
