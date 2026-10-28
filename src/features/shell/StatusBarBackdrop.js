import { StyleSheet, View } from 'react-native';
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
// Solid ground (colors.ground) with the blur where it is available; low-end Android
// (below API 31, the PM-approved 26 Oct fallback, see GlassSurface) draws the
// 0.96 ground and no blur. ShellPage draws it on phones, TabletFrame in the
// tablet content column (the rail column keeps its own top); Exercises and
// Create profile, which scroll without ShellPage, draw it themselves.
export default function StatusBarBackdrop() {
  const { top } = useSafeAreaInsets();
  if (!top) {
    return null;
  }
  const solid = usesSolidGlass();
  const fill = { backgroundColor: solid ? colors.groundFallback : colors.ground };
  // The fill also sits over the blur (as the Exercises sticky bar does), so
  // the dark blur tint never greys the band: it reads as the ground token.
  return (
    <View
      testID="status-bar-backdrop"
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.backdrop, fill, { height: top }]}
    >
      {solid ? null : (
        <>
          <BlurLayer blurPx={blur.groundBar} />
          <View style={[StyleSheet.absoluteFill, fill]} />
        </>
      )}
    </View>
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
