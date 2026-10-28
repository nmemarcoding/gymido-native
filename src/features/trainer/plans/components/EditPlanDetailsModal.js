import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FormField, { FieldFrame } from '../../../../shared/components/FormField';
import { CAP_BODY } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import Select from '../../../../shared/components/Select';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import {
  getChangedPlanFields,
  getDaysPerWeekOptions,
  getEditPlanInitial,
  validateEditPlan,
} from '../planValidation';
import { AffectsNoticeBox } from './AffectedClients';
import { useBuilderLayout } from './builderParts';
import { formatCount } from '../../../../shared/format/counts';
import { COPY_DIALOG_TITLE, COPY_SAVE_LABEL } from '../copyOnSave';

// Validation/server error key for each form field.
const ERROR_KEYS = {
  name: 'name',
  categoryId: 'category_id',
  daysPerWeek: 'days_per_week',
  difficultyLevelId: 'difficulty_level_id',
  description: 'description',
};

export const DAY_CHOICES = Object.freeze(['1', '2', '3', '4', '5', '6', '7']);

// E4 (spec §B3). `onSubmit(changes)` resolves to the field errors of a 422
// with `errors` (shown under their fields), or null.
// v2 look (UX phase4 I §8-9): Name, then Category | Difficulty side by side,
// "Days per week" as 7 number chips (a radio group; chips below the plan's
// day count are disabled, as the code's select only offers those values),
// and the description with the approved placeholder "Who this plan is for".
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
  // T-78 (C10): "Name your copy": the same form, "Save copy" enabled even
  // with nothing changed, its own test ids; the caller ignores dismissal
  // while the save runs.
  copy = false,
}) {
  const { tablet, reflow } = useBuilderLayout();
  const [initial, setInitial] = useState(() => getEditPlanInitial(plan));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);
  useSheetFocus(isOpen, { initialRef: nameRef });

  // Each open resets the fields from the current plan header.
  useEffect(() => {
    if (isOpen) {
      const start = getEditPlanInitial(plan);
      setInitial(start);
      setValues(start);
      setErrors({});
    }
    // The plan is read at the open edge only (a later plan change must not
    // reset what the user is editing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const changes = getChangedPlanFields(initial, values);
  const hasChanges = Object.keys(changes).length > 0;

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [ERROR_KEYS[field]]: undefined }));
  }

  async function submit() {
    if (saving || (!hasChanges && !copy)) {
      return;
    }
    const nextErrors = validateEditPlan(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.name) {
        nameRef.current?.focus?.();
      }
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
  const allowed = new Set(getDaysPerWeekOptions(dayCount).map((option) => option.value));

  return (
    <AppModal
      testID={copy ? 'copy-plan-modal' : 'edit-plan-modal'}
      isOpen={isOpen}
      onClose={onClose}
      title={copy ? COPY_DIALOG_TITLE : 'Edit plan details'}
      description={description}
      size="lg"
      // Dated 27 Oct 2026 (audit b2, UX R2-3): both actors' boards draw the ×
      // at every width (phone: the title row AND the footer Cancel).
      footer={
        <ModalActions fill>
          <PillButton
            testID={copy ? 'copy-plan-cancel' : 'edit-plan-cancel'}
            title="Cancel"
            variant="secondary"
            size={tablet ? 'cta' : 'default'}
            onPress={onClose}
          />
          <PillButton
            testID={copy ? 'copy-plan-save' : 'edit-plan-save'}
            title={copy ? COPY_SAVE_LABEL : 'Save changes'}
            size={tablet ? 'cta' : 'default'}
            disabled={!hasChanges && !copy}
            loading={saving}
            onPress={submit}
          />
        </ModalActions>
      }
    >
      <AffectsNoticeBox count={affectedCount} />
      <FormField
        ref={nameRef}
        testID="edit-plan-name"
        label="Name"
        variant="well"
        value={values.name}
        error={errors.name}
        onChangeText={(text) => update('name', text)}
      />
      <View testID="edit-plan-select-row" style={reflow ? styles.column : styles.row}>
        <View style={!reflow && styles.cell}>
          <Select
            testID="edit-plan-category"
            label="Category"
            variant="well"
            value={values.categoryId}
            options={categoryOptions}
            error={errors.category_id}
            onChange={(value) => update('categoryId', value)}
          />
        </View>
        <View style={!reflow && styles.cell}>
          <Select
            testID="edit-plan-difficulty"
            label="Difficulty (optional)"
            variant="well"
            value={values.difficultyLevelId}
            options={levelOptions}
            error={errors.difficulty_level_id}
            onChange={(value) => update('difficultyLevelId', value)}
          />
        </View>
      </View>
      <FieldFrame label="Days per week" error={errors.days_per_week}>
        {dayCount > 1 ? (
          <Text {...CAP_BODY} style={styles.helper}>
            At least {dayCount} — the plan already has that many days.
          </Text>
        ) : null}
        <View testID="edit-plan-days" accessibilityRole="radiogroup" accessibilityLabel="Days per week" style={[styles.chips, tablet && styles.chipsTablet]}>
          {DAY_CHOICES.map((value) => (
            <DayChip
              key={value}
              value={value}
              tablet={tablet}
              selected={values.daysPerWeek === value}
              disabled={!allowed.has(value)}
              onPress={() => update('daysPerWeek', value)}
            />
          ))}
        </View>
      </FieldFrame>
      <FormField
        testID="edit-plan-description"
        label="Description (optional)"
        variant="well"
        multiline
        rows={3}
        placeholder="Who this plan is for"
        value={values.description}
        error={errors.description}
        onChangeText={(text) => update('description', text)}
      />
    </AppModal>
  );
}

// One "Days per week" chip: 44 tall (tablet 56); selected = flat gold with
// on-gold 700 text; a value below the day count is disabled (0.5).
function DayChip({ value, selected, disabled, tablet, onPress }) {
  return (
    <Pressable
      testID={`edit-plan-days-${value}`}
      accessibilityRole="radio"
      accessibilityLabel={`${formatCount(value, 'day', 'days')} per week`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, tablet && styles.chipTablet, selected ? styles.chipOn : styles.chipOff, disabled && styles.chipDisabled]}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay]} /> : null}
          <Text maxFontSizeMultiplier={1.6} style={[styles.chipText, tablet && styles.chipTextTablet, selected ? styles.chipTextOn : styles.chipTextOff]}>
            {value}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  helper: {
    ...font(400),
    marginBottom: spacing[2],
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing['1_5'],
  },
  // Dated 27 Oct 2026: the tablet day buttons are 56 tall, gap 8.
  chipsTablet: {
    gap: spacing[2],
  },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipTablet: {
    minHeight: 56,
    borderRadius: radii.md,
  },
  // UX T-74 ruling 2 (28 Oct): the selected day is goldTint (fill 0.14, a
  // 1 px gold-line edge, gold 600 text), never a second solid gold next to
  // the gold primary.
  chipOn: {
    backgroundColor: colors.goldTint,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  chipOff: {
    backgroundColor: colors.fillChip,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  overlay: {
    backgroundColor: colors.pressOverlay,
  },
  chipText: {
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  chipTextTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  chipTextOn: {
    ...font(600),
    color: colors.gold,
  },
  chipTextOff: {
    ...font(600),
    color: colors.textStrong2,
  },
});
