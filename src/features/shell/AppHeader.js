import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import BackPill from '../../shared/components/BackPill';
import { breakpoints, colors, spacing, textScale, typography } from '../../shared/theme/tokens';
import { mountBell } from '../notifications/bellPolling';
import NotificationBell from '../notifications/NotificationBell';
import ModeSwitch from './ModeSwitch';
import { getHeaderBackLink, getHeaderTitle, getHeroFallbackTitle, isCompactHeader } from './shellRules';
import { useShellUiStore } from './shellUiStore';
import { useInnerBack } from './useInnerBack';

// App-shell spec §6.1; v2 look RN-SPEC-v2-foundation §7.4 (title-xl on
// phones, display-md on tablets; back pill (ruling 6); bell top-right). The bell lives in a different spot in the full and
// compact variants, so changing variant remounts it (⚠S4): the focused
// screen's header tells the bell controller which variant is showing.
// Large text (UX §9): page titles scale at most 1.3×, wrap by word (max 3
// lines), and a single word too long for the line shrinks the title (down to
// 0.7×) instead of breaking inside it.
// `headerActions` (optional, FE batch 1 ruling): a page's own controls,
// right-aligned on the title row before the mode switch and the bell (the
// tablet Progress Body/Activity switch). The page still draws no title.
// `heroTitleShown` (§6.1, audit b1 X1): the page's own hero title is on
// screen (ShellPage's HeroTitleMark registry); until it is, a coaching /
// trainer page keeps the header title "Coaching" as its one heading.
const TITLE_TEXT = Object.freeze({
  textBreakStrategy: 'simple',
  maxFontSizeMultiplier: textScale.display,
  numberOfLines: 3,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.7,
});

export default function AppHeader({ path, query = '', mode, headerActions = null, heroTitleShown = false }) {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const compact = isCompactHeader(path, query);
  const tablet = width >= breakpoints.md;
  const sm = width >= breakpoints.sm;
  const isSessionActive = useShellUiStore((state) => state.isSessionActive);
  const title = getHeaderTitle(path, isSessionActive) || (heroTitleShown ? '' : getHeroFallbackTitle(path));
  const backLink = getHeaderBackLink(path, isSessionActive, mode);
  const navigation = useNavigation();
  // A157 / T-65 (PHONE-NAV spec §3 / §5): the back pill goes back in history,
  // else REPLACES to the link's parent; Android back the same (useInnerBack).
  const goBack = useInnerBack(navigation, backLink?.path ?? null);

  useEffect(() => {
    if (isFocused) {
      mountBell(compact ? 'compact' : 'full');
    }
  }, [isFocused, compact]);

  const actions = (
    <View style={[styles.actions, headerActions && styles.actionsWithSlot]}>
      {headerActions ? (
        <View testID="header-actions" style={styles.slot}>
          {headerActions}
        </View>
      ) : null}
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
        {title || backLink ? (
          // X1: a page that draws its own title keeps the back link, untitled.
          <View style={styles.titleColumn}>
            {backLink ? <BackLink label={backLink.label} onPress={goBack} /> : null}
            {title ? (
              <Text {...TITLE_TEXT} accessibilityRole="header" style={[styles.title, tablet && styles.titleTablet]}>
                {title}
              </Text>
            ) : null}
          </View>
        ) : (
          <View />
        )}
        {actions}
      </View>
    </View>
  );
}

// §6.1 back link (5-tab nav): above the H1, goes to that tab's root; the
// link's name is the parent. UX native final audit 27 Oct 2026, ruling 6
// (C307): the boards' glass pill "‹ {parent}" (kit BackPill, 44 phone / 40
// tablet), replacing the gold text link (R1's acceptance was web 834 only).
function BackLink({ label, onPress }) {
  return (
    <View style={styles.backBlock}>
      <BackPill testID="header-back-link" label={label.replace(/^←\s*/, '')} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  titleColumn: {
    flexShrink: 1,
  },
  backBlock: {
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
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
  // With a page slot the cluster may give up width (the slot shrinks before
  // the title has to); the bell keeps its size.
  actionsWithSlot: {
    flexShrink: 1,
    gap: 16,
  },
  slot: {
    flexShrink: 1,
  },
});
