import { useRoute } from '@react-navigation/native';
import { Fragment } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '../../shared/components/Screen';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { breakpoints, colors, font, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import AppHeader from './AppHeader';
import DesktopSidebar from './DesktopSidebar';
import ModeSwitch from './ModeSwitch';
import { getScreenPath } from './shellNavigation';
import { resolveMode, showsMobileModeSwitch } from './shellRules';
import { TAB_BAR_CONTENT_PADDING } from './tabBarMetrics';

// App-shell spec §4: every shell screen scrolls its header and content
// together. Phone: a centred column (max 430) above the tab bar; tablet
// (≥ 768): the sidebar beside the content. [O2] safe-area insets added.
// `nestable` hosts a draggable list (T3's sortable exercises).
// v2 (RN-SPEC-v2-foundation §7): the ground colour; phones keep 104 px (+ the
// safe area) under the content so nothing ends under the floating tab bar;
// `glow` draws the ambient gold glow where a board has one (see Screen.js).
export default function ShellPage({ children, nestable = false, glow = false, testID = 'app-root' }) {
  const route = useRoute();
  const path = getScreenPath(route.name, route.params);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const storedPreference = useAuthStore((state) => state.workspace);
  const mode = resolveMode({ user, path, storedPreference });
  const tablet = width >= breakpoints.md;
  const gutter = tablet ? 24 : width >= breakpoints.sm ? 20 : 16;
  const Scroller = nestable ? NestableScrollContainer : ScrollView;
  // Inputs never stay under the keyboard: iOS insets the ScrollView itself
  // (automaticallyAdjustKeyboardInsets); edge-to-edge Android isn't resized,
  // so the content grows by the keyboard height while it is open.
  const keyboardHeight = useKeyboardHeight();
  const keyboardPad = Platform.OS === 'android' ? keyboardHeight : 0;

  const content = (
    <View style={[styles.content, { paddingBottom: (tablet ? 40 : TAB_BAR_CONTENT_PADDING) + insets.bottom + keyboardPad }]}>
      {/* QA F1, iOS: after a live text-size change, React's next commit lays
          out unchanged texts with their old measurements (clipped until they
          remount). So the header and the page content remount on a new text
          scale; state kept above ShellPage (the screen component) survives.
          The active workout renders outside ShellPage and is not remounted.
          Details: ~/gymido-mobile-work/v2/phase1-qa-fixes.md. */}
      <AppHeader key={`header-scale-${fontScale}`} path={path} mode={mode} />
      {!tablet && showsMobileModeSwitch({ user, path }) ? (
        <View style={styles.mobileSwitch}>
          <Text style={styles.mobileSwitchLabel}>Workspace</Text>
          <ModeSwitch mode={mode} />
        </View>
      ) : null}
      <Fragment key={`content-scale-${fontScale}`}>{children}</Fragment>
    </View>
  );

  return (
    // [O2] The status-bar band is page background; content never scrolls under it.
    <View testID={testID} style={[styles.screen, { paddingTop: insets.top }]}>
      <AmbientGlow glow={glow} />
      <Scroller
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
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
    backgroundColor: colors.ground,
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
    // v2: sentence case, never tracked caps (§2).
    ...typography.caption,
    ...font(600),
    color: colors.textMuted,
  },
});
