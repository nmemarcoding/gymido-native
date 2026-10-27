import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usesRail } from '../../shared/hooks/useLayoutClass';
import { RAIL } from './railMetrics';
import { useShellUiStore } from './shellUiStore';

// T-56: true when ShellOverlay draws the tablet rail: ≥ 768 (both
// orientations), except during a running workout (the rail hides there, as
// the phone tab bar does). Pages use the same rule to reserve its width, so
// there is never a gap without a rail or a rail over content.
export function useShowsRail() {
  const { width } = useWindowDimensions();
  const isSessionActive = useShellUiStore((state) => state.isSessionActive);
  return usesRail(width) && !isSessionActive;
}

// Tablet shell frame (≥ 768, both orientations; RN-SPEC-v2-foundation §3
// [O2], §7.2). T-56: the rail is no longer drawn here. ShellOverlay (the
// bottom-tabs tab bar, above every tab stack) draws ONE rail, so a stack
// push/pop slides the page and never the rail (web: only the rail is sticky).
// This frame reserves the rail's width (88 + the left safe-area inset) at the
// left of the page; the column starts below the top inset (the status-bar
// band stays page background, as on phones). The page itself owns its
// scroller, gutters and the 1120 content cap.
export default function TabletFrame({ children }) {
  const insets = useSafeAreaInsets();
  const showsRail = useShowsRail();
  return (
    <View testID="tablet-frame" style={[styles.row, { paddingLeft: showsRail ? RAIL.width + insets.left : 0 }]}>
      <View testID="tablet-frame-column" style={[styles.column, { paddingTop: insets.top }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
});
