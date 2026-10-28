import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE } from '../../features/shell/tabBarMetrics';
import { breakpoints, colors, gradients } from '../theme/tokens';
import GradientFill from './GradientFill';

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
export const DOCK_FADE_HEIGHT = 32;
export const DOCK_TAB_BAR_GAP = 12;
// 21rem: below it the pair stacks, gold 52 over glass 52, gap 10.
export const DOCK_STACK_BELOW = 336;
const FADE_STOPS = Object.freeze([0, 1]);

export const dockStacks = (width) => width < DOCK_STACK_BELOW;

export function dockBottomPadding({ width, insetBottom = 0, overTabBar = true, bottomGap = 0 }) {
  if (overTabBar && width < breakpoints.md) {
    return insetBottom + TAB_BAR_CLEARANCE + DOCK_TAB_BAR_GAP;
  }
  return insetBottom + bottomGap;
}

export default function PinnedDock({ children, testID = 'pinned-dock', onHeight, overTabBar = true, bottomGap = 0, contentStyle }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paddingBottom = dockBottomPadding({ width, insetBottom: insets.bottom, overTabBar, bottomGap });
  return (
    <View testID={testID} pointerEvents="box-none" style={styles.dock} onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}>
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
