import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import Select from '../../../../shared/components/Select';
import {
  getChangedPlanFields,
  getDaysPerWeekOptions,
  getEditPlanInitial,
  validateEditPlan,
} from '../planValidation';
import { AffectsNoticeBox } from './AffectedClients';

// Validation/server error key for each form field.
const ERROR_KEYS = {
  name: 'name',
  categoryId: 'category_id',
  daysPerWeek: 'days_per_week',
  difficultyLevelId: 'difficulty_level_id',
  description: 'description',
};

// E4 (spec §B3). `onSubmit(changes)` resolves to the field errors of a 422
// with `errors` (shown under their fields), or null.
export default function EditPlanDetailsModal({
  isOpen,
  onClose,
  plan,
  dayCount,
  categories,
  levels,
  affectedCount,
  description,
  onSubmit,
}) {
  const [initial, setInitial] = useState(() => getEditPlanInitial(plan));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Each open resets the fields from the current plan header.
  useEffect(() => {
    if (isOpen) {
      const start = getEditPlanInitial(plan);
      setInitial(start);
      setValues(start);
      setErrors({});
    }
    // The plan is read at the open edge only.
  }, [isOpen]);

  const changes = getChangedPlanFields(initial, values);
  const hasChanges = Object.keys(changes).length > 0;

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [ERROR_KEYS[field]]: undefined }));
  }

  async function submit() {
    if (saving || !hasChanges) {
      return;
    }
    const nextErrors = validateEditPlan(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSaving(true);
    const fieldErrors = await onSubmit(changes);
    setSaving(false);
    if (fieldErrors) {
      setErrors(fieldErrors);
    }
  }

  const categoryOptions = [
    { value: '', label: 'Select a category' },
    ...categories.map((category) => ({ value: String(category.id), label: category.name })),
  ];
  // "No difficulty set" only while the plan has none: a difficulty can't be cleared.
  const levelOptions = [
    ...(initial.difficultyLevelId ? [] : [{ value: '', label: 'No difficulty set' }]),
    ...levels.map((level) => ({ value: String(level.id), label: level.name })),
  ];

  return (
    <AppModal
      testID="edit-plan-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Edit plan details"
      description={description}
      size="lg"
      footer={
        <ModalActions>
          <PillButton testID="edit-plan-cancel" title="Cancel" variant="secondary" onPress={onClose} />
          <PillButton
            testID="edit-plan-save"
            title="Save changes"
            disabled={!hasChanges}
            loading={saving}
            onPress={submit}
          />
        </ModalActions>
      }
    >
      <View style={styles.form}>
        <AffectsNoticeBox count={affectedCount} />
        <FormField
          testID="edit-plan-name"
          label="Name"
          value={values.name}
          error={errors.name}
          onChangeText={(text) => update('name', text)}
        />
        <Select
          testID="edit-plan-category"
          label="Category"
          value={values.categoryId}
          options={categoryOptions}
          error={errors.category_id}
          onChange={(value) => update('categoryId', value)}
        />
        <Select
          testID="edit-plan-days"
          label="Days per week"
          value={values.daysPerWeek}
          options={getDaysPerWeekOptions(dayCount)}
          error={errors.days_per_week}
          helperText={dayCount > 1 ? `At least ${dayCount} — the plan already has that many days.` : undefined}
          onChange={(value) => update('daysPerWeek', value)}
        />
        <Select
          testID="edit-plan-difficulty"
          label="Difficulty (optional)"
          value={values.difficultyLevelId}
          options={levelOptions}
          error={errors.difficulty_level_id}
          onChange={(value) => update('difficultyLevelId', value)}
        />
        <FormField
          testID="edit-plan-description"
          label="Description (optional)"
          multiline
          rows={4}
          value={values.description}
          error={errors.description}
          onChangeText={(text) => update('description', text)}
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
});
