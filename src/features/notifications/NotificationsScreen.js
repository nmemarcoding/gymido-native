import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import EmptyState from '../../shared/components/EmptyState';
import Loader from '../../shared/components/Loader';
import { breakpoints, colors, radii, shadows } from '../../shared/theme/tokens';
import ShellPage from '../shell/ShellPage';
import NotificationItem from './NotificationItem';
import { useNotificationStore } from './notificationStore';
import {
  EMPTY_MESSAGE,
  EMPTY_TITLE,
  loadMoreLabel,
  pageBodyState,
  showsLoadMore,
  unreadSubtitle,
} from './notificationsPageFormat';

// N1 (RN-SPEC-notifications). Reads the shared store, which is never reset
// here; every focus refetches page 1, replacing the list (⚠N-2). Errors stay
// in the store's `error`, which nothing shows (⚠N-1). No pull-to-refresh.
export default function NotificationsScreen() {
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  return (
    <ShellPage testID="notifications-screen">
      <View style={styles.column}>
        <NotificationsPage />
      </View>
    </ShellPage>
  );
}

function NotificationsPage() {
  const { width } = useWindowDimensions();
  const tablet = width >= breakpoints.md;
  const { notifications, unreadCount, isLoading, hasMore, loadMore, markAllNotificationsAsRead } = useNotificationStore();
  const body = pageBodyState({ isLoading, notifications });

  return (
    <View style={styles.page}>
      {/* Batch A A5: the eyebrow and title are gone; one wrapping row. */}
      <View style={styles.header}>
        <Text testID="notifications-unread" style={styles.subtitle}>
          {unreadSubtitle(unreadCount)}
        </Text>
        {unreadCount > 0 ? (
          <Pressable
            testID="notifications-mark-all"
            accessibilityRole="button"
            onPress={markAllNotificationsAsRead}
            style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>

      {body === 'loading' ? <Loader label="Loading notifications" style={styles.loader} /> : null}
      {body === 'empty' ? <EmptyState title={EMPTY_TITLE} message={EMPTY_MESSAGE} /> : null}
      {body === 'list' ? (
        // ⚠N-5: a 1px divider above every row after the first, plus each
        // row's own bottom border → 2px lines.
        <View testID="notifications-list" style={styles.listCard}>
          {notifications.map((item, index) => (
            <View key={item.id} style={index > 0 && styles.divider}>
              <NotificationItem item={item} tablet={tablet} />
            </View>
          ))}
        </View>
      ) : null}

      {showsLoadMore({ hasMore, notifications }) ? (
        <View style={styles.moreRow}>
          <Pressable
            testID="notifications-load-more"
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading }}
            disabled={isLoading}
            onPress={loadMore}
            style={({ pressed }) => [styles.more, pressed && styles.pressed, isLoading && styles.disabled]}
          >
            <Text style={styles.buttonText}>{loadMoreLabel(isLoading)}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
  },
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subtitle: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  markAll: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  loader: {
    alignSelf: 'center',
    paddingVertical: 48,
  },
  listCard: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadows.soft,
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moreRow: {
    alignItems: 'center',
  },
  more: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.6,
  },
});
