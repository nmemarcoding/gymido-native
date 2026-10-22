import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import EmptyState from '../../shared/components/EmptyState';
import Loader from '../../shared/components/Loader';
import { env } from '../../shared/config/env';
import { formatRelativeTime } from '../../shared/time/relativeTime';
import { parseTimestamp } from '../../shared/time/timestamps';
import { breakpoints, colors, radii, shadows } from '../../shared/theme/tokens';
import { openShellPath } from '../shell/shellLinks';
import { closePanel, useShellUiStore } from '../shell/shellUiStore';
import { useNotificationStore } from './notificationStore';

// Every web build uses America/Los_Angeles; only local development leaves it
// unset (RN-SPEC-time §1.3).
const SERVER_TIME_ZONE = env.appEnv === 'development' || env.appEnv.startsWith('localtest') ? null : 'America/Los_Angeles';

const TYPE_STYLES = {
  workout_completed: { background: '#fef8e7', color: '#a07700', d: 'M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14' },
  personal_record: {
    background: '#fffbeb',
    color: '#bb4d00',
    d: 'M8 4h16v4a8 8 0 0 1-16 0V4zM8 6H4v2a4 4 0 0 0 4 4M24 6h4v2a4 4 0 0 1-4 4M12 21v4M20 21v4M9 28h14',
  },
  goal_achieved: { background: '#f0fdf4', color: '#008236', d: 'M16 4v6M16 22v6M4 16h6M22 16h6' },
  friend_activity: {
    background: '#e6f7f8',
    color: '#007e87',
    d: 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 27c0-4 3-7 7-7s7 3 7 7M21 6a4 4 0 0 1 0 8M23 20c3 .6 5 3.3 5 7',
  },
};
const DEFAULT_TYPE = {
  background: '#eff6ff',
  color: '#1447e6',
  d: 'M16 5a7 7 0 0 0-7 7v4l-2 3h18l-2-3v-4a7 7 0 0 0-7-7zM13 26a3 3 0 0 0 6 0',
};
const CLOSE_PATH =
  'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z';

// App-shell spec §7.4: phone → fixed 72 below the top inset (⚠S13), full
// width minus 12; tablet → anchored under the bell.
export default function NotificationPanel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bellFrame = useShellUiStore((state) => state.bellFrame);
  const tablet = width >= breakpoints.md;
  const { notifications, unreadCount, isLoading, hasMore, loadMore, markAllNotificationsAsRead } = useNotificationStore();
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
          <Text style={styles.eyebrow}>Notifications</Text>
          <Text style={styles.headTitle}>Recent activity</Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={markAllNotificationsAsRead}
            style={({ pressed }) => [styles.markAll, pressed && styles.markAllPressed]}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filters}>
        <FilterButton label="All" a11y="Show all notifications" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterButton
          label={unreadLabel}
          a11y="Show unread notifications"
          active={filter === 'unread'}
          onPress={() => setFilter('unread')}
        />
      </View>
      <ScrollView style={tablet ? styles.listTablet : styles.listPhone}>
        {isLoading && notifications.length === 0 ? (
          <Loader label="Loading notifications" style={styles.loading} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              message="You’re all caught up for now."
            />
          </View>
        ) : (
          <>
            {visible.map((item) => (
              <NotificationRow key={item.id} item={item} tablet={tablet} />
            ))}
            {hasMore ? (
              <View style={styles.moreRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={loadMore}
                  style={({ pressed }) => [styles.more, pressed && styles.morePressed, isLoading && styles.moreDisabled]}
                >
                  <Text style={styles.moreText}>{isLoading ? 'Loading...' : 'Load More'}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            closePanel();
            openShellPath('/notifications');
          }}
        >
          {({ pressed }) => <Text style={[styles.viewAll, pressed && styles.viewAllPressed]}>View All Notifications →</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function FilterButton({ label, a11y, active, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: active }} onPress={onPress}>
      {({ pressed }) => (
        <Text style={[styles.filter, active ? styles.filterActive : pressed && styles.filterPressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

function NotificationRow({ item, tablet }) {
  const markNotificationAsRead = useNotificationStore((state) => state.markNotificationAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const unread = !item.read_at;
  const type = TYPE_STYLES[item.type] ?? DEFAULT_TYPE;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title ? `Notification: ${item.title}` : 'Notification'}
      onPress={() => unread && markNotificationAsRead(item.id)}
      style={({ pressed }) => [
        styles.row,
        unread ? styles.rowUnread : styles.rowRead,
        pressed && (unread ? styles.rowUnreadPressed : styles.rowReadPressed),
      ]}
    >
      {({ pressed }) => (
        <>
          {unread ? <View style={styles.unreadBar} /> : null}
          <View style={styles.rowInner}>
            <View style={[styles.iconTile, { backgroundColor: type.background }]}>
              <Svg width={20} height={20} viewBox="0 0 32 32" fill="none">
                <Path d={type.d} stroke={type.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { fontWeight: unread ? '600' : '500' }]}>{item.title || 'Notification'}</Text>
                <Text numberOfLines={2} style={styles.rowMessage}>
                  {item.body || 'You have a new notification.'}
                </Text>
                <Text style={styles.rowTime}>{formatRelativeTime(parseTimestamp(item.created_at, SERVER_TIME_ZONE))}</Text>
              </View>
              {/* ⚠S12: on tablets invisible until the row is pressed, but always tappable. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete notification"
                onPress={() => removeNotification(item.id)}
                style={({ pressed: deletePressed }) => [
                  styles.delete,
                  deletePressed && styles.deletePressed,
                  tablet && !pressed && !deletePressed && styles.deleteHidden,
                ]}
              >
                {({ pressed: deletePressed }) => (
                  <Svg width={16} height={16} viewBox="0 0 20 20">
                    <Path fill={deletePressed ? colors.danger : colors.textMuted} fillRule="evenodd" d={CLOSE_PATH} />
                  </Svg>
                )}
              </Pressable>
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    borderRadius: radii.xxxl,
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
  eyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand600,
  },
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
    borderRadius: radii.xl,
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
    color: colors.brand600,
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
    color: colors.brand600,
  },
  viewAllPressed: {
    color: colors.brand700,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowUnread: {
    backgroundColor: colors.brand50,
  },
  rowUnreadPressed: {
    backgroundColor: '#fcefc4',
  },
  rowRead: {
    backgroundColor: colors.surface,
  },
  rowReadPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  unreadBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.brand400,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.xxl,
    boxShadow: shadows.insetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  rowMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  rowTime: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
  delete: {
    padding: 8,
    borderRadius: radii.full,
  },
  deletePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  deleteHidden: {
    opacity: 0,
  },
});
