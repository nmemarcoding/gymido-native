import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../shared/theme/tokens';

// STUB: the right side holds the notification bell (and, on tablets, the
// ModeSwitch) from docs/RN-SPEC-app-shell.md. Until then an empty slot of the
// assumed bell height keeps the compact header's height stable. No Admin pill:
// the owner ruled out admin UI on mobile.
const HEADER_ACTIONS_STUB_HEIGHT = 40;

function HeaderActionsStub() {
  return <View testID="header-actions-stub" style={styles.actions} />;
}

// S1 large-title header (RN-SPEC-plans §1.2). Scrolls with the page.
export function LargeTitleHeader({ title }) {
  return (
    <View style={styles.large}>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.largeTitle}>
        {title}
      </Text>
      <HeaderActionsStub />
    </View>
  );
}

// S2 compact header: no title, no back button, only the right-side actions.
export function CompactHeader() {
  return (
    <View style={styles.compact}>
      <HeaderActionsStub />
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 20,
  },
  largeTitle: {
    flexShrink: 1,
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  compact: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingBottom: 20,
  },
  actions: {
    height: HEADER_ACTIONS_STUB_HEIGHT,
  },
});
