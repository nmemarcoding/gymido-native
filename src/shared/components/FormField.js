import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { breakpoints, colors, radii, shadows } from '../theme/tokens';

// The label, field box, helper and error of the trainer plans spec §A3.4.
// `kind` picks the label style: input | select | textarea.
export function FieldFrame({ label, helperText, error, kind = 'input', labelStyle: labelOverride, children }) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;

  return (
    <View>
      {label ? <Text style={[styles.label, labelStyle(kind, wide), labelOverride]}>{label}</Text> : null}
      {children}
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function labelStyle(kind, wide) {
  if (kind === 'textarea') {
    return { fontSize: 14, marginBottom: 8 };
  }
  if (kind === 'select') {
    return { fontSize: 14, marginBottom: wide ? 8 : 4 };
  }
  return { fontSize: wide ? 14 : 12, marginBottom: wide ? 8 : 4 };
}

// Border and ring of a field box in its current state.
export function fieldBoxStyle({ focused, error, disabled }) {
  return [
    styles.box,
    error && styles.boxError,
    focused && (error ? styles.focusedError : styles.focused),
    disabled && styles.boxDisabled,
  ];
}

export default function FormField({ label, helperText, error, multiline = false, rows = 4, editable = true, testID, ...inputProps }) {
  const [focused, setFocused] = useState(false);

  return (
    <FieldFrame label={label} helperText={helperText} error={error} kind={multiline ? 'textarea' : 'input'}>
      {/* The border lives on a wrapper: on Android a bordered TextInput drops
          its left padding once a value is typed (M1 / F1). */}
      <View style={[fieldBoxStyle({ focused, error: Boolean(error), disabled: !editable }), styles.inputBox]}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, styles.text, multiline && { minHeight: rows * 20 + 24 }]}
          {...inputProps}
        />
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    lineHeight: 20,
    color: colors.textPrimary,
  },
  box: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    boxShadow: shadows.insetSoft,
  },
  boxError: {
    borderColor: colors.danger,
  },
  focused: {
    borderColor: colors.brand500,
    outlineWidth: 2,
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
  },
  focusedError: {
    borderColor: colors.danger,
    outlineWidth: 2,
    outlineColor: colors.focusRingError,
    outlineStyle: 'solid',
  },
  boxDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  inputBox: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
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
    color: colors.danger,
  },
});
