import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import { colors, font, spacing, typography } from '../theme/tokens';
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

// Web `<select>` as the platform picker (profile-create spec §3.6): an iOS
// wheel in a bottom sheet with "Done", an Android list dialog. The choice
// applies immediately. With no `trailing` and no `boxStyle` it draws the
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
  testID,
  // A spoken name for a select with no visible label (e.g. the set-row unit).
  accessibilityLabel,
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  // Like a browser <select>: a value that matches no option shows the first.
  const selected = options.find((option) => option.value === value) ?? options[0];
  const items = options.map((option) => (
    <Picker.Item key={String(option.value)} label={option.label} value={option.value} />
  ));

  const trailingContent = trailing === undefined && !boxStyle ? <SelectChevron /> : trailing;
  const box = (
    <View
      style={[fieldBoxStyle({ focused: open, error: Boolean(error), disabled }), styles.box, !boxStyle && styles.boxHeight, trailingContent ? styles.boxWithTrailing : null, boxStyle]}
      pointerEvents="none"
    >
      {/* UX §9: the chosen option wraps at large text, never truncated. */}
      <Text {...CAP_BODY} style={[styles.value, textStyle]}>
        {selected?.label ?? ''}
      </Text>
      {trailingContent}
    </View>
  );

  if (Platform.OS === 'android') {
    // The styled box shows; an invisible dialog-mode Picker on top takes the tap.
    return (
      <FieldFrame label={label} helperText={helperText} error={error} kind="select" labelStyle={labelStyle}>
        <View>
          {box}
          <Picker
            testID={testID}
            accessibilityLabel={accessibilityLabel ?? label}
            mode="dialog"
            prompt={label ?? accessibilityLabel}
            enabled={!disabled}
            selectedValue={value}
            onValueChange={(next) => onChange(next)}
            // Like a browser <select> taking focus: opening it closes the keyboard.
            onFocus={() => Keyboard.dismiss()}
            style={styles.androidPicker}
          >
            {items}
          </Picker>
        </View>
      </FieldFrame>
    );
  }

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
      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.toolbar}>
            <Pressable testID={testID ? `${testID}-done` : undefined} accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
              <Text {...CAP_BODY} style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <Picker selectedValue={value} onValueChange={(next) => onChange(next)} itemStyle={styles.wheelItem}>
            {items}
          </Picker>
        </View>
      </Modal>
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
  androidPicker: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.011,
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
