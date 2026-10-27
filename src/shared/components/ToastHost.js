import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, font, layout, motion, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import GlassSurface from './GlassSurface';
import { ToastTone, useToastStore } from './toastStore';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// RN-SPEC-v2-foundation §5: the glass carries no tone; the icon does.
export const TOAST_TONES = Object.freeze({
  [ToastTone.success]: Object.freeze({ icon: 'check', color: colors.success }),
  [ToastTone.error]: Object.freeze({ icon: 'error', color: colors.dangerText }),
  [ToastTone.info]: Object.freeze({ icon: 'info', color: colors.info }),
  [ToastTone.warning]: Object.freeze({ icon: 'warning', color: colors.warning }),
});

// The phone tab bar (RN-SPEC-v2-foundation §7.1): 66 tall, floating 20 above
// the bottom safe area, so 86 clears it. The shell exports no clearance yet,
// so the toast keeps its own copy of the spec numbers and ShellOverlay's
// width rule (the bar shows below 768 wide). Phones always keep the
// clearance, so a toast can never sit under the bar.
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_BOTTOM_OFFSET = 20;
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET;
export const TOAST_GAP = spacing[3];
export const TOAST_TABLET_MAX_WIDTH = 384;

// Where the stack sits: phones, bottom-centre ABOVE the floating tab bar
// (never under it); tablets, bottom-right. Safe-area insets added [O2].
export function toastPlacement({ width, insets }) {
  if (width >= breakpoints.md) {
    const edge = spacing[6];
    return {
      tablet: true,
      bottom: edge + insets.bottom,
      left: edge + insets.left,
      right: edge + insets.right,
    };
  }
  return {
    tablet: false,
    bottom: TAB_BAR_CLEARANCE + TOAST_GAP + insets.bottom,
    left: layout.gutter + insets.left,
    right: layout.gutter + insets.right,
  };
}

// App-shell spec §8: a stack above everything including the tab bar (⚠S6).
export default function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (toasts.length === 0) {
    return null;
  }

  const place = toastPlacement({ width, insets });
  return (
    <View
      testID="toast-stack"
      pointerEvents="box-none"
      style={[
        styles.container,
        place.tablet ? styles.containerTablet : styles.containerPhone,
        { paddingBottom: place.bottom, paddingLeft: place.left, paddingRight: place.right },
      ]}
    >
      {toasts.map((toast, index) => (
        <SlideUp key={`${toast.id}-${index}`} style={place.tablet ? styles.rowTablet : styles.rowPhone}>
          {/* Outside the app's BlurTargetView, so it may blur the app behind it. */}
          <ToastCard tone={toast.tone} title={toast.title} message={toast.message} onClose={() => removeToast(toast.id)} overApp />
        </SlideUp>
      ))}
    </View>
  );
}

function SlideUp({ children, style }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slideUpMs,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [motion.slideUpOffsetY, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// Web toasts are role=status / aria-live polite. Android announces through
// the view's accessibilityLiveRegion; iOS has no live regions, so it gets
// an explicit announcement (announcing on Android too would read it twice).
function announcePolitely(parts) {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(parts.filter(Boolean).join(' '));
  }
}

// The glass toast. One line (title OR message): a 52 px pill, 15/500.
// Title + message: radius 20, title 14/600 over the message 13 muted.
export function ToastCard({ tone, title, message, onClose, overApp = false, testID, style }) {
  const look = TOAST_TONES[tone] ?? TOAST_TONES[ToastTone.info];
  const oneLine = !(title && message);

  useEffect(() => {
    announcePolitely([title, message]);
  }, [title, message]);

  return (
    <GlassSurface
      tone="toast"
      overApp={overApp}
      radius={oneLine ? radii.full : radii.lg}
      style={[styles.card, oneLine ? styles.cardPill : styles.cardStacked, style]}
    >
      <View style={oneLine ? null : styles.iconStacked}>
        <FeedbackIcon testID="toast-icon" name={look.icon} size={18} color={look.color} />
      </View>
      <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.text}>
        {oneLine ? (
          <Text style={styles.line}>{title || message}</Text>
        ) : (
          <>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
      </View>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close notification"
          onPress={onClose}
          hitSlop={(layout.touchMin - CLOSE_SIZE) / 2}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          {({ pressed }) => <FeedbackIcon name="close" size={16} color={pressed ? colors.textPrimary : colors.textMuted} />}
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

// A page-level toast: the same glass card rendered in place, without the
// close button (app-shell spec §8; plans §4.7, workout §3.5).
export function InlineToast({ tone, title, message, testID, style }) {
  return (
    <SlideUp style={style}>
      <ToastCard tone={tone} title={title} message={message} testID={testID} />
    </SlideUp>
  );
}

const CLOSE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    gap: TOAST_GAP,
  },
  containerPhone: {
    alignItems: 'center',
  },
  containerTablet: {
    alignItems: 'flex-end',
  },
  rowPhone: {
    maxWidth: '100%',
  },
  rowTablet: {
    maxWidth: TOAST_TABLET_MAX_WIDTH,
  },
  card: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  cardPill: {
    minHeight: 52,
    alignItems: 'center',
    paddingHorizontal: spacing['4_5'],
    paddingVertical: spacing['1_5'],
  },
  cardStacked: {
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  iconStacked: {
    marginTop: 1,
  },
  text: {
    flexShrink: 1,
  },
  line: {
    ...font(500),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  title: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  message: {
    ...font(400),
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    marginRight: -spacing['1_5'],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    backgroundColor: colors.fillButton,
  },
});
