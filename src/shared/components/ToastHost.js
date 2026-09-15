import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '../theme/tokens';
import { useToastStore } from './toastStore';

const TOAST_DURATION_MS = 3000;

export default function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    AccessibilityInfo.announceForAccessibility([toast.title, toast.message].filter(Boolean).join('. '));
    const timer = setTimeout(hide, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="alert"
      onPress={hide}
      style={[styles.toast, { top: insets.top + 8 }]}
    >
      <Text style={styles.title}>{toast.title}</Text>
      {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 2,
    boxShadow: shadows.soft,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
