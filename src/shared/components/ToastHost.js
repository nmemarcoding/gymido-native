import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, font, layout, motion, radii, spacing } from '../theme/tokens';
import FeedbackIcon from './FeedbackIcon';
import GlassSurface from './GlassSurface';
import { CAP_BODY, useLargeTextReflow } from './largeText';
import { ToastTone, markToastPresented, useToastHostStore, useToastStore, wasToastPresented } from './toastStore';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// RN-SPEC-v2-foundation §5: the glass carries no tone; the icon does.
export const TOAST_TONES = Object.freeze({
  [ToastTone.success]: Object.freeze({ icon: 'check', color: colors.success }),
  [ToastTone.error]: Object.freeze({ icon: 'error', color: colors.dangerText }),
  [ToastTone.info]: Object.freeze({ icon: 'info', color: colors.info }),
  [ToastTone.warning]: Object.freeze({ icon: 'warning', color: colors.warning }),
});

// The phone tab bar (RN-SPEC-v2-foundation §7.1): the same layout tokens the
// shell's bar uses, so 86 clears it; the bar shows below 768 wide
// (ShellOverlay's rule). Phones always keep the clearance, so a toast can
// never sit under the bar.
export const TAB_BAR_HEIGHT = layout.tabBarHeight;
export const TAB_BAR_BOTTOM_OFFSET = layout.tabBarBottomGap;
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
// `hostId`: set by an open AppModal (its own window); unset = the app-level host.
export default function ToastHost({ hostId } = {}) {
  const toasts = useToastStore((state) => state.toasts);
  const topModalHost = useToastHostStore((state) => state.modalHosts[state.modalHosts.length - 1]);
  const removeToast = useToastStore((state) => state.removeToast);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Only one host draws the stack: the topmost open modal, else the app.
  if (toasts.length === 0 || (hostId ? topModalHost !== hostId : topModalHost !== undefined)) {
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
        <PresentedToast key={`${toast.id}-${index}`} toast={toast} style={place.tablet ? styles.rowTablet : styles.rowPhone} onClose={() => removeToast(toast.id)} />
      ))}
    </View>
  );
}

// One toast in a host. The first host to show an id plays the entrance and
// announces it; a host it later moves to shows it as it is (review LOW).
function PresentedToast({ toast, style, onClose }) {
  const shown = useRef(wasToastPresented(toast.id)).current;
  useEffect(() => {
    markToastPresented(toast.id);
  }, [toast.id]);
  return (
    <SlideUp style={style} entered={shown}>
      {/* Outside the app's BlurTargetView, so it may blur the app behind it. */}
      <ToastCard tone={toast.tone} title={toast.title} message={toast.message} onClose={onClose} overApp announce={!shown} />
    </SlideUp>
  );
}

function SlideUp({ children, style, entered = false }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion || entered ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion || entered) {
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
  }, [progress, reducedMotion, entered]);

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
export function ToastCard({ tone, title, message, onClose, overApp = false, testID, style, announce = true }) {
  const look = TOAST_TONES[tone] ?? TOAST_TONES[ToastTone.info];
  // UX §9 reflow: past 1.3× a one-line toast draws as the stacked card
  // (radius lg, icon top-aligned) so its wrapped text isn't squeezed into a
  // pill; the text takes the row and wraps.
  const stacked = useLargeTextReflow();
  const pill = !(title && message) && !stacked;
  const single = !(title && message);

  useEffect(() => {
    if (announce) {
      announcePolitely([title, message]);
    }
  }, [title, message, announce]);

  return (
    <GlassSurface
      tone="toast"
      overApp={overApp}
      radius={pill ? radii.full : radii.lg}
      style={[styles.card, pill ? styles.cardPill : styles.cardStacked, style]}
    >
      <View style={pill ? null : styles.iconStacked}>
        <FeedbackIcon testID="toast-icon" name={look.icon} size={18} color={look.color} />
      </View>
      <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.text, stacked && styles.textStacked]}>
        {single ? (
          <Text {...CAP_BODY} style={styles.line}>{title || message}</Text>
        ) : (
          <>
            <Text {...CAP_BODY} style={styles.title}>{title}</Text>
            <Text {...CAP_BODY} style={styles.message}>{message}</Text>
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
  textStacked: {
    flex: 1,
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
