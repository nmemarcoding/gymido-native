import { useRoute } from '@react-navigation/native';
import { Fragment } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '../../shared/components/Screen';
import { useKeyboardOverlap } from '../../shared/hooks/useKeyboardHeight';
import { usesRail } from '../../shared/hooks/useLayoutClass';
import { breakpoints, colors, font, layout, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import AppHeader from './AppHeader';
import { HeroTitleProvider, useHeroTitleRegistry } from './heroTitle';
import ModeSwitch from './ModeSwitch';
import { RAIL } from './railMetrics';
import StatusBarBackdrop from './StatusBarBackdrop';
import { getScreenPath } from './shellNavigation';
import { resolveMode, showsMobileModeSwitch, showsPhoneTabBar } from './shellRules';
import TabletFrame from './TabletFrame';
import { INNER_PAGE_CONTENT_PADDING, TAB_BAR_CONTENT_PADDING } from './tabBarMetrics';

// App-shell spec §4: every shell screen scrolls its header and content
// together. Phone: a centred column (max 430) above the tab bar. Tablet
// (≥ 768, portrait AND landscape; RN-SPEC-v2-foundation §3 [O2], §7.2, T-55):
// the fixed icon rail at the left, outside the scroll, and the content
// beside it, capped at 1120 and centred (≥ 1280 keeps the rail; native has no
// web sidebar). [O2] safe-area insets added. T-56: ShellOverlay draws the one
// rail above every tab stack (it stays still on a push); this page only
// reserves its width (TabletFrame).
// `nestable` hosts a draggable list (T3's sortable exercises).
// v2 (RN-SPEC-v2-foundation §7): the ground colour; phones keep 104 px (+ the
// safe area) under the content so nothing ends under the floating tab bar
// (T-65: on the main tab pages; inner pages 24, no bar there);
// `glow` draws the ambient gold glow where a board has one (see Screen.js).
// `scrollRef` (optional): the page's ScrollView, for screens that scroll
// programmatically (the generator's Review opens at the top, G1.3).
// `headerActions` (optional): drawn right-aligned on the shell header's title
// row (AppHeader); tablet Progress puts its Body/Activity switch there.
// `headerLeading` (optional, T-140 ruling §2.1): a page's own control on the
// left of that row (the Workout page's Back pill, on the bell's row).
// `contentMaxWidth` (optional, T-140): a page drawn in a centred column of
// that width gets its header row in the same column (Back and bell line up
// with the content; web parity).
// `dockHeight` (optional): the measured height of the page's PinnedDock (UX
// native final audit 27 Oct 2026, ruling 1). The scroll's contentContainer
// bottom padding is then exactly that height (it already holds the tab bar,
// the gap and the safe area) instead of the tab-bar padding; null = not
// measured yet / no dock.
export default function ShellPage({ children, nestable = false, glow = false, testID = 'app-root', scrollRef, headerActions, headerLeading = null, contentMaxWidth = null, dockHeight = null }) {
  const route = useRoute();
  const path = getScreenPath(route.name, route.params);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const storedPreference = useAuthStore((state) => state.workspace);
  const mode = resolveMode({ user, path, storedPreference });
  const tablet = usesRail(width);
  const gutter = width >= breakpoints.sm ? 20 : 16;
  const Scroller = nestable ? NestableScrollContainer : ScrollView;
  // Inputs never stay under the keyboard: iOS insets the ScrollView itself
  // (automaticallyAdjustKeyboardInsets); edge-to-edge Android isn't resized,
  // so the content grows by the keyboard height while it is open. Batch k
  // (PM, 27 Oct 2026): by what the keyboard COVERS of the window; the raw
  // height leaves out the nav bar under the IME.
  const keyboardHeight = useKeyboardOverlap();
  const keyboardPad = Platform.OS === 'android' ? keyboardHeight : 0;
  // §6.1 (audit b1 X1): the page's hero title, if any, registers here.
  const { registry, heroTitleShown } = useHeroTitleRegistry();
  const docked = dockHeight !== null && dockHeight !== undefined;
  const dockPad = docked ? dockHeight : 0;
  // T-65 (PHONE-NAV spec §4): the tab-bar clearance only where the bar is
  // (showsPhoneTabBar, ShellOverlay's rule); an inner page without a dock
  // ends 24 above the safe area. Tablets keep 40.
  const bottomRoom = tablet ? 40 : showsPhoneTabBar(path) ? TAB_BAR_CONTENT_PADDING : INNER_PAGE_CONTENT_PADDING;

  const content = (
    <View style={[styles.content, { paddingBottom: (docked ? 0 : bottomRoom + insets.bottom) + keyboardPad }]}>
      {/* QA F1, iOS: after a live text-size change, React's next commit lays
          out unchanged texts with their old measurements (clipped until they
          remount). So the header and the page content remount on a new text
          scale; state kept above ShellPage (the screen component) survives.
          The active workout renders outside ShellPage and is not remounted.
          Details: ~/gymido-mobile-work/v2/phase1-qa-fixes.md. */}
      <View testID="shell-header-column" style={contentMaxWidth ? [styles.headerColumn, { maxWidth: contentMaxWidth }] : null}>
        <AppHeader key={`header-scale-${fontScale}`} path={path} mode={mode} headerActions={headerActions} headerLeading={headerLeading} heroTitleShown={heroTitleShown} />
      </View>
      {!tablet && showsMobileModeSwitch({ user, path }) ? (
        <View style={styles.mobileSwitch}>
          <Text style={styles.mobileSwitchLabel}>Workspace</Text>
          <ModeSwitch mode={mode} />
        </View>
      ) : null}
      <HeroTitleProvider value={registry}>
        <Fragment key={`content-scale-${fontScale}`}>{children}</Fragment>
      </HeroTitleProvider>
    </View>
  );

  const scrollerProps = {
    keyboardShouldPersistTaps: 'handled',
    automaticallyAdjustKeyboardInsets: true,
  };

  if (tablet) {
    // The reserved rail space takes the left inset (TabletFrame); the right gutter keeps the right one.
    return (
      <View testID={testID} style={styles.screen}>
        <AmbientGlow glow={glow} />
        <TabletFrame>
          <Scroller
            ref={scrollRef}
            {...scrollerProps}
            contentContainerStyle={{
              paddingTop: 24,
              paddingBottom: dockPad,
              paddingLeft: RAIL.contentGutter,
              paddingRight: RAIL.contentGutter + insets.right,
            }}
          >
            <View testID="shell-content-column" style={styles.tabletColumn}>
              {content}
            </View>
          </Scroller>
        </TabletFrame>
      </View>
    );
  }

  return (
    // [O2] The status-bar band is page background; content never scrolls
    // under it: StatusBarBackdrop covers the band (audit ruling 2).
    <View testID={testID} style={[styles.screen, { paddingTop: insets.top }]}>
      <AmbientGlow glow={glow} />
      <Scroller
        ref={scrollRef}
        {...scrollerProps}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: dockPad,
          paddingLeft: gutter + insets.left,
          paddingRight: gutter + insets.right,
        }}
      >
        <View style={styles.phoneColumn}>{content}</View>
      </Scroller>
      {/* UX native final audit 27 Oct 2026, ruling 2: over the scroll, in the inset band. */}
      <StatusBarBackdrop />
    </View>
  );
}

const styles = StyleSheet.create({
  headerColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  phoneColumn: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  // ≥ 1280: content max 1120, centred beside the rail (tablet-strategy §3).
  tabletColumn: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
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
