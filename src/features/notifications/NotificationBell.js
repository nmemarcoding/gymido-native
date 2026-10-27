import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import IconButton from '../../shared/components/IconButton';
import { colors, font, radii, textScale } from '../../shared/theme/tokens';
import { useShellUiStore } from '../shell/shellUiStore';
import { useNotificationStore } from './notificationStore';

const BELL_PATH =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

// The bell's name carries the count, as the board's aria-label does
// ("Notifications, 2 unread"; PM web parity).
export function bellLabel(unreadCount) {
  return unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';
}

// App-shell spec §7.3 (behaviour) and v2 §7.6: a 44 icon button (§4.2).
// Tap toggles the panel; the bell's window frame anchors the panel on tablets.
export default function NotificationBell() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const panelOpen = useShellUiStore((state) => state.panelOpen);
  const ref = useRef(null);

  function toggle() {
    const { setPanelOpen, setBellFrame } = useShellUiStore.getState();
    ref.current?.measureInWindow((x, y, width, height) => setBellFrame({ x, y, width, height }));
    setPanelOpen(!panelOpen);
  }

  return (
    <IconButton
      ref={ref}
      testID="notification-bell"
      accessibilityLabel={bellLabel(unreadCount)}
      accessibilityState={{ expanded: panelOpen }}
      onPress={toggle}
    >
      {({ color }) => (
        <>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d={BELL_PATH} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text maxFontSizeMultiplier={textScale.badge} style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </IconButton>
  );
}

// §7.6 count badge: danger fill, white 11/700, a 2 px ring in the ground
// colour (UX: the bell sits on the ground) drawn as a border outside the badge.
// Large text (UX §9): anchored to the button's top-right corner, 4 outside it,
// at least 20 × 20, the count scales at most 1.2× and the 44 button never
// scales, so the badge never covers the bell. No fixed height (min only).
const RING = 2;

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20 + RING * 2,
    minHeight: 20 + RING * 2,
    borderRadius: radii.full,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    borderWidth: RING,
    borderColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...font(700),
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
    color: colors.onDanger,
  },
});
