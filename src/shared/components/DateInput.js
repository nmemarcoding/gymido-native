import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path, Rect } from 'react-native-svg';

import { colors, font, spacing, typography } from '../theme/tokens';
import { FIELD_HEIGHT, FieldFrame, fieldBoxStyle } from './FormField';

// §4.5 DateInput: the input style + an 18 px calendar icon at right.
function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={3} y={5} width={18} height={16} rx={3} stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

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
        <View style={styles.trailing}>
          {value ? (
            // hitSlop 12 around the 20 px line: a 44 target.
            <Pressable testID={testID ? `${testID}-clear` : undefined} accessibilityRole="button" onPress={() => onChange('')} hitSlop={12}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          ) : null}
          <CalendarIcon />
        </View>
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
            <DateTimePicker value={pickerDate} mode="date" display="inline" themeVariant="dark" accentColor={colors.gold} onChange={onPicked} />
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
    gap: spacing[2],
    minHeight: FIELD_HEIGHT,
    paddingRight: 14,
  },
  // The input's 16/400 text; the placeholder in text-faint.
  value: {
    ...font(400),
    flexShrink: 1,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  placeholder: {
    ...font(400),
    flexShrink: 1,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: 20,
    color: colors.textFaint,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  clear: {
    ...font(600),
    fontSize: 14,
    lineHeight: 20,
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
