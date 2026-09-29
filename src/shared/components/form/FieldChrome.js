import { useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useColorTransition } from '../../hooks/useColorTransition';
import { colors, radii } from '../../theme/tokens';
import { useLayoutMetrics } from '../../../navigation/shell/layoutMetrics';

// Shared field chrome for Input, Select and DateInput (RN-SPEC-profile-create
// §6): label, the input box look, helper and error text.

const DANGER = '#ef4444';
const FOCUS_RING = 'rgba(244,180,0,0.35)';
const DANGER_RING = 'rgba(239,68,68,0.35)';
export const INSET_SOFT = 'inset 0 1px 0 rgba(255,255,255,0.8)';

// Input labels are 12px on phones (<640) and 14px from 640; Select labels are
// always 14px (⚠P10). Margin-bottom 4 (<640) / 8.
export function FieldLabel({ children, kind = 'input' }) {
  const { gutter } = useLayoutMetrics();
  const wide = gutter === 20;
  const fontSize = kind === 'select' || wide ? 14 : 12;
  return (
    <Text style={[styles.label, { fontSize, lineHeight: fontSize === 14 ? 20 : 16, marginBottom: wide ? 8 : 4 }]}>
      {children}
    </Text>
  );
}

// Box border and ring. Danger wins over the base and focus borders; 150ms.
export function useBoxStyle(focused, hasError) {
  const borderColor = useColorTransition(hasError ? DANGER : focused ? colors.brand500 : colors.border);
  const ring = focused ? `0 0 0 2px ${hasError ? DANGER_RING : FOCUS_RING}` : null;
  return [styles.box, { borderColor }, { boxShadow: ring ? `${INSET_SOFT}, ${ring}` : INSET_SOFT }];
}

export function useFocusState() {
  const [focused, setFocused] = useState(false);
  return { focused, onFocus: () => setFocused(true), onBlur: () => setFocused(false) };
}

export function AnimatedBox({ style, children, ...rest }) {
  return (
    <Animated.View style={style} {...rest}>
      {children}
    </Animated.View>
  );
}

// Helper first, then the error, each 8 below.
export function FieldFooter({ helperText, error }) {
  return (
    <>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

export function fieldHint(helperText, error) {
  return [helperText, error].filter(Boolean).join(' ') || undefined;
}

export function Field({ children }) {
  return <View>{children}</View>;
}

export const fieldStyles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  box: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  helper: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  error: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: DANGER,
  },
});
