import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';
import { FieldFrame, fieldBoxStyle } from './FormField';

const pad = (n) => String(n).padStart(2, '0');

// Local YYYY-MM-DD from a picked date's local year/month/day.
export function toLocalDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromLocalDateString(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Device-locale numeric date, as the browser shows a filled date input.
export function formatDateInput(value) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    fromLocalDateString(value)
  );
}

// Web `<input type="date">` (profile-create spec §3.5): looks like an Input,
// opens the platform date picker (iOS inline in a sheet with "Done", Android
// the dialog), no min/max, and a "Clear" button while it has a value.
export default function DateInput({ label, value, onChange, error, testID, labelStyle, accessibilityLabel }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pickerDate = value ? fromLocalDateString(value) : new Date();

  const onPicked = (event, date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'set' && date) {
      onChange(toLocalDateString(date));
    }
  };

  return (
    <FieldFrame label={label} error={error} kind="input" labelStyle={labelStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityValue={{ text: value ? formatDateInput(value) : '' }}
        onPress={() => setOpen(true)}
        style={[fieldBoxStyle({ focused: open, error: Boolean(error), disabled: false }), styles.box]}
      >
        {value ? (
          <Text style={styles.value}>{formatDateInput(value)}</Text>
        ) : (
          <Text style={styles.placeholder}>{Platform.OS === 'android' ? 'mm/dd/yyyy' : ''}</Text>
        )}
        {value ? (
          <Pressable testID={testID ? `${testID}-clear` : undefined} accessibilityRole="button" onPress={() => onChange('')} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {open && Platform.OS === 'android' ? <DateTimePicker value={pickerDate} mode="date" onChange={onPicked} /> : null}
      {Platform.OS === 'ios' ? (
        <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.toolbar}>
              <Pressable testID={testID ? `${testID}-done` : undefined} accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker value={pickerDate} mode="date" display="inline" onChange={onPicked} />
          </View>
        </Modal>
      ) : null}
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  placeholder: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  clear: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.brand700,
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#9ca3af',
  },
  done: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#007aff',
  },
});
