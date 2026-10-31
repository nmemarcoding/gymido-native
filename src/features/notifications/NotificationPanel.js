import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import Loader from '../../shared/components/Loader';
import { breakpoints, colors, radii, shadows, typography } from '../../shared/theme/tokens';
import { openShellPath } from '../shell/shellLinks';
import { closePanel, useShellUiStore } from '../shell/shellUiStore';
import NotificationItem from './NotificationItem';
import { useNotificationStore } from './notificationStore';
import { ERROR_MESSAGE, ERROR_TITLE, pageBodyState } from './notificationsPageFormat';
import { CAP_BODY } from '../../shared/components/largeText';

// App-shell spec §7.4: phone → fixed 72 below the top inset (⚠S13), full
// width minus 12; tablet → anchored under the bell.
export default function NotificationPanel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bellFrame = useShellUiStore((state) => state.bellFrame);
  const tablet = width >= breakpoints.md;
  const { notifications, unreadCount, isLoading, error, hasMore, loadMore, fetchNotifications, markAllNotificationsAsRead } =
    useNotificationStore();
  const body = pageBodyState({ isLoading, notifications, error });
  const [filter, setFilter] = useState('all');
  const visible = filter === 'unread' ? notifications.filter((item) => !item.read_at) : notifications;
  const unreadLabel = unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread ';

  const position = tablet
    ? {
        top: (bellFrame?.y ?? 0) + (bellFrame?.height ?? 0) + 8,
        right: width - ((bellFrame?.x ?? width) + (bellFrame?.width ?? 0)),
        width: Math.min(384, width - 16),
      }
    : { top: insets.top + 72, left: 12, right: 12, maxHeight: height * 0.75 };

  return (
    <View testID="notification-panel" accessibilityRole="none" accessibilityLabel="Notifications" style={[styles.panel, position]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text {...CAP_BODY} style={styles.eyebrow}>Notifications</Text>
          <Text {...CAP_BODY} numberOfLines={1} textBreakStrategy="simple" style={styles.headTitle}>Recent activity</Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={markAllNotificationsAsRead}
            style={({ pressed }) => [styles.markAll, pressed && styles.markAllPressed]}
          >
            <Text {...CAP_BODY} style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>
      {/* §3 a11y: All / Unread are TABS (selected state); the list is the tab panel. */}
      <View accessibilityRole="tablist" style={styles.filters}>
        <FilterButton testID="notification-panel-tab-all" label="All" a11y="Show all notifications" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterButton
          testID="notification-panel-tab-unread"
          label={unreadLabel}
          a11y="Show unread notifications"
          active={filter === 'unread'}
          onPress={() => setFilter('unread')}
        />
      </View>
      <ScrollView style={tablet ? styles.listTablet : styles.listPhone}>
        {body === 'loading' ? (
          <Loader label="Loading notifications" style={styles.loading} />
        ) : body === 'error' ? (
          // Audit b1 X4: a failed load with nothing loaded; Retry refetches page 1.
          <View style={styles.empty}>
            <ErrorAlert
              testID="notification-panel-error"
              retryTestID="notification-panel-retry"
              title={ERROR_TITLE}
              description={ERROR_MESSAGE}
              onRetry={() => fetchNotifications(1)}
            />
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            {/* UX D row 9: the text switches with the filter, so it is a
                polite live region. */}
            <EmptyState
              live
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              message="You’re all caught up for now."
            />
          </View>
        ) : (
          <>
            {visible.map((item, index) => (
              <View key={item.id} style={index > 0 && styles.rowDivider}>
                <NotificationItem item={item} />
              </View>
            ))}
            {hasMore ? (
              <View style={styles.moreRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={loadMore}
                  style={({ pressed }) => [styles.more, pressed && styles.morePressed, isLoading && styles.moreDisabled]}
                >
                  <Text {...CAP_BODY} style={styles.moreText}>{isLoading ? 'Loading...' : 'Load More'}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          testID="notification-panel-view-all"
          accessibilityRole="link"
          onPress={() => {
            closePanel();
            openShellPath('/notifications');
          }}
        >
          {({ pressed }) => <Text {...CAP_BODY} style={[styles.viewAll, pressed && styles.viewAllPressed]}>View All Notifications →</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function FilterButton({ testID, label, a11y, active, onPress }) {
  return (
    <Pressable testID={testID} accessibilityRole="tab" accessibilityLabel={a11y} accessibilityState={{ selected: active }} onPress={onPress}>
      {({ pressed }) => (
        <Text {...CAP_BODY} style={[styles.filter, active ? styles.filterActive : pressed && styles.filterPressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  panel: {
    position: 'absolute',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headText: {
    flexShrink: 1,
  },
  // Kit Eyebrow: caption 12/600 gold, sentence case.
  eyebrow: typography.eyebrow,
  headTitle: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  markAll: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    justifyContent: 'center',
  },
  markAllPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  markAllText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filter: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    color: colors.textMuted,
  },
  filterActive: {
    borderBottomColor: colors.brand400,
    color: colors.textPrimary,
  },
  filterPressed: {
    color: colors.textPrimary,
  },
  listPhone: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listTablet: {
    maxHeight: 384,
  },
  loading: {
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  empty: {
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  moreRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  more: {
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  morePressed: {
    backgroundColor: colors.brand50,
  },
  moreDisabled: {
    opacity: 0.6,
  },
  moreText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand700,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  viewAll: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand700,
  },
  viewAllPressed: {
    color: colors.brand700,
  },
});
