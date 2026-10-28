import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BlurLayer from '../../shared/components/BlurLayer';
import { usesSolidGlass } from '../../shared/components/GlassSurface';
import { blur, colors } from '../../shared/theme/tokens';

// UX native final audit 27 Oct 2026, ruling 2 (rows A101, A105, C318): every
// scrolled screen gets a status-bar backdrop, so content never reads under
// the clock. One fixed layer, the height of the top safe-area inset, drawn
// AFTER the page's scroller in the same parent (so above the scroll). It has
// no zIndex or elevation: the tab bar / rail (ShellOverlay), the toasts
// (ToastHost, outside the navigator) and Modal windows still draw over it.
// Ruling 2 amendments (2) + (3), 27 Oct 2026: where blur exists (iOS,
// Android 31+) the fill is TRANSLUCENT (colors.groundTranslucent, 0.86) over
// a blur 20; low-end Android (below API 31, the PM-approved 26 Oct fallback,
// see GlassSurface) draws the 0.96 ground and no blur. ShellPage draws it on
// phones, TabletFrame in the tablet content column (the rail column keeps its
// own top); Exercises and Create profile, which scroll without ShellPage, draw
// it themselves.
export default function StatusBarBackdrop() {
  const { top } = useSafeAreaInsets();
  if (!top) {
    return null;
  }
  return <BackdropBand testID="status-bar-backdrop" height={top} />;
}

// The band itself, shared with the workout session's top band (ruling 2
// amendment 1, A116): absolute at the top edge, `height` tall, the blur
// under the fill (GlassSurface's order), never a touch target and hidden
// from screen readers. `opacity` may be an Animated value.
export function BackdropBand({ testID, height, opacity }) {
  const solid = usesSolidGlass();
  const fill = { backgroundColor: solid ? colors.groundFallback : colors.groundTranslucent };
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.backdrop, { height }, opacity === undefined ? null : { opacity }]}
    >
      {solid ? null : <BlurLayer blurPx={blur.statusBar} />}
      <View testID={testID ? `${testID}-fill` : undefined} style={[StyleSheet.absoluteFill, fill]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
