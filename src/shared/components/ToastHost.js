import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, motion, radii, shadows } from '../theme/tokens';
import { ToastTone, useToastStore } from './toastStore';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

const TONES = {
  [ToastTone.success]: { border: colors.successBorder, background: colors.successFill, text: colors.successText },
  [ToastTone.error]: { border: colors.dangerBorder, background: colors.errorFill, text: colors.errorText },
  [ToastTone.info]: { border: colors.infoBorder, background: colors.infoFill, text: colors.infoText },
  [ToastTone.warning]: { border: colors.warningBorder, background: colors.warningFill, text: colors.warning700 },
};

// App-shell spec §8: bottom-right stack, above everything including the tab
// bar (⚠S6), offset by the safe-area insets [O2].
export default function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const padding = width >= breakpoints.sm ? 24 : 16;

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: padding + insets.bottom, paddingRight: padding + insets.right, paddingLeft: padding }]}
    >
      {toasts.map((toast, index) => (
        <ToastRow key={`${toast.id}-${index}`} toast={toast} onClose={() => removeToast(toast.id)} />
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

// A page-level toast: the same card rendered in place, without the close
// button (app-shell spec §8; plans §4.7, workout §3.5).
// Web toasts are role=status / aria-live polite. Android announces through
// the view's accessibilityLiveRegion; iOS has no live regions, so it gets
// an explicit announcement (announcing on Android too would read it twice).
function announcePolitely(parts) {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(parts.filter(Boolean).join(' '));
  }
}

export function InlineToast({ tone, title, message, testID, style }) {
  const colorsForTone = TONES[tone] ?? TONES[ToastTone.info];

  useEffect(() => {
    announcePolitely([title, message]);
  }, [title, message]);

  return (
    <SlideUp style={[styles.card, { borderColor: colorsForTone.border, backgroundColor: colorsForTone.background }, style]}>
      <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite">
        {title ? <Text style={[styles.title, { color: colorsForTone.text }]}>{title}</Text> : null}
        {message ? <Text style={[styles.message, { color: colorsForTone.text }]}>{message}</Text> : null}
      </View>
    </SlideUp>
  );
}

function ToastRow({ toast, onClose }) {
  const tone = TONES[toast.tone] ?? TONES[ToastTone.info];

  useEffect(() => {
    announcePolitely([toast.title, toast.message]);
  }, [toast.title, toast.message]);

  // The card runs its own slide-up inside the row's, so it plays twice, nested.
  return (
    <SlideUp style={styles.row}>
      <SlideUp style={[styles.card, { borderColor: tone.border, backgroundColor: tone.background }]}>
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          {toast.title ? <Text style={[styles.title, { color: tone.text }]}>{toast.title}</Text> : null}
          {toast.message ? <Text style={[styles.message, { color: tone.text }]}>{toast.message}</Text> : null}
        </View>
      </SlideUp>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close notification"
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
      >
        {({ pressed }) => (
          <Svg width={16} height={16} viewBox="0 0 20 20">
            <Path
              fill={pressed ? colors.textPrimary : colors.textMuted}
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            />
          </Svg>
        )}
      </Pressable>
    </SlideUp>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'flex-end',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    maxWidth: 384,
  },
  card: {
    flexShrink: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    boxShadow: shadows.soft,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  message: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
  },
  close: {
    marginTop: 4,
    padding: 6,
    borderRadius: radii.full,
  },
  closePressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
