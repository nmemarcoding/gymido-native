import { useEffect, useRef, useState } from 'react';
import { Platform, TextInput } from 'react-native';

import { colors } from '../../theme/tokens';
import { AnimatedBox, Field, FieldFooter, FieldLabel, fieldHint, fieldStyles, useBoxStyle, useFocusState } from './FieldChrome';

// The browser's `type="number"` value: '' unless the text is a valid float
// (RN-SPEC-profile-create §3.4). "5." → '', ".5" → ".5", "1e2" → "1e2".
const VALID_NUMBER = /^-?(\d+|\d*\.\d+)([eE][-+]?\d+)?$/;
export function numberInputValue(text) {
  return VALID_NUMBER.test(text) ? text : '';
}

const NUMBER_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';

// Shared Input (text or number). No autofill; return/Go submits the form.
// For numbers the typed text stays on screen while state gets the web value;
// a programmatic value change shows String(value).
export default function Input({
  label,
  value,
  onChangeValue,
  type = 'text',
  placeholder,
  helperText,
  error,
  onSubmit,
  testID,
}) {
  const { focused, onFocus, onBlur } = useFocusState();
  const boxStyle = useBoxStyle(focused, Boolean(error));
  const isNumber = type === 'number';
  const [text, setText] = useState(value === undefined || value === null ? '' : String(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value === undefined || value === null ? '' : String(value));
    }
  }, [value]);

  const handleChange = (next) => {
    setText(next);
    const stored = isNumber ? numberInputValue(next) : next;
    lastEmitted.current = stored;
    onChangeValue(stored);
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <AnimatedBox style={boxStyle}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={fieldHint(helperText, error)}
          accessibilityState={error ? { invalid: true } : undefined}
          value={text}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={isNumber ? NUMBER_KEYBOARD : 'default'}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          onFocus={onFocus}
          onBlur={onBlur}
          style={[fieldStyles.text, { padding: 0 }]}
        />
      </AnimatedBox>
      <FieldFooter helperText={helperText} error={error} />
    </Field>
  );
}
