import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FormField from '../../../../shared/components/FormField';
import PillButton from '../../../../shared/components/PillButton';
import { colors, radii } from '../../../../shared/theme/tokens';
import { buildAddDayPayload, buildEditDayPayload, isDayEdited, validateAddDay } from '../planValidation';
import { AffectsNoticeBox } from './AffectedClients';

// T4 (spec §A6) and, with `day` set, the edit-day modal (§B6). One instance
// serves both, so they share the saving flag (⚠B-8). `onSubmit(payload)`
// resolves when the request settles.
export default function AddDayModal({ isOpen, onClose, context, day, affectedCount, onSubmit }) {
  const editing = Boolean(day);
  const { nextDayNumber, dayLimit, canAddDay } = context;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Fields reset (or prefill from the day) each time it opens.
  useEffect(() => {
    if (isOpen) {
      setTitle(day?.title ?? '');
      setDescription(day?.description ?? '');
      setErrors({});
    }
  }, [isOpen, day]);

  async function submit() {
    const nextErrors = editing
      ? title.trim()
        ? {}
        : { title: 'Day title is required.' }
      : validateAddDay({ title, nextDayNumber, dayLimit, canAddDay });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSaving(true);
    await onSubmit(
      editing
        ? buildEditDayPayload(day, { title, description })
        : buildAddDayPayload({ nextDayNumber, title, description })
    );
    setSaving(false);
  }

  let modalDescription = 'Update the day name and description.';
  if (!editing) {
    modalDescription = canAddDay
      ? 'The next day number is assigned automatically.'
      : `This plan already has all ${dayLimit || 'configured'} days.`;
  }

  return (
    <AppModal
      testID={editing ? 'edit-day-modal' : 'add-day-modal'}
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit day' : 'Add day'}
      size="lg"
      description={modalDescription}
      footer={
        <ModalActions>
          <PillButton testID="day-modal-cancel" title="Cancel" variant="secondary" onPress={onClose} />
          <PillButton
            testID="day-modal-submit"
            title={editing ? 'Update day' : 'Add day'}
            disabled={editing ? !isDayEdited(day, { title, description }) : !canAddDay}
            loading={saving}
            onPress={submit}
          />
        </ModalActions>
      }
    >
      <View style={styles.form}>
        {editing ? (
          <AffectsNoticeBox count={affectedCount} />
        ) : (
          <Text style={styles.box}>
            {canAddDay ? (
              <>
                <Text style={styles.strong}>Day number:</Text> {nextDayNumber || 1} will be assigned automatically.
              </>
            ) : (
              <>
                <Text style={styles.strong}>Day limit reached.</Text> Remove a day before adding another one.
              </>
            )}
          </Text>
        )}
        {/* ⚠T4-1: required, though the helper calls it optional. */}
        <FormField
          testID="plan-day-title"
          label="Day name"
          helperText="Optional labels like Chest & Triceps are easier to scan."
          value={title}
          error={errors.title}
          onChangeText={(text) => {
            setTitle(text);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
        />
        <FormField
          testID="plan-day-description"
          label="Description"
          multiline
          rows={4}
          helperText="Optional coaching notes for the day."
          value={description}
          onChangeText={setDescription}
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  box: {
    borderRadius: radii.xxl,
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
