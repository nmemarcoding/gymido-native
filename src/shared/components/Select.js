import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { breakpoints, colors, font, radii, spacing, typography } from '../theme/tokens';
import { FIELD_HEIGHT, FieldFrame, fieldBoxStyle } from './FormField';
import { CAP_BODY } from './largeText';

// §4.5 Select: the input style + a 16 px chevron at right (text-muted).
export function SelectChevron({ color = colors.textMuted }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// The gold check on the selected row of the Android select sheet.
function SelectCheck({ testID }) {
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M20 6L9 17l-5-5" stroke={colors.gold} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// Web `<select>` (profile-create spec §3.6): an iOS wheel in a bottom sheet
// with "Done"; on Android the app's dark select sheet (UX NATIVE-P4 N1,
// a352a2d: never the light system dialog): surface-raised, hairline edge,
// 52 tall radio rows, a gold check on the selected one, scrim 0.6. The
// choice applies immediately (Android: the tap also closes the sheet). With no `trailing` and no `boxStyle` it draws the
// v2 chevron; a caller that restyles the box (e.g. the 40 px set-row unit)
// owns its trailing content.
export default function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
  error,
  helperText,
  boxStyle,
  textStyle,
  trailing,
  labelStyle,
  // The field box variant (FormField FIELD_VARIANTS: default | well | pill | raised).
  variant = 'default',
  testID,
  // A spoken name for a select with no visible label (e.g. the set-row unit).
  accessibilityLabel,
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const android = Platform.OS === 'android';
  // Like a browser <select>: a value that matches no option shows the first.
  const selected = options.find((option) => option.value === value) ?? options[0];
  const items = android
    ? null
    : options.map((option) => <Picker.Item key={String(option.value)} label={option.label} value={option.value} />);
  const name = label ?? accessibilityLabel;
  const close = () => setOpen(false);

  const trailingContent = trailing === undefined && !boxStyle ? <SelectChevron /> : trailing;
  const box = (
    <View
      style={[fieldBoxStyle({ focused: open, error: Boolean(error), disabled, variant }), styles.box, !boxStyle && styles.boxHeight, trailingContent ? styles.boxWithTrailing : null, boxStyle]}
      pointerEvents="none"
    >
      {/* UX §9: the chosen option wraps at large text, never truncated. */}
      <Text {...CAP_BODY} style={[styles.value, textStyle]}>
        {selected?.label ?? ''}
      </Text>
      {trailingContent}
    </View>
  );

  return (
    <FieldFrame label={label} helperText={helperText} error={error} kind="select" labelStyle={labelStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityValue={{ text: selected?.label ?? '' }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          // Like a browser <select> taking focus: opening it closes the keyboard.
          Keyboard.dismiss();
          setOpen(true);
        }}
      >
        {box}
      </Pressable>
      {android ? (
        <Modal
          testID={testID ? `${testID}-modal` : undefined}
          transparent
          statusBarTranslucent
          visible={open}
          animationType={reducedMotion ? 'none' : 'fade'}
          onRequestClose={close}
        >
          <View style={[styles.androidRoot, width >= breakpoints.md && styles.androidRootTablet]}>
            <Pressable
              testID={testID ? `${testID}-scrim` : undefined}
              style={[StyleSheet.absoluteFill, styles.androidScrim]}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
            <View
              testID={testID ? `${testID}-sheet` : undefined}
              style={[styles.androidSheet, width >= breakpoints.md ? styles.androidSheetTablet : { paddingBottom: insets.bottom + spacing[2] }]}
            >
              {name ? (
                <Text {...CAP_BODY} accessibilityRole="header" style={styles.androidTitle}>
                  {name}
                </Text>
              ) : null}
              <ScrollView bounces={false} accessibilityRole="radiogroup" accessibilityLabel={name}>
                {options.map((option) => {
                  const checked = option === selected;
                  const key = String(option.value);
                  return (
                    <Pressable
                      key={key}
                      testID={testID ? `${testID}-option-${key}` : undefined}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ checked }}
                      onPress={() => {
                        close();
                        onChange(option.value);
                      }}
                      style={({ pressed }) => [styles.androidRow, checked && styles.androidRowChecked, pressed && styles.androidRowPressed]}
                    >
                      {/* UX §9: a long option wraps at large text, never truncated. */}
                      <Text {...CAP_BODY} style={[styles.androidRowText, checked && styles.androidRowTextChecked]}>
                        {option.label}
                      </Text>
                      {checked ? <SelectCheck testID={testID ? `${testID}-check-${key}` : undefined} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : (
        <Modal transparent visible={open} animationType="slide" onRequestClose={close}>
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.toolbar}>
              <Pressable testID={testID ? `${testID}-done` : undefined} accessibilityRole="button" onPress={close} hitSlop={8}>
                <Text {...CAP_BODY} style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <Picker selectedValue={value} onValueChange={(next) => onChange(next)} itemStyle={styles.wheelItem}>
              {items}
            </Picker>
          </View>
        </Modal>
      )}
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    // Shows only once the value wraps at large text (one line sits well
    // inside the 52 box).
    paddingVertical: spacing[2],
  },
  boxHeight: {
    minHeight: FIELD_HEIGHT,
  },
  boxWithTrailing: {
    paddingRight: 14,
  },
  // The input's 16/400 text-primary.
  value: {
    ...font(400),
    flexShrink: 1,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  wheelItem: {
    ...font(400),
    color: colors.textPrimary,
  },
  // Android select sheet (UX NATIVE-P4 N1).
  androidRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  androidRootTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  androidScrim: {
    backgroundColor: colors.scrim,
  },
  androidSheet: {
    maxHeight: '80%',
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing[2],
  },
  androidSheetTablet: {
    width: '100%',
    maxWidth: 520,
    borderRadius: radii.xl,
    paddingBottom: spacing[2],
  },
  androidTitle: {
    ...font(600),
    fontSize: typography.bodyLg.fontSize,
    lineHeight: 22,
    color: colors.textSecondary,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  androidRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  androidRowChecked: {
    backgroundColor: colors.goldTint,
  },
  androidRowPressed: {
    backgroundColor: colors.fillSubtle,
  },
  androidRowText: {
    ...font(400),
    flexShrink: 1,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  androidRowTextChecked: {
    ...font(600),
    color: colors.gold,
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.pickerSheet,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.fillSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.pickerToolbarBorder,
  },
  done: {
    ...font(600),
    fontSize: 16,
    lineHeight: 22,
    color: colors.pickerDone,
  },
});
