import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePhoneTabBar, useScreenFocused } from '../../features/shell/phoneTabBar';
import { usePhoneChromeStore } from '../../features/shell/phoneChromeStore';
import { TAB_BAR_CLEARANCE } from '../../features/shell/tabBarMetrics';
import { useKeyboardOverlap } from '../hooks/useKeyboardHeight';
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
// T-65 (PHONE-NAV spec §4, 27 Oct 2026): the tab bar is on the main tab pages
// only, so by default the dock follows the same rule (usePhoneTabBar of its
// screen's route): over the bar on a main page; on an inner page (no bar) the
// buttons end 12 above the safe area (`innerPage`, the edge gap). An explicit
// `overTabBar` still overrides it (the session dock: false + its own gap).
// The focused page's dock height is published (phoneChromeStore.pageDock) so the
// toasts sit above it.
// dock reports an ESTIMATE (fade + the body's top padding + `estimate`, the
// screen's buttons, + the bottom room), before the first paint, so no frame
// shows content under the dock while the page's scroll room is unknown.
// `liftWithKeyboard` (opt-in; T-74, QA L1 candidate 2941880): while the
// keyboard covers the window, the buttons sit DOCK_TAB_BAR_GAP above its top
// edge (the overlap, as AppModal lifts its footer) instead of over the tab bar
// / safe area, so a form's dock (trainer Create plan) stays visible above the
// keyboard. The page's scroll room (`onHeight`) stays the un-lifted height:
// iOS already insets the scroll by the keyboard and ShellPage pads Android by
// the overlap, so the lift is not counted twice. The toasts get the full one.
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

// The extra bottom padding that lifts the buttons above an open keyboard
// (0 when closed, or when the normal padding already clears it).
export function dockKeyboardLift({ keyboardOverlap = 0, paddingBottom = 0 }) {
  if (!(keyboardOverlap > 0)) {
    return 0;
  }
  return Math.max(0, keyboardOverlap + DOCK_TAB_BAR_GAP - paddingBottom);
}

export function dockBottomPadding({ width, insetBottom = 0, overTabBar = true, bottomGap = 0, innerPage = false }) {
  if (width < breakpoints.md) {
    if (overTabBar) {
      return insetBottom + TAB_BAR_CLEARANCE + DOCK_TAB_BAR_GAP;
    }
    if (innerPage) {
      return insetBottom + DOCK_TAB_BAR_GAP;
    }
  }
  return insetBottom + bottomGap;
}

export default function PinnedDock({ children, testID = 'pinned-dock', onHeight, overTabBar, bottomGap = 0, contentStyle, estimate = dockButtonsHeight(), liftWithKeyboard = false }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const phoneTabBar = usePhoneTabBar();
  const derived = overTabBar === undefined;
  const paddingBottom = dockBottomPadding({
    width,
    insetBottom: insets.bottom,
    overTabBar: derived ? phoneTabBar : overTabBar,
    bottomGap,
    innerPage: derived && !phoneTabBar,
  });
  const keyboardOverlap = useKeyboardOverlap();
  const lift = liftWithKeyboard ? dockKeyboardLift({ keyboardOverlap, paddingBottom }) : 0;
  const body = StyleSheet.flatten(contentStyle) ?? {};
  const seed = DOCK_FADE_HEIGHT + (body.paddingTop ?? body.paddingVertical ?? body.padding ?? 0) + estimate + paddingBottom;
  const measured = useRef(false);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    if (!measured.current) {
      onHeight?.(seed);
    }
  }, [onHeight, seed]);
  usePublishedDock(height ?? seed + lift);
  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={styles.dock}
      onLayout={(event) => {
        measured.current = true;
        setHeight(event.nativeEvent.layout.height);
        // The scroll room leaves the keyboard lift out (see liftWithKeyboard).
        onHeight?.(Math.max(0, event.nativeEvent.layout.height - lift));
      }}
    >
      <View testID={`${testID}-fade`} pointerEvents="none" style={styles.fade}>
        <GradientFill angle={gradients.ctaBarFade.angle} colors={gradients.ctaBarFade.colors} stops={FADE_STOPS} />
      </View>
      <View testID={`${testID}-body`} style={[styles.body, contentStyle, { paddingBottom: paddingBottom + lift }]}>
        {children}
      </View>
    </View>
  );
}

// The focused screen's dock (its full height, edge included) for the toasts;
// a blurred or unmounted dock withdraws it.
function usePublishedDock(height) {
  const id = useId();
  const focused = useScreenFocused();
  const setPageDock = usePhoneChromeStore((state) => state.setPageDock);
  const clearPageDock = usePhoneChromeStore((state) => state.clearPageDock);
  useEffect(() => {
    if (!focused) {
      return undefined;
    }
    setPageDock({ id, height });
    return () => clearPageDock(id);
  }, [focused, height, id, setPageDock, clearPageDock]);
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
