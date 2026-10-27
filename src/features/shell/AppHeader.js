import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { breakpoints, colors, font, textScale, typography } from '../../shared/theme/tokens';
import { mountBell } from '../notifications/bellPolling';
import NotificationBell from '../notifications/NotificationBell';
import ModeSwitch from './ModeSwitch';
import { openShellPath } from './shellLinks';
import { getHeaderBackLink, getHeaderTitle, isCompactHeader } from './shellRules';
import { useShellUiStore } from './shellUiStore';

// App-shell spec §6.1; v2 look RN-SPEC-v2-foundation §7.4 (title-xl on
// phones, display-md on tablets; gold back link; bell top-right). The bell lives in a different spot in the full and
// compact variants, so changing variant remounts it (⚠S4): the focused
// screen's header tells the bell controller which variant is showing.
// Large text (UX §9): page titles scale at most 1.3×, wrap by word (max 3
// lines), and a single word too long for the line shrinks the title (down to
// 0.7×) instead of breaking inside it.
const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});

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
          <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.title, tablet && styles.titleTablet]}>
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
            <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.title, tablet && styles.titleTablet]}>
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

// §6.1 back link (5-tab nav): above the H1, v2 §7.4: 14/600 gold, min-height
// 32 with a 44 hit area; underlined (and the pressed gold) while pressed.
// Goes to that tab's root.
function BackLink({ label, onPress }) {
  return (
    <View style={styles.backBlock}>
      <Pressable testID="header-back-link" accessibilityRole="link" onPress={onPress} hitSlop={BACK_HIT_SLOP} style={styles.backLink}>
        {({ pressed }) => <Text style={[styles.backText, pressed && styles.backPressed]}>{label}</Text>}
      </Pressable>
    </View>
  );
}

// 32 tall + 6 above and below = the 44 hit area; 12 at the sides.
const BACK_HIT_SLOP = { top: 6, bottom: 6, left: 12, right: 12 };

const styles = StyleSheet.create({
  titleColumn: {
    flexShrink: 1,
  },
  backBlock: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  backLink: {
    minHeight: 32,
    justifyContent: 'center',
  },
  backText: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold,
  },
  backPressed: {
    color: colors.goldDeep,
    textDecorationLine: 'underline',
  },
  full: {
    paddingTop: 8,
    marginBottom: 24,
  },
  compact: {
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  compactTitled: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  title: {
    ...typography.titleXl,
    flexShrink: 1,
    color: colors.textPrimary,
  },
  // Tablet page title = display-lg 52 (UX, 26 Oct).
  titleTablet: typography.displayLg,
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
