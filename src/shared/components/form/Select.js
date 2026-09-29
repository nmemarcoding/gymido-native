import { Picker } from '@react-native-picker/picker';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import BottomSheet from './BottomSheet';
import { AnimatedBox, Field, FieldFooter, FieldLabel, fieldHint, fieldStyles, useBoxStyle } from './FieldChrome';

// Shared Select (RN-SPEC-profile-create §3.6): a box showing the selected
// option's label with no chevron. iOS: wheel in a bottom sheet; Android: the
// platform dialog. A choice fires the change immediately. Options are
// { label, value }; labels may repeat (⚠P5), so rows are keyed by index.
export default function Select({
  label,
  value,
  options,
  onChangeValue,
  helperText,
  error,
  testID,
  hideLabel = false,
  // Box/text overrides for callers whose select is not a form field — the
  // SetRow unit picker (RN-SPEC-workout §19.3) has its own 48-high chrome.
  boxStyle,
  textStyle,
}) {
  const [open, setOpen] = useState(false);
  const androidPicker = useRef(null);
  const boxStyle_ = useBoxStyle(open, Boolean(error));
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  const choose = (index) => onChangeValue(options[index].value);

  const openPicker = () => {
    if (Platform.OS === 'android') {
      androidPicker.current?.focus();
    } else {
      setOpen(true);
    }
  };

  // Pickers take string-ish values; index keys keep duplicate labels distinct.
  const items = options.map((option, index) => (
    <Picker.Item key={index} label={option.label} value={index} />
  ));

  return (
    <Field>
      {/* hideLabel: the label is the accessible name only (e.g. the SetRow unit). */}
      {hideLabel ? null : <FieldLabel kind="select">{label}</FieldLabel>}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: options[selectedIndex]?.label }}
        accessibilityHint={fieldHint(helperText, error)}
        accessibilityState={error ? { invalid: true } : undefined}
        onPress={openPicker}
      >
        <AnimatedBox style={[...boxStyle_, boxStyle]}>
          <Text style={[fieldStyles.text, textStyle]}>{options[selectedIndex]?.label}</Text>
        </AnimatedBox>
      </Pressable>
      {Platform.OS === 'android' ? (
        <View style={{ height: 0, overflow: 'hidden' }}>
          <Picker
            ref={androidPicker}
            mode="dialog"
            prompt={label}
            selectedValue={selectedIndex}
            onValueChange={(index) => choose(index)}
          >
            {items}
          </Picker>
        </View>
      ) : (
        <BottomSheet visible={open} onDone={() => setOpen(false)} testID={testID ? `${testID}-sheet` : undefined}>
          <Picker
            testID={testID ? `${testID}-picker` : undefined}
            selectedValue={selectedIndex}
            onValueChange={(index) => choose(index)}
          >
            {items}
          </Picker>
        </BottomSheet>
      )}
      <FieldFooter helperText={helperText} error={error} />
    </Field>
  );
}
