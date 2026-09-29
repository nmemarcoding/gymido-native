import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';
import BottomSheet from './BottomSheet';
import { AnimatedBox, Field, FieldFooter, FieldLabel, fieldHint, fieldStyles, useBoxStyle } from './FieldChrome';

// Local midnight for a stored "YYYY-MM-DD".
function toLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

// Local YYYY-MM-DD from the picked date's local year/month/day.
export function toStoredDate(date) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Device-locale numeric date, e.g. en-US 09/21/1990.
export function formatDisplayDate(value) {
  const date = toLocalDate(value);
  if (!date) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Shared DateInput (RN-SPEC-profile-create §3.5), web `type="date"`. Looks like
// an Input (Input-sized label). No min/max. A "Clear" button inside the box
// replaces the browser's clear affordance.
export default function DateInput({ label, value, onChangeValue, helperText, error, testID }) {
  const [open, setOpen] = useState(false);
  const boxStyle = useBoxStyle(open, Boolean(error));
  const current = toLocalDate(value) ?? new Date();
  const display = formatDisplayDate(value);

  const pick = (date) => {
    if (date) {
      onChangeValue(toStoredDate(date));
    }
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set') {
            pick(date);
          }
        },
      });
    } else {
      setOpen(true);
    }
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <AnimatedBox style={[boxStyle, styles.row]}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: display }}
          accessibilityHint={fieldHint(helperText, error)}
          accessibilityState={error ? { invalid: true } : undefined}
          onPress={openPicker}
          style={styles.flex}
        >
          {display ? (
            <Text style={fieldStyles.text}>{display}</Text>
          ) : Platform.OS === 'android' ? (
            <Text style={[fieldStyles.text, { color: colors.textMuted }]}>mm/dd/yyyy</Text>
          ) : (
            <Text style={fieldStyles.text}> </Text>
          )}
        </Pressable>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={() => onChangeValue('')} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </AnimatedBox>
      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onDone={() => setOpen(false)}>
          <View style={styles.inlinePicker}>
            <DateTimePicker value={current} mode="date" display="inline" onChange={(event, date) => pick(date)} />
          </View>
        </BottomSheet>
      ) : null}
      <FieldFooter helperText={helperText} error={error} />
    </Field>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  clear: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand600,
  },
  inlinePicker: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});
