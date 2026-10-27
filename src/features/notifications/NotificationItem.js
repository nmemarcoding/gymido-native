import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatRelativeTime } from '../../shared/time/relativeTime';
import { parseTimestamp } from '../../shared/time/timestamps';
import { colors, radii, shadows } from '../../shared/theme/tokens';
import { openShellPath } from '../shell/shellLinks';
import { closePanel } from '../shell/shellUiStore';
import { useNotificationStore } from './notificationStore';

// The notification row of app-shell §7.5 (web `NotificationItem`), shared by
// the bell panel and the Notifications page.


const TYPE_STYLES = {
  workout_completed: { background: colors.brand50, color: colors.brand600, d: 'M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14' },
  personal_record: {
    background: colors.warningFill,
    color: colors.warning700,
    d: 'M8 4h16v4a8 8 0 0 1-16 0V4zM8 6H4v2a4 4 0 0 0 4 4M24 6h4v2a4 4 0 0 1-4 4M12 21v4M20 21v4M9 28h14',
  },
  goal_achieved: { background: colors.successFill, color: colors.successText, d: 'M16 4v6M16 22v6M4 16h6M22 16h6' },
  friend_activity: {
    background: colors.tealFill,
    color: colors.tealText,
    d: 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 27c0-4 3-7 7-7s7 3 7 7M21 6a4 4 0 0 1 0 8M23 20c3 .6 5 3.3 5 7',
  },
};
const DEFAULT_TYPE = {
  background: colors.infoFill,
  color: colors.infoText,
  d: 'M16 5a7 7 0 0 0-7 7v4l-2 3h18l-2-3v-4a7 7 0 0 0-7-7zM13 26a3 3 0 0 0 6 0',
};
const CLOSE_PATH =
  'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z';

// What a row tap does: mark it read when unread; a trainer invitation also
// closes the panel and opens My trainer (click rule, 23 Oct, owner).
export function rowTapActions(item) {
  return {
    markRead: !item?.read_at,
    openMyTrainer: item?.type === 'trainer_invitation',
  };
}

export default function NotificationItem({ item, tablet }) {
  const markNotificationAsRead = useNotificationStore((state) => state.markNotificationAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const unread = !item.read_at;
  const type = TYPE_STYLES[item.type] ?? DEFAULT_TYPE;

  return (
    <Pressable
      testID={`notification-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={item.title ? `Notification: ${item.title}` : 'Notification'}
      onPress={() => {
        const actions = rowTapActions(item);
        if (actions.markRead) {
          markNotificationAsRead(item.id);
        }
        if (actions.openMyTrainer) {
          closePanel();
          openShellPath('/my-trainer');
        }
      }}
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
                <Text style={styles.rowTime}>{formatRelativeTime(parseTimestamp(item.created_at))}</Text>
              </View>
              {/* ⚠S12: on tablets invisible until the row is pressed, but always tappable. */}
              <Pressable
                testID={`notification-delete-${item.id}`}
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
    backgroundColor: colors.brandTintStrong,
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
