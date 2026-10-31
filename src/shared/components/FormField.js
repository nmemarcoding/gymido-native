import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, layout, radii, spacing, textInputColors, typography } from '../theme/tokens';
import { CAP_BODY, CAP_SUFFIX } from './largeText';

// RN-SPEC-v2-foundation §4.5: one member/trainer size (52, radius 20).
export const FIELD_HEIGHT = 52;
const OPTIONAL = ' (optional)';
// UX §8.7 U13: the unit suffix caps at 1.6× and the input keeps clear of
// it: right padding = the suffix's inset + its measured width + the gap.
// Before the first measurement the 1× gutter (48) is used.
export const UNIT_GUTTER_FALLBACK = 48;
export function unitGutter(unitWidth) {
  return unitWidth > 0 ? spacing[4] + unitWidth + layout.suffixGap : UNIT_GUTTER_FALLBACK;
}

// Field box variants (the boards' field looks; focus = gold + the 0.18 ring
// and error = the danger-text edge in every variant):
//   default  surface, radius 20, hairline-strong edge (§4.5)
//   well     surfaceWell, radius 16 (TabletCreateProfile)
//   pill     fill-subtle 0.04 (fillWell; U2 folds the drawn 0.05), pill
//            radius, inputs padded 18 (MyPlanCreate phone; textareas keep 16)
//   raised   surfaceRaised, radius 16, the 0.12 edge (MyPlanCreate tablet)
export const FIELD_VARIANTS = Object.freeze(['default', 'well', 'pill', 'raised']);

// OptionalLabel (§4.5): a label ending in " (optional)" draws that part in
// text-faint 400. The words are unchanged, so screen readers read the same.
// UX ruling f1 (27 Oct 2026): a label breaks only between words ("simple").
function LabelText({ label, style }) {
  if (typeof label === 'string' && label.endsWith(OPTIONAL)) {
    return (
      <Text {...CAP_BODY} textBreakStrategy="simple" style={style}>
        {label.slice(0, -OPTIONAL.length)}
        <Text style={styles.optional}>{OPTIONAL}</Text>
      </Text>
    );
  }
  return (
    <Text {...CAP_BODY} textBreakStrategy="simple" style={style}>
      {label}
    </Text>
  );
}

// The label, field box, helper and error (§4.5). `kind` (input | select |
// textarea) is kept for callers; v2 draws one label style for all three.
export function FieldFrame({ label, helperText, error, labelStyle: labelOverride, children }) {
  return (
    <View>
      {label ? <LabelText label={label} style={[styles.label, labelOverride]} /> : null}
      {children}
      {helperText ? <Text {...CAP_BODY} style={styles.helper}>{helperText}</Text> : null}
      {error ? (
        // Announced: an alert on iOS, a polite live region on Android.
        <Text {...CAP_BODY} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// Border and ring of a field box in its current state (§4.5): focus = 1 px
// gold border + a 4 px gold 18 % ring; error = the danger-text border.
export function fieldBoxStyle({ focused, error, disabled, variant = 'default' }) {
  return [
    styles.box,
    VARIANT_BOX[variant] ?? null,
    error && styles.boxError,
    focused && (error ? styles.focusedError : styles.focused),
    disabled && styles.boxDisabled,
  ];
}

// `trailing` sits inside the box at the right, vertically centred on the
// field (e.g. an in-field spinner); the text then keeps clear of it. `unit`
// is the suffix (kg, lb, cm, ft, in) at right 16; callers keep the unit in
// the label, so the suffix itself is not read twice.
export default function FormField({
  label,
  helperText,
  error,
  multiline = false,
  rows = 4,
  editable = true,
  testID,
  labelStyle,
  trailing,
  unit,
  variant = 'default',
  onFocus,
  onBlur,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);
  const [unitWidth, setUnitWidth] = useState(0);
  const pill = variant === 'pill';

  return (
    <FieldFrame label={label} helperText={helperText} error={error} kind={multiline ? 'textarea' : 'input'} labelStyle={labelStyle}>
      {/* The border lives on a wrapper: on Android a bordered TextInput drops
          its left padding once a value is typed (M1 / F1). */}
      <View style={[fieldBoxStyle({ focused, error: Boolean(error), disabled: !editable, variant }), styles.inputBox, pill && multiline && styles.pillMultiline]}>
        <TextInput
          {...textInputColors}
          {...CAP_BODY}
          testID={testID}
          accessibilityLabel={label}
          // Described by the error message (§4.5), read when the field is focused.
          accessibilityHint={error || undefined}
          placeholderTextColor={colors.textFaint}
          editable={editable}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.text,
            focused && styles.textFocused,
            multiline ? [styles.multiline, { minHeight: rows * 24 + 28 }] : [styles.input, pill && styles.pillInput],
            unit ? { paddingRight: unitGutter(unitWidth) } : null,
            trailing ? styles.inputWithTrailing : null,
          ]}
          {...inputProps}
        />
        {unit ? (
          <View
            testID={testID ? `${testID}-unit` : undefined}
            style={styles.unit}
            onLayout={(event) => {
              const next = Math.ceil(event?.nativeEvent?.layout?.width ?? 0);
              if (next !== unitWidth) {
                setUnitWidth(next);
              }
            }}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text {...CAP_SUFFIX} style={styles.unitText}>{unit}</Text>
          </View>
        ) : null}
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  // 13/500 text-secondary, gap 8 to the field.
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing[2],
  },
  optional: {
    ...font(400),
    color: colors.textFaint,
  },
  // No height here: Select and DateInput callers may size the box
  // (boxStyle), so each component sets its own 52.
  box: {
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
  },
  boxError: {
    borderColor: colors.dangerText,
  },
  focused: {
    borderColor: colors.gold,
    outlineWidth: 4,
    outlineColor: colors.goldFocus,
    outlineStyle: 'solid',
  },
  focusedError: {
    borderColor: colors.dangerText,
    outlineWidth: 4,
    outlineColor: colors.dangerFocus,
    outlineStyle: 'solid',
  },
  boxDisabled: {
    opacity: 0.5,
  },
  inputBox: {
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: 0,
  },
  // Single line: the box is 52 with a 1 px border, so the input is 50. No
  // lineHeight on a single-line input (iOS shifts the text down with one).
  // minHeight, not height (UX §9 rule 3): at 2× text the field grows.
  input: {
    minHeight: FIELD_HEIGHT - 2,
    paddingVertical: 0,
    paddingHorizontal: spacing[4],
  },
  // Textarea: padding 14 16, 16/24.
  multiline: {
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
    lineHeight: typography.bodyLg.lineHeight,
  },
  pillInput: {
    paddingHorizontal: spacing['4_5'],
  },
  // A pill textarea keeps the boards' radius 16.
  pillMultiline: {
    borderRadius: radii.md,
  },
  inputWithTrailing: {
    paddingRight: 44,
  },
  unit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: spacing[4],
    justifyContent: 'center',
  },
  unitText: {
    ...font(400),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textFaint,
  },
  trailing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 14,
    justifyContent: 'center',
  },
  // 16 px input text (keeps iOS from zooming), weight 500 on focus.
  text: {
    ...font(400),
    fontSize: typography.bodyLg.fontSize,
    color: colors.textPrimary,
  },
  textFocused: {
    ...font(500),
  },
  // 12 text-muted below the field.
  helper: {
    ...typography.caption,
    marginTop: spacing[2],
    color: colors.textMuted,
  },
  // 13 danger-text below the field.
  error: {
    ...typography.label,
    marginTop: spacing[2],
    color: colors.dangerText,
  },
});

const VARIANT_BOX = StyleSheet.create({
  default: {},
  well: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWell,
  },
  pill: {
    borderRadius: radii.full,
    backgroundColor: colors.fillWell,
  },
  raised: {
    borderRadius: radii.md,
    borderColor: colors.hairlineButton,
    backgroundColor: colors.surfaceRaised,
  },
});
