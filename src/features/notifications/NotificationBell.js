import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, font, radii } from '../../shared/theme/tokens';
import { useShellUiStore } from '../shell/shellUiStore';
import { useNotificationStore } from './notificationStore';

// v2 bell (Components 2 board): two strokes, 20 px, stroke 1.8.
const BELL_PATHS = ['M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'];

// App-shell spec §7.3. Tap toggles the panel; the bell's window frame
// anchors the panel on tablets. v2 look (RN-SPEC-v2-foundation §7.6, §4.2):
// a 44 glass icon button (white 0.07 fill, 0.10 hairline, primary icon) and a
// count badge on color-danger, white 11/700, "99+" cap, 2 px ring.
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
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        {BELL_PATHS.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={colors.textPrimary}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      {unreadCount > 0 ? (
        <View testID="notification-badge" style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    // §4.2 icon-button fill: white at 0.07.
    backgroundColor: colors.fillSkeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.fillButton,
    borderColor: colors.hairlineButton,
  },
  // 18 tall / min 18 wide inside a 2 px ring in the ground colour (RN draws the
  // ring as a border, so the box is 22 and sits 2 px further out than the board's).
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: radii.full,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    borderWidth: 2,
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
