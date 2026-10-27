import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabletRail from './TabletRail';

// Tablet shell frame (≥ 768, both orientations; RN-SPEC-v2-foundation §3
// [O2], §7.2): a row of the fixed full-height rail and the page column. The
// rail takes the left safe-area inset; the column starts below the top inset
// (the status-bar band stays page background, as on phones). The page itself
// owns its scroller, gutters and the 1120 content cap.
export default function TabletFrame({ mode, path, children }) {
  const insets = useSafeAreaInsets();
  return (
    <View testID="tablet-frame" style={styles.row}>
      <TabletRail mode={mode} path={path} />
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
