import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import GradientFill from '../../shared/components/GradientFill';
import { CAP_BODY } from '../../shared/components/largeText';
import { formatRelativeTime } from '../../shared/time/relativeTime';
import { parseTimestamp } from '../../shared/time/timestamps';
import { colors, font, radii, spacing, typography } from '../../shared/theme/tokens';
import { openShellPath } from '../shell/shellLinks';
import { closePanel } from '../shell/shellUiStore';
import { useNotificationStore } from './notificationStore';
import { rowAccessibilityLabel } from './notificationsPageFormat';

// The notification row of app-shell §7.5 (web `NotificationItem`), shared by
// the bell panel and the Notifications page.
// v2 (UX L §Notifications / §Tablet): phone = a row inside the list card;
// `tablet` = its own card (unread gold-tinted). Icon art follows the canvas
// (invitation = person, workout = dumbbell, goal = trophy, default = bell);
// which types are told apart follows the code.

const GLYPHS = {
  workout: 'M4 13v6M9 10v12M23 10v12M28 13v6M9 16h14',
  trophy: 'M10 5h12v5a6 6 0 0 1-12 0V5zM10 7H6v2a4 4 0 0 0 4 4M22 7h4v2a4 4 0 0 1-4 4M16 16v5M11 27h10M13 21h6v6h-6z',
  people: 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 27c0-4 3-7 7-7s7 3 7 7M21 6a4 4 0 0 1 0 8M23 20c3 .6 5 3.3 5 7',
  person: 'M16 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM7 27c0-5 4-8 9-8s9 3 9 8',
  bell: 'M16 5a7 7 0 0 0-7 7v4l-2 3h18l-2-3v-4a7 7 0 0 0-7-7zM13 26a3 3 0 0 0 6 0',
};

// Tile = the colour's 14 % tint + the colour (UX L; teal accents as drawn, ND1).
export const TYPE_STYLES = Object.freeze({
  workout_completed: { tint: colors.goldTint, color: colors.gold, glyph: 'workout' },
  personal_record: { tint: colors.warningTint, color: colors.warning, glyph: 'trophy' },
  goal_achieved: { tint: colors.successTint, color: colors.success, glyph: 'trophy' },
  friend_activity: { tint: colors.tealTint, color: colors.teal, glyph: 'people' },
  trainer_invitation: { tint: colors.tealTint, color: colors.teal, glyph: 'person' },
});
export const DEFAULT_TYPE = Object.freeze({ tint: colors.infoTint, color: colors.info, glyph: 'bell' });

const CLOSE_PATH = 'M6 6l12 12M18 6L6 18';

// What a row tap does: mark it read when unread; a trainer invitation also
// closes the panel and opens My trainer (click rule, 23 Oct, owner).
export function rowTapActions(item) {
  return {
    markRead: !item?.read_at,
    openMyTrainer: item?.type === 'trainer_invitation',
  };
}

export default function NotificationItem({ item, tablet = false }) {
  const markNotificationAsRead = useNotificationStore((state) => state.markNotificationAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const unread = !item.read_at;
  const type = TYPE_STYLES[item.type] ?? DEFAULT_TYPE;
  const tile = tablet ? 52 : 40;

  const onPress = () => {
    const actions = rowTapActions(item);
    if (actions.markRead) {
      markNotificationAsRead(item.id);
    }
    if (actions.openMyTrainer) {
      closePanel();
      openShellPath('/my-trainer');
    }
  };

  return (
    <View
      testID={`notification-item-${item.id}`}
      style={[styles.item, tablet && styles.card, tablet && (unread ? styles.cardUnread : styles.cardRead)]}
    >
      {tablet ? (
        // The unread wash is always mounted (Android: a gradient is never
        // added on a state change); a read card hides it.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, !unread && styles.hidden]}>
          <GradientFill angle={150} colors={UNREAD_WASH} />
        </View>
      ) : null}
      {/* The row and Delete are sibling buttons: Delete is never nested in
          the row's button (§N a11y). */}
      <Pressable
        testID={`notification-row-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={rowAccessibilityLabel(item)}
        onPress={onPress}
        style={[styles.row, tablet && styles.rowTablet]}
      >
        {({ pressed }) => (
          <>
            {pressed ? <View testID={`notification-row-${item.id}-pressed`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
            <View
              testID={`notification-tile-${item.id}`}
              style={[
                styles.tile,
                { width: tile, height: tile, borderRadius: tablet ? radii.md : radii.sm, backgroundColor: unread ? type.tint : readTileFill(tablet) },
              ]}
            >
              <Svg width={tablet ? 24 : 20} height={tablet ? 24 : 20} viewBox="0 0 32 32" fill="none">
                <Path
                  d={GLYPHS[type.glyph]}
                  stroke={unread ? type.color : readTileInk(tablet)}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.text}>
              <View style={styles.titleRow}>
                {tablet && unread ? <View testID={`notification-dot-${item.id}`} style={[styles.dot, styles.dotInline]} /> : null}
                <Text {...CAP_BODY} style={[tablet ? styles.titleTablet : styles.title, !unread && styles.titleRead, tablet && !unread && styles.titleTabletRead]}>
                  {item.title || 'Notification'}
                </Text>
              </View>
              <Text {...CAP_BODY} numberOfLines={2} style={[styles.message, tablet && styles.messageTablet, !unread && styles.messageRead]}>
                {item.body || 'You have a new notification.'}
              </Text>
              <Text {...CAP_BODY} style={[styles.time, tablet && unread && styles.timeTabletUnread]}>
                {formatRelativeTime(parseTimestamp(item.created_at))}
              </Text>
            </View>
          </>
        )}
      </Pressable>
      <View style={[styles.side, tablet && styles.sideTablet]}>
        {!tablet && unread ? <View testID={`notification-dot-${item.id}`} style={styles.dot} /> : null}
        {/* v2 L ND3: Delete is always visible (tablet 44; phone 32 + hit slop). */}
        <Pressable
          testID={`notification-delete-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel="Delete notification"
          hitSlop={tablet ? undefined : DELETE_SLOP}
          onPress={() => removeNotification(item.id)}
          style={({ pressed }) => [
            styles.delete,
            tablet ? styles.deleteTablet : styles.deletePhone,
            { backgroundColor: tablet && !unread ? colors.fillWell : colors.fillGlass },
          ]}
        >
          {({ pressed }) => (
            <>
              {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.deletePressed]} /> : null}
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d={CLOSE_PATH} stroke={pressed ? colors.dangerText : colors.textMuted} strokeWidth={2.2} strokeLinecap="round" />
              </Svg>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// UX L tablet unread card: 150° gold 0.12 → 0.03, folded to the ladder's
// tint (0.14) → faint (0.08) (reported).
const UNREAD_WASH = Object.freeze([colors.goldTint, colors.goldFaint]);
const DELETE_SIZE_PHONE = 32;
const DELETE_SLOP = Object.freeze({ top: 6, bottom: 6, left: 6, right: 6 });

function readTileFill(tablet) {
  return tablet ? colors.fillGlass : colors.fillSkeleton;
}

function readTileInk(tablet) {
  return tablet ? colors.textSecondary : colors.textStrong2;
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  // Unread: the gold wash on the ground (no surface under it), as drawn.
  cardUnread: {
    borderColor: colors.goldLine,
    backgroundColor: 'transparent',
  },
  cardRead: {
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  hidden: {
    opacity: 0,
  },
  row: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingLeft: spacing[4],
    paddingRight: spacing[2],
  },
  rowTablet: {
    gap: spacing[4],
    paddingVertical: spacing['4_5'],
    paddingLeft: spacing['4_5'],
  },
  pressed: {
    backgroundColor: colors.pressOverlay,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    ...font(600),
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  titleTablet: {
    ...font(700),
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  titleRead: {
    color: colors.textStrong2,
  },
  titleTabletRead: {
    ...font(600),
  },
  message: {
    ...typography.bodySm,
    marginTop: 3,
    color: colors.textSecondary,
  },
  messageTablet: {
    lineHeight: 21,
    color: colors.textStrong2,
  },
  messageRead: {
    color: colors.textMuted,
  },
  time: {
    ...typography.caption,
    marginTop: spacing['1_5'],
    color: colors.textFaint,
  },
  timeTabletUnread: {
    color: colors.textMuted,
  },
  side: {
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[4] + spacing['1_5'],
    paddingRight: spacing[4],
  },
  sideTablet: {
    paddingTop: spacing['4_5'],
    paddingRight: spacing['4_5'],
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
  },
  dotInline: {
    flexShrink: 0,
  },
  delete: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  deletePhone: {
    width: DELETE_SIZE_PHONE,
    height: DELETE_SIZE_PHONE,
  },
  deleteTablet: {
    width: 44,
    height: 44,
  },
  // §8.6 state rule: pressed = the rest fill + the 4 % overlay.
  deletePressed: {
    borderRadius: radii.full,
    backgroundColor: colors.pressOverlay,
  },
});
