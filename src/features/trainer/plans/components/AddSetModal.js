import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import Select from '../../../../shared/components/Select';
import { breakpoints, colors, radii } from '../../../../shared/theme/tokens';
import {
  buildAddSetPayload,
  buildEditSetPayload,
  getSetPrefill,
  validateAddSet,
  validateEditSet,
} from '../planValidation';
import { AffectsNoticeBox } from './AffectedClients';

const UNIT_OPTIONS = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];

const EMPTY = { setNumber: '', repsMin: '', repsMax: '', weight: '', unit: 'lb', rest: '' };

// Validation error key for each form field.
const ERROR_KEYS = {
  setNumber: 'set_number',
  repsMin: 'target_reps_min',
  repsMax: 'target_reps_max',
  weight: 'target_weight_value',
  unit: 'target_weight_unit',
  rest: 'rest_seconds',
};

const sameValues = (a, b) => Object.keys(EMPTY).every((key) => a[key] === b[key]);

// T6 (spec §A8) and, with `set` given, the edit-set modal (§B8). One
// instance serves both, so they share the saving flag (⚠B-8).
export default function AddSetModal({ isOpen, onClose, nextSetNumber, set, affectedCount, onSubmit }) {
  const editing = Boolean(set);
  const { width } = useWindowDimensions();
  const twoColumns = width >= breakpoints.md;
  const [initial, setInitial] = useState(EMPTY);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const start = set ? getSetPrefill(set) : EMPTY;
      setInitial(start);
      setValues(start);
      setErrors({});
    }
  }, [isOpen, set]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [ERROR_KEYS[field]]: undefined }));
  }

  async function submit() {
    const nextErrors = editing ? validateEditSet(values) : validateAddSet(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSaving(true);
    await onSubmit(
      editing ? buildEditSetPayload(values) : buildAddSetPayload({ ...values, setNumber: nextSetNumber })
    );
    setSaving(false);
  }

  const row = twoColumns ? styles.row : styles.column;

  return (
    <AppModal
      testID={editing ? 'edit-set-modal' : 'add-set-modal'}
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit set' : 'Add set'}
      description={
        editing
          ? 'Keep set targets simple and readable for the workout screen.'
          : 'The next set number is assigned automatically.'
      }
      size="2xl"
      footer={
        <ModalActions>
          <PillButton testID="set-modal-cancel" title="Cancel" variant="secondary" onPress={onClose} />
          <PillButton
            testID="set-modal-submit"
            title={editing ? 'Update set' : 'Add set'}
            disabled={editing && sameValues(values, initial)}
            loading={saving}
            onPress={submit}
          />
        </ModalActions>
      }
    >
      <View style={styles.form}>
        {editing ? <AffectsNoticeBox count={affectedCount} /> : null}
        <View style={row}>
          {editing ? (
            <View style={twoColumns && styles.cell}>
              <FormField
                testID="set-number"
                label="Set number"
                keyboardType="number-pad"
                value={values.setNumber}
                error={errors.set_number}
                onChangeText={(text) => update('setNumber', text)}
              />
            </View>
          ) : (
            <Text style={[styles.box, twoColumns && styles.cell]}>
              <Text style={styles.strong}>Set number:</Text> {nextSetNumber || 1} will be assigned automatically.
            </Text>
          )}
          <View style={twoColumns && styles.cell}>
            <FormField
              testID="set-rest"
              label="Rest seconds"
              keyboardType="number-pad"
              value={values.rest}
              error={errors.rest_seconds}
              onChangeText={(text) => update('rest', text)}
            />
          </View>
        </View>
        <View style={row}>
          <View style={twoColumns && styles.cell}>
            <FormField
              testID="set-reps-min"
              label="Target reps min"
              keyboardType="number-pad"
              value={values.repsMin}
              error={errors.target_reps_min}
              onChangeText={(text) => update('repsMin', text)}
            />
          </View>
          <View style={twoColumns && styles.cell}>
            <FormField
              testID="set-reps-max"
              label="Target reps max"
              keyboardType="number-pad"
              value={values.repsMax}
              error={errors.target_reps_max}
              onChangeText={(text) => update('repsMax', text)}
            />
          </View>
        </View>
        <View style={row}>
          <View style={twoColumns && styles.cell}>
            <FormField
              testID="set-weight"
              label="Target weight"
              keyboardType="decimal-pad"
              value={values.weight}
              error={errors.target_weight_value}
              onChangeText={(text) => update('weight', text)}
            />
          </View>
          <View style={twoColumns && styles.unitCell}>
            <Select
              testID="set-unit"
              label="Unit"
              value={values.unit}
              options={UNIT_OPTIONS}
              error={errors.target_weight_unit}
              onChange={(value) => update('unit', value)}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  column: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  cell: {
    flex: 1,
  },
  unitCell: {
    width: 140,
  },
  box: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 16,
    overflow: 'hidden',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  strong: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
