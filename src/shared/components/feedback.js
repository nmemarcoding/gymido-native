import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, plansMotion, radii, shadows } from '../theme/tokens';
import Spinner from './Spinner';

// Ports of the web app's shared feedback components (Loader, InlineError,
// EmptyState, Toast) as used by RN-SPEC-plans.

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// iOS has no live regions, so polite announcements go through the
// accessibility API when the element appears (RN-SPEC-plans §9).
function useAnnounceOnMount(text) {
  useEffect(() => {
    if (Platform.OS === 'ios' && text) {
      AccessibilityInfo.announceForAccessibility(text);
    }
    // Announce once, when the element appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Inline row, not full screen: 20px spinner + label.
export function Loader({ label = 'Loading' }) {
  useAnnounceOnMount(label);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      accessibilityLabel={label}
      style={styles.loader}
      testID="loader"
    >
      <Spinner size={20} thickness={2} trackColor={colors.border} arcColor={colors.brand400} />
      <Text style={styles.loaderLabel}>{label}</Text>
    </View>
  );
}

export function InlineError({ title = 'Something went wrong', message }) {
  return (
    <View style={styles.inlineError} testID="inline-error">
      <Text style={styles.errorTitle}>{title}</Text>
      {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, message }) {
  useAnnounceOnMount(`${title} ${message}`);
  return (
    <View accessibilityLiveRegion="polite" style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const TOAST_TONES = {
  success: { borderColor: colors.successBorder, backgroundColor: colors.successFill, color: colors.successText },
  error: { borderColor: colors.dangerBorder, backgroundColor: colors.errorFill, color: colors.errorText },
};

// Inline toast with the web's slide-up entrance (300ms ease-out, 10px).
export function Toast({ tone = 'success', title, message }) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useAnnounceOnMount([title, message].filter(Boolean).join(' '));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: plansMotion.toastMs,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const tint = TOAST_TONES[tone] ?? TOAST_TONES.success;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [plansMotion.toastOffsetY, 0] });

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      testID={`toast-${tone}`}
      style={[
        styles.toast,
        { borderColor: tint.borderColor, backgroundColor: tint.backgroundColor },
        { opacity: progress, transform: [{ translateY }] },
      ]}
    >
      {title ? <Text style={[styles.toastTitle, { color: tint.color }]}>{title}</Text> : null}
      {message ? <Text style={[styles.toastMessage, { color: tint.color }]}>{message}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loaderLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  inlineError: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.errorFill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.errorText,
  },
  errorMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.errorText,
  },
  emptyState: {
    borderRadius: radii.surfaceCard,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    boxShadow: shadows.plansSoft,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  toast: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.plansCard,
  },
  toastTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  toastMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
  },
});
