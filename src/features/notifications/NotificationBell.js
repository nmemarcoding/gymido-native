import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radii } from '../../shared/theme/tokens';
import { useShellUiStore } from '../shell/shellUiStore';
import { useNotificationStore } from './notificationStore';

const BELL_PATH =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

// App-shell spec §7.3. Tap toggles the panel; the bell's window frame
// anchors the panel on tablets.
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
    <Pressable
      ref={ref}
      testID="notification-bell"
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      accessibilityState={{ expanded: panelOpen }}
      onPress={toggle}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {({ pressed }) => (
        <>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d={BELL_PATH}
              stroke={pressed ? colors.textPrimary : colors.textSecondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: radii.full,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 11,
    fontWeight: '700',
    color: colors.onDanger,
  },
});
