import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { breakpoints, colors } from '../../shared/theme/tokens';
import { mountBell } from '../notifications/bellPolling';
import NotificationBell from '../notifications/NotificationBell';
import ModeSwitch from './ModeSwitch';
import { getHeaderTitle, isCompactHeader } from './shellRules';

// App-shell spec §6.1. The bell lives in a different spot in the full and
// compact variants, so changing variant remounts it (⚠S4): the focused
// screen's header tells the bell controller which variant is showing.
export default function AppHeader({ path, query = '', mode }) {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const compact = isCompactHeader(path, query);
  const tablet = width >= breakpoints.md;
  const sm = width >= breakpoints.sm;
  const title = getHeaderTitle(path);

  useEffect(() => {
    if (isFocused) {
      mountBell(compact ? 'compact' : 'full');
    }
  }, [isFocused, compact]);

  const actions = (
    <View style={styles.actions}>
      {tablet ? <ModeSwitch mode={mode} /> : null}
      <NotificationBell />
    </View>
  );

  const edge = tablet ? 0 : sm ? 20 : 16;
  const box = { marginHorizontal: -edge, paddingHorizontal: edge };

  if (compact) {
    return <View style={[box, styles.compact]}>{actions}</View>;
  }

  return (
    <View style={[box, styles.full]}>
      <View style={styles.row}>
        {title ? (
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : (
          <View />
        )}
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    paddingTop: 8,
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compact: {
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  title: {
    flexShrink: 1,
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
