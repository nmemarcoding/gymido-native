import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { breakpoints, colors } from '../../shared/theme/tokens';
import { mountBell } from '../notifications/bellPolling';
import NotificationBell from '../notifications/NotificationBell';
import ModeSwitch from './ModeSwitch';
import { openShellPath } from './shellLinks';
import { getHeaderBackLink, getHeaderTitle, isCompactHeader } from './shellRules';
import { useShellUiStore } from './shellUiStore';

// App-shell spec §6.1. The bell lives in a different spot in the full and
// compact variants, so changing variant remounts it (⚠S4): the focused
// screen's header tells the bell controller which variant is showing.
export default function AppHeader({ path, query = '', mode }) {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const compact = isCompactHeader(path, query);
  const tablet = width >= breakpoints.md;
  const sm = width >= breakpoints.sm;
  const isSessionActive = useShellUiStore((state) => state.isSessionActive);
  const title = getHeaderTitle(path, isSessionActive);
  const backLink = getHeaderBackLink(path, isSessionActive);

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
    // Nav polish (23 Oct): the phone Exercises root also shows its H1, pushed
    // left; tablets and every other compact route stay untitled.
    const exercisesTitle = path === '/exercises' && !tablet;
    return (
      <View style={[box, styles.compact, exercisesTitle && styles.compactTitled]}>
        {exercisesTitle ? (
          <Text accessibilityRole="header" style={styles.title}>
            Exercises
          </Text>
        ) : null}
        {actions}
      </View>
    );
  }

  return (
    <View style={[box, styles.full]}>
      <View style={styles.row}>
        {title ? (
          <View style={styles.titleColumn}>
            {backLink ? <BackLink label={backLink.label} onPress={() => openShellPath(backLink.path)} /> : null}
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          </View>
        ) : (
          <View />
        )}
        {actions}
      </View>
    </View>
  );
}

// §6.1 back link (5-tab nav): above the H1, 14px / 700 brand-700, underlined
// while pressed, 44 pt touch height (A3). Goes to that tab's root.
function BackLink({ label, onPress }) {
  return (
    <View style={styles.backBlock}>
      <Pressable testID="header-back-link" accessibilityRole="link" onPress={onPress} hitSlop={12}>
        {({ pressed }) => <Text style={[styles.backText, pressed && styles.backPressed]}>{label}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  titleColumn: {
    flexShrink: 1,
  },
  backBlock: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
  backPressed: {
    textDecorationLine: 'underline',
  },
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
  compactTitled: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
