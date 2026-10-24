import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../shared/api/apiError';
import AppModal, { ModalActions } from '../../shared/components/AppModal';
import { InlineError } from '../../shared/components/FeedbackBox';
import FormField from '../../shared/components/FormField';
import PillButton from '../../shared/components/PillButton';
import Select from '../../shared/components/Select';
import { breakpoints, colors } from '../../shared/theme/tokens';
import { logWeight } from './api/homeApi';
import { validateWeightLog, weightLogBody } from './homeFormat';

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
];

// RN-SPEC-home §H2 (also opened from Progress). Every open starts empty;
// closing works even while saving (⚠H-9), and a late result still lands.
export default function WeightLogModal({ isOpen, onClose, onSuccess, defaultUnit }) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.sm;
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState(defaultUnit || 'kg');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setUnit(defaultUnit || 'kg');
      setErrorMessage('');
      setFieldErrors({});
    }
  }, [isOpen, defaultUnit]);

  async function submit() {
    setErrorMessage('');
    setFieldErrors({});
    const invalid = validateWeightLog(value, unit);
    if (invalid) {
      setFieldErrors({ [invalid.field]: invalid.message });
      return;
    }
    setSubmitting(true);
    try {
      await logWeight(weightLogBody(value, unit));
      onSuccess?.();
      onClose();
    } catch (error) {
      setErrorMessage(getServerMessage(error));
      const errors = error?.response?.data?.errors ?? {};
      const next = {};
      for (const key of Object.keys(errors)) {
        const messages = errors[key];
        next[key] = Array.isArray(messages) ? messages[0] : messages;
      }
      setFieldErrors(next);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppModal
      testID="weight-log-modal"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Add today's weight"
      description="Enter your current weight to update the dashboard and progress summary."
      footer={
        <ModalActions>
          <PillButton testID="weight-log-cancel" title="Cancel" variant="secondary" onPress={onClose} />
          <PillButton testID="weight-log-save" title="Save weight" loading={submitting} onPress={submit} />
        </ModalActions>
      }
    >
      <View style={styles.body}>
        {errorMessage ? <InlineError testID="weight-log-error" message={errorMessage} /> : null}
        <View style={wide ? styles.rowFields : styles.columnFields}>
          <View style={wide ? styles.valueCell : null}>
            <FormField
              testID="weight-log-value"
              label="Today's weight"
              placeholder="83.5"
              keyboardType="decimal-pad"
              autoFocus
              value={value}
              onChangeText={setValue}
              returnKeyType="done"
              onSubmitEditing={submit}
              error={fieldErrors.weight_value}
            />
          </View>
          <View style={wide ? styles.unitCell : null}>
            <Select
              testID="weight-log-unit"
              label="Unit"
              value={unit}
              options={UNITS}
              onChange={setUnit}
              error={fieldErrors.weight_unit}
            />
          </View>
        </View>
        <Text style={styles.note}>We’ll record this for today automatically.</Text>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  columnFields: {
    gap: 16,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 16,
  },
  valueCell: {
    flex: 1.2,
  },
  unitCell: {
    flex: 0.8,
    minWidth: 128,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
