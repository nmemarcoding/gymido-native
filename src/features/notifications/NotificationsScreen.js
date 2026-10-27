import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardHeroFill } from '../../shared/components/Card';
import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import GradientFill from '../../shared/components/GradientFill';
import { CAP_BODY, useLargeTextReflow } from '../../shared/components/largeText';
import Loader from '../../shared/components/Loader';
import PillButton from '../../shared/components/PillButton';
import StateSlot from '../../shared/components/StateSlot';
import { parseTimestamp } from '../../shared/time/timestamps';
import { breakpoints, colors, font, gradients, radii, spacing, textScale } from '../../shared/theme/tokens';
import ShellPage from '../shell/ShellPage';
import NotificationItem from './NotificationItem';
import { useNotificationStore } from './notificationStore';
import {
  EMPTY_MESSAGE,
  EMPTY_TITLE,
  ERROR_MESSAGE,
  ERROR_TITLE,
  groupByLocalDay,
  loadMoreLabel,
  pageBodyState,
  showsLoadMore,
  unreadBadge,
} from './notificationsPageFormat';

export const NOTIFICATIONS_COLUMN_MAX = 660;
// UX L §Tablet: the gold page glow (0.18 = the gold-ambient ladder step).
export const NOTIFICATIONS_GLOW_TABLET = Object.freeze({
  radial: { cx: 0.85, cy: -0.08, rx: 0.7, ry: 0.4 },
  colors: gradients.goldAmbient.colors,
  stops: [0, 0.6],
});

// N1 (RN-SPEC-notifications). Reads the shared store, which is never reset
// here; every focus refetches page 1, replacing the list (⚠N-2). A failed
// load with no items shows the ErrorAlert + Retry (audit b1 X4; ⚠N-1 retired);
// with items loaded an error changes nothing. No pull-to-refresh.
// The shell title "Notifications" is the page's one h1 (no second title).
export default function NotificationsScreen() {
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const tablet = useWindowDimensions().width >= breakpoints.md;

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  return (
    <ShellPage testID="notifications-screen" glow={tablet ? NOTIFICATIONS_GLOW_TABLET : false}>
      <View style={styles.column}>
        <NotificationsPage tablet={tablet} />
      </View>
    </ShellPage>
  );
}

// N1.2 "You have {n} unread notification(s)." with the count in gold 700;
// a polite live region so a change is announced. iOS has no live region, so
// a changed count (e.g. after Mark all as read) is announced there instead
// (review LOW); the first render is not.
function UnreadLine({ count, tablet }) {
  const noun = `unread notification${count === 1 ? '' : 's'}.`;
  const previous = useRef(count);
  useEffect(() => {
    if (previous.current !== count && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`You have ${count} ${noun}`);
    }
    previous.current = count;
  }, [count, noun]);
  return (
    <Text {...CAP_BODY} testID="notifications-unread" accessibilityLiveRegion="polite" style={[styles.line, tablet && styles.lineTablet]}>
      You have <Text style={styles.count}>{count}</Text> {noun}
    </Text>
  );
}

function MarkAll({ onPress, tablet }) {
  return (
    <PillButton
      testID="notifications-mark-all"
      title="Mark all as read"
      variant="secondary"
      size="compact"
      style={tablet ? styles.markAllTablet : styles.markAll}
      onPress={onPress}
    />
  );
}

function NotificationsPage({ tablet }) {
  const { notifications, unreadCount, isLoading, error, hasMore, loadMore, fetchNotifications, markAllNotificationsAsRead } =
    useNotificationStore();
  const reflow = useLargeTextReflow();
  const body = pageBodyState({ isLoading, notifications, error });
  const markAll = unreadCount > 0 ? <MarkAll tablet={tablet} onPress={markAllNotificationsAsRead} /> : null;

  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {tablet ? (
        <View testID="notifications-hero" style={[styles.hero, reflow && styles.heroStacked]}>
          <CardHeroFill />
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroGlow}>
            <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={gradients.heroGlow.stops} />
          </View>
          <BellTile count={unreadCount} />
          <View style={styles.heroText}>
            <UnreadLine count={unreadCount} tablet />
          </View>
          {markAll}
        </View>
      ) : (
        <View style={styles.header}>
          <UnreadLine count={unreadCount} />
          {markAll}
        </View>
      )}

      {/* §D1: whole-page states sit in the 640 column under the header. */}
      {body === 'loading' ? (
        <StateSlot>
          <Loader label="Loading notifications" style={styles.loader} />
        </StateSlot>
      ) : null}
      {body === 'error' ? (
        <StateSlot>
          <ErrorAlert
            testID="notifications-error"
            retryTestID="notifications-retry"
            title={ERROR_TITLE}
            description={ERROR_MESSAGE}
            onRetry={() => fetchNotifications(1)}
          />
        </StateSlot>
      ) : null}
      {body === 'empty' ? (
        <StateSlot>
          <EmptyState title={EMPTY_TITLE} message={EMPTY_MESSAGE} />
        </StateSlot>
      ) : null}
      {body === 'list' && tablet ? (
        // Tablet: one card per row, no day headings (ND2 is phone only).
        <View testID="notifications-list" style={styles.cards}>
          {notifications.map((item) => (
            <NotificationItem key={item.id} item={item} tablet />
          ))}
        </View>
      ) : null}
      {body === 'list' && !tablet ? (
        <View testID="notifications-list" style={styles.groups}>
          {groupByLocalDay(notifications, new Date(), parseTimestamp).map((group) => (
            <View key={group.key} testID={`notifications-group-${group.key}`} style={styles.group}>
              <Text {...CAP_BODY} accessibilityRole="header" style={styles.groupLabel}>
                {group.label}
              </Text>
              <View style={styles.listCard}>
                {group.items.map((item, index) => (
                  <View key={item.id} style={index > 0 && styles.divider}>
                    <NotificationItem item={item} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {showsLoadMore({ hasMore, notifications }) ? (
        <View style={styles.moreRow}>
          <PillButton
            testID="notifications-load-more"
            title={loadMoreLabel(isLoading)}
            variant="secondary"
            disabled={isLoading}
            fullWidth={!tablet}
            style={tablet && styles.moreTablet}
            onPress={loadMore}
          />
        </View>
      ) : null}
    </View>
  );
}

// The tablet hero's gold bell tile with the unread badge ("99+" cap; hidden
// at 0; hidden from AT: the unread line announces the count).
function BellTile({ count }) {
  const badge = unreadBadge(count);
  return (
    <View testID="notifications-bell-tile" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.bellTile}>
      <View style={styles.bellFill}>
        <GradientFill angle={gradients.goldAvatar.angle} colors={gradients.goldAvatar.colors} />
        <Svg width={40} height={40} viewBox="0 0 32 32" fill="none">
          <Path
            d="M16 5a7 7 0 0 0-7 7v4l-2 3h18l-2-3v-4a7 7 0 0 0-7-7zM13 26a3 3 0 0 0 6 0"
            stroke={colors.onGold}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      {badge ? (
        <View testID="notifications-badge" style={styles.badge}>
          <Text maxFontSizeMultiplier={textScale.badge} style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const BELL_TILE = 96;

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: NOTIFICATIONS_COLUMN_MAX,
    alignSelf: 'center',
  },
  page: {
    gap: spacing['3_5'],
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing[4],
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  line: {
    ...font(400),
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  lineTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  count: {
    ...font(700),
    color: colors.gold,
  },
  markAll: {
    flexShrink: 0,
  },
  markAllTablet: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  hero: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['5_5'],
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.choiceBorder,
    padding: 26,
  },
  // UX §9 reflow: past 1.3× the hero stacks (the action drops below).
  heroStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  heroGlow: {
    position: 'absolute',
    top: -130,
    right: -130,
    width: 260,
    height: 260,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  bellTile: {
    width: BELL_TILE,
    height: BELL_TILE,
  },
  // The drawn radius 30 has no token: folded to radii.xxl 28 (reported).
  bellFill: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xxl,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 34,
    minHeight: 34,
    paddingHorizontal: spacing['1_5'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.ground,
  },
  badgeText: {
    ...font(700),
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  groups: {
    gap: spacing['3_5'],
  },
  group: {
    gap: spacing[2],
  },
  groupLabel: {
    ...font(600),
    marginTop: spacing[2],
    paddingHorizontal: spacing[1],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  // The drawn 0.06 divider folds to the hairline step (0.07).
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  cards: {
    gap: spacing['2_5'],
  },
  moreRow: {
    alignItems: 'center',
  },
  moreTablet: {
    paddingHorizontal: spacing[7],
  },
});
