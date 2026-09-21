import { useNavigation } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../shared/theme/tokens';
import { routes } from '../routes';
import {
  DESKTOP_CONTENT_BOTTOM_PADDING,
  DESKTOP_ROW_MAX_WIDTH,
  MOBILE_COLUMN_MAX_WIDTH,
  MOBILE_CONTENT_BOTTOM_PADDING,
  SIDEBAR_WIDTH,
  useLayoutMetrics,
} from './layoutMetrics';
import { openLibraryRoot } from './libraryNavigation';
import { findTabNavigation, MEMBER_TABS } from './tabs';

// STUB: DesktopSidebar visuals belong to docs/RN-SPEC-app-shell.md. This only
// holds the 256px column and lets tablets switch tabs.
function DesktopSidebarStub() {
  const navigation = useNavigation();

  const open = (tabName) => {
    const tabNavigation = findTabNavigation(navigation);
    if (!tabNavigation) {
      return;
    }
    if (tabName === routes.LibraryTab) {
      openLibraryRoot(tabNavigation);
      return;
    }
    tabNavigation.navigate(tabName);
  };

  return (
    <View testID="desktop-sidebar" style={styles.sidebar}>
      {MEMBER_TABS.map((tab) => (
        <Pressable key={tab.name} accessibilityRole="link" onPress={() => open(tab.name)} style={styles.sidebarLink}>
          <Text style={styles.sidebarLabel}>{tab.sidebarLabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// The web AppLayout content area (RN-SPEC-plans §1.1, §2.8). Content scrolls
// under the status bar inset; the header is part of the scroll content.
// Per the owner, device safe areas are respected (bottom and side insets).
export default function PageLayout({ children, testID }) {
  const { isDesktop, gutter } = useLayoutMetrics();
  const insets = useSafeAreaInsets();

  if (isDesktop) {
    return (
      <View
        testID={testID}
        style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}
      >
        <View style={styles.desktopRow}>
          <DesktopSidebarStub />
          <ScrollView
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
        contentContainerStyle={[
          styles.mobileScroll,
          { paddingBottom: MOBILE_CONTENT_BOTTOM_PADDING + insets.bottom },
        ]}
      >
        <View style={[styles.mobileColumn, { paddingHorizontal: gutter }]}>{children}</View>
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
    gap: 32,
    width: '100%',
    maxWidth: DESKTOP_ROW_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    gap: 4,
  },
  sidebarLink: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sidebarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  desktopContent: {
    flex: 1,
  },
});
