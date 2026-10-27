import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FormField, { FieldFrame } from '../../../../shared/components/FormField';
import { CAP_BODY } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import SegmentedSwitch from '../../../../shared/components/SegmentedSwitch';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import {
  buildAddSetPayload,
  buildEditSetPayload,
  getSetPrefill,
  validateAddSet,
  validateEditSet,
} from '../planValidation';
import { AffectsNoticeBox } from './AffectedClients';
import { useBuilderLayout } from './builderParts';

const UNIT_SEGMENTS = [
  { value: 'lb', label: 'lb', testID: 'set-unit-lb' },
  { value: 'kg', label: 'kg', testID: 'set-unit-kg' },
];

const EMPTY = { setNumber: '', repsMin: '', repsMax: '', weight: '', unit: 'lb', rest: '' };

// Validation error key for each form field, in the visual (focus) order.
const ERROR_KEYS = {
  setNumber: 'set_number',
  repsMin: 'target_reps_min',
  repsMax: 'target_reps_max',
  weight: 'target_weight_value',
  unit: 'target_weight_unit',
  rest: 'rest_seconds',
};
const FOCUS_ORDER = ['setNumber', 'repsMin', 'repsMax', 'weight', 'rest'];

const sameValues = (a, b) => Object.keys(EMPTY).every((key) => a[key] === b[key]);

// T6 (spec §A8) and, with `set` given, the edit-set modal (§B8). One
// instance serves both, so they share the saving flag (⚠B-8).
// v2 look (UX phase4 I §6-7): the set-number row with the gold numeral
// tile (tablet: the gold-tint card), reps min | max side by side, the weight
// with the white-selected lb / kg switch (a radio group "Unit"), rest.
// Tablet: a 2×2 grid. Field order = the board's (reps, weight, rest). Each
// error shows under its own field; submit moves focus to the first one.
// Dated 27 Oct 2026 (MEMBER-PLANS + TRAINER-PLANS, audit b2, UX R2-3): the
// set editor shows the × at every width for both actors (phone: on the title
// row AND the footer Cancel); the tablet's selected unit is gold.
export default function AddSetModal({ isOpen, onClose, nextSetNumber, set, affectedCount, onSubmit }) {
  const editing = Boolean(set);
  const { tablet, reflow } = useBuilderLayout();
  const [initial, setInitial] = useState(EMPTY);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const refs = {
    setNumber: useRef(null),
    repsMin: useRef(null),
    repsMax: useRef(null),
    weight: useRef(null),
    rest: useRef(null),
  };
  useSheetFocus(isOpen, { initialRef: editing ? refs.setNumber : refs.repsMin });

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
      const first = FOCUS_ORDER.find((field) => nextErrors[ERROR_KEYS[field]]);
      refs[first]?.current?.focus?.();
      return;
    }
    setSaving(true);
    await onSubmit(
      editing ? buildEditSetPayload(values) : buildAddSetPayload({ ...values, setNumber: nextSetNumber })
    );
    setSaving(false);
  }

  const field = (key, label, keyboardType, testID) => (
    <FormField
      ref={refs[key]}
      testID={testID}
      label={label}
      variant="well"
      keyboardType={keyboardType}
      value={values[key]}
      error={errors[ERROR_KEYS[key]]}
      onChangeText={(text) => update(key, text)}
    />
  );
  const pair = reflow ? styles.column : styles.row;
  const repsMin = <View style={!reflow && styles.cell}>{field('repsMin', 'Target reps min', 'number-pad', 'set-reps-min')}</View>;
  const repsMax = <View style={!reflow && styles.cell}>{field('repsMax', 'Target reps max', 'number-pad', 'set-reps-max')}</View>;
  const weight = (
    <View style={[styles.weightRow, reflow && styles.column, !reflow && tablet && styles.cell]}>
      <View style={!reflow && styles.cell}>{field('weight', 'Target weight', 'decimal-pad', 'set-weight')}</View>
      <FieldFrame label="Unit" error={errors.target_weight_unit}>
        <SegmentedSwitch
          testID="set-unit"
          accessibilityLabel="Unit"
          segmentRole="radio"
          segments={UNIT_SEGMENTS}
          segmentWidth={56}
          selectedTone={tablet ? 'gold' : 'light'}
          value={values.unit}
          onChange={(value) => update('unit', value)}
          style={styles.unit}
        />
      </FieldFrame>
    </View>
  );
  const rest = <View style={!reflow && tablet && styles.cell}>{field('rest', 'Rest seconds', 'number-pad', 'set-rest')}</View>;

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
      size="lg"
      // The boards draw the × beside the footer Cancel (both close, no save).
      footer={
        <ModalActions fill>
          <PillButton testID="set-modal-cancel" title="Cancel" variant="secondary" size={tablet ? 'cta' : 'default'} onPress={onClose} />
          <PillButton
            testID="set-modal-submit"
            title={editing ? 'Update set' : 'Add set'}
            size={tablet ? 'cta' : 'default'}
            disabled={editing && sameValues(values, initial)}
            loading={saving}
            onPress={submit}
          />
        </ModalActions>
      }
    >
      {editing ? <AffectsNoticeBox count={affectedCount} /> : null}
      {editing ? field('setNumber', 'Set number', 'number-pad', 'set-number') : <SetNumberRow number={nextSetNumber || 1} tablet={tablet} />}
      <View testID="set-reps-row" style={pair}>
        {repsMin}
        {repsMax}
      </View>
      {tablet ? (
        <View testID="set-weight-rest-row" style={pair}>
          {weight}
          {rest}
        </View>
      ) : (
        <>
          {weight}
          {rest}
        </>
      )}
    </AppModal>
  );
}

// "Set number: **n** will be assigned automatically." (code copy) beside the
// gold numeral tile; the tile is decorative.
export function SetNumberRow({ number, tablet }) {
  return (
    <View testID="set-number-box" style={tablet ? styles.boxTablet : styles.box}>
      <View style={tablet ? styles.tileTablet : styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text maxFontSizeMultiplier={1.3} style={tablet ? styles.tileTextTablet : styles.tileText}>
          {number}
        </Text>
      </View>
      <Text {...CAP_BODY} style={[styles.sentence, tablet && styles.sentenceTablet]}>
        Set number: <Text style={styles.strong}>{number}</Text> will be assigned automatically.
      </Text>
    </View>
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
  weightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  unit: {
    borderRadius: radii.md,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceWell,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radii.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.fillChip,
  },
  boxTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3_5'],
    borderRadius: radii.lg,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTablet: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    ...font(700),
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.onGold,
  },
  tileTextTablet: {
    ...font(700),
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
    color: colors.onGold,
  },
  sentence: {
    ...font(600),
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  sentenceTablet: {
    ...font(400),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textStrong2,
  },
  strong: {
    ...font(700),
    color: colors.textPrimary,
  },
});
