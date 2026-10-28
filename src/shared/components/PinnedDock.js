import { useLayoutEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../features/shell/tabBarMetrics';
import { breakpoints, colors, gradients, spacing } from '../theme/tokens';
import GradientFill from './GradientFill';
import { BUTTON_HEIGHTS } from './PillButton';

// UX native final audit 27 Oct 2026, ruling 1 (+ the GENERATOR-FADE ruling):
// ONE dock layer for every pinned footer. It runs from 32 above the top button
// to the BOTTOM EDGE of the screen (behind the floating tab bar and the home
// indicator):
// - the top 32: a vertical fade, clear ground → ground (gradients.ctaBarFade's
//   colours, drawn across the whole band);
// - from the buttons' top down to the edge: SOLID ground, so no content shows
//   through the footer, in the gap or behind the glass tab bar.
// Phones (< 768): the lowest button sits 12 above the tab bar's top. ≥ 768
// (rail, no tab bar), or a screen without the tab bar (`overTabBar` false, the
// workout session): the screen's own `bottomGap` above the safe area.
// `onHeight` reports the measured height; the page's scroll room is exactly
// that (ShellPage `dockHeight`), so the last row scrolls clear above the fade.
// The buttons keep each screen's layout; below 21rem they stack (dockStacks).
// Reviewer carry (final batch, 27 Oct 2026): until the first onLayout the
// dock reports an ESTIMATE (fade + the body's top padding + `estimate`, the
// screen's buttons, + the bottom room), before the first paint, so no frame
// shows content under the dock while the page's scroll room is unknown.
export const DOCK_FADE_HEIGHT = 32;
export const DOCK_TAB_BAR_GAP = 12;
// 21rem: below it the pair stacks, gold 52 over glass 52, gap 10.
export const DOCK_STACK_BELOW = 336;
const FADE_STOPS = Object.freeze([0, 1]);

export const dockStacks = (width) => width < DOCK_STACK_BELOW;

// The buttons' block for the estimate: `rows` buttons of `buttonHeight`,
// `gap` apart (the stacked pair: 52 + 10 + 52).
export function dockButtonsHeight({ rows = 1, buttonHeight = BUTTON_HEIGHTS.default, gap = spacing['2_5'] } = {}) {
  return rows * buttonHeight + (rows - 1) * gap;
}

export function dockBottomPadding({ width, insetBottom = 0, overTabBar = true, bottomGap = 0 }) {
  if (overTabBar && width < breakpoints.md) {
    return insetBottom + TAB_BAR_CLEARANCE + DOCK_TAB_BAR_GAP;
  }
  return insetBottom + bottomGap;
}

export default function PinnedDock({ children, testID = 'pinned-dock', onHeight, overTabBar = true, bottomGap = 0, contentStyle, estimate = dockButtonsHeight() }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paddingBottom = dockBottomPadding({ width, insetBottom: insets.bottom, overTabBar, bottomGap });
  const body = StyleSheet.flatten(contentStyle) ?? {};
  const seed = DOCK_FADE_HEIGHT + (body.paddingTop ?? body.paddingVertical ?? body.padding ?? 0) + estimate + paddingBottom;
  const measured = useRef(false);
  useLayoutEffect(() => {
    if (!measured.current) {
      onHeight?.(seed);
    }
  }, [onHeight, seed]);
  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={styles.dock}
      onLayout={(event) => {
        measured.current = true;
        onHeight?.(event.nativeEvent.layout.height);
      }}
    >
      <View testID={`${testID}-fade`} pointerEvents="none" style={styles.fade}>
        <GradientFill angle={gradients.ctaBarFade.angle} colors={gradients.ctaBarFade.colors} stops={FADE_STOPS} />
      </View>
      <View testID={`${testID}-body`} style={[styles.body, contentStyle, { paddingBottom }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fade: {
    height: DOCK_FADE_HEIGHT,
  },
  body: {
    backgroundColor: colors.ground,
  },
});
