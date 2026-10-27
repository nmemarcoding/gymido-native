import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppModal, { ModalActions } from '../../../../shared/components/AppModal';
import FormField from '../../../../shared/components/FormField';
import { CAP_BODY } from '../../../../shared/components/largeText';
import PillButton from '../../../../shared/components/PillButton';
import { useSheetFocus } from '../../../../shared/hooks/useSheetFocus';
import { colors, font, radii, spacing } from '../../../../shared/theme/tokens';
import { buildAddDayPayload, buildEditDayPayload, fullPlanMessage, isDayEdited, validateAddDay } from '../planValidation';
import { AffectsNoticeBox } from './AffectedClients';
import { useBuilderLayout } from './builderParts';

// T4 (spec §A6) and, with `day` set, the edit-day modal (§B6). One instance
// serves both, so they share the saving flag (⚠B-8). `onSubmit(payload)`
// resolves when the request settles.
// v2 look (UX phase4 I §4-5): the day-number card (phone: flat gold with the
// big numeral; tablet: the gold-tint card with a gold 72 tile), the well
// fields, the approved Description placeholder "What this day focuses on".
export default function AddDayModal({ isOpen, onClose, context, day, affectedCount, onSubmit }) {
  const editing = Boolean(day);
  const { tablet } = useBuilderLayout();
  const { nextDayNumber, dayLimit, canAddDay } = context;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);
  // Focus moves to "Day name" when it opens.
  useSheetFocus(isOpen, { initialRef: titleRef });

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
      titleRef.current?.focus?.();
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
      : fullPlanMessage(dayLimit, 'configured');
  }

  return (
    <AppModal
      testID={editing ? 'edit-day-modal' : 'add-day-modal'}
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit day' : 'Add day'}
      size="lg"
      description={modalDescription}
      // FINAL-AUDIT batch 1 (5): the footer has the dismiss, so no phone ×.
      footerDismiss
      footer={
        <ModalActions fill>
          <PillButton testID="day-modal-cancel" title="Cancel" variant="secondary" size={tablet ? 'cta' : 'default'} onPress={onClose} />
          <PillButton
            testID="day-modal-submit"
            title={editing ? 'Update day' : 'Add day'}
            size={tablet ? 'cta' : 'default'}
            disabled={editing ? !isDayEdited(day, { title, description }) : !canAddDay}
            loading={saving}
            onPress={submit}
          />
        </ModalActions>
      }
    >
      {editing ? <AffectsNoticeBox count={affectedCount} /> : <DayNumberCard canAddDay={canAddDay} number={nextDayNumber || 1} tablet={tablet} />}
      {/* ⚠T4-1: required, though the helper calls it optional. */}
      <FormField
        ref={titleRef}
        testID="plan-day-title"
        label="Day name"
        variant="well"
        helperText="Optional labels like Chest & Triceps are easier to scan."
        value={title}
        error={errors.title}
        returnKeyType="done"
        onSubmitEditing={submit}
        onChangeText={(text) => {
          setTitle(text);
          setErrors((current) => ({ ...current, title: undefined }));
        }}
      />
      <FormField
        testID="plan-day-description"
        label="Description"
        variant="well"
        multiline
        rows={tablet ? 4 : 3}
        placeholder="What this day focuses on"
        helperText="Optional coaching notes for the day."
        value={description}
        onChangeText={setDescription}
      />
    </AppModal>
  );
}

// "Day number: **n** will be assigned automatically." (code copy) in the
// board's number card; the numeral is decorative (the sentence carries it).
// Day limit reached: the flat 4 % card, no numeral.
export function DayNumberCard({ canAddDay, number, tablet }) {
  if (!canAddDay) {
    return (
      <View testID="day-number-card" style={[styles.limit, tablet && styles.limitTablet]}>
        <Text {...CAP_BODY} style={[styles.limitText, tablet && styles.sentenceTablet]}>
          <Text style={styles.limitStrong}>Day limit reached.</Text> Remove a day before adding another one.
        </Text>
      </View>
    );
  }
  const sentence = (
    <Text {...CAP_BODY} style={tablet ? [styles.sentence, styles.sentenceTablet] : styles.sentence}>
      Day number: <Text style={tablet ? styles.strongTablet : styles.strong}>{number}</Text> will be assigned automatically.
    </Text>
  );
  if (tablet) {
    return (
      <View testID="day-number-card" style={styles.cardTablet}>
        <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text maxFontSizeMultiplier={1.3} style={styles.tileNumeral}>
            {number}
          </Text>
        </View>
        <View style={styles.sentenceBox}>{sentence}</View>
      </View>
    );
  }
  return (
    <View testID="day-number-card" style={styles.card}>
      <View pointerEvents="none" style={styles.ring} />
      <Text maxFontSizeMultiplier={1.3} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.numeral}>
        {number}
      </Text>
      <View style={styles.sentenceBox}>{sentence}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
    backgroundColor: colors.gold,
    overflow: 'hidden',
  },
  // Decorative ring, 140 at right -30 / bottom -50, 20 px ink 8 %.
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    right: -30,
    bottom: -50,
    borderRadius: radii.full,
    borderWidth: 20,
    borderColor: colors.inkFaint,
  },
  numeral: {
    ...font(700),
    fontSize: 64,
    lineHeight: 64,
    letterSpacing: -3.84,
    fontVariant: ['tabular-nums'],
    color: colors.onGold,
  },
  sentenceBox: {
    flex: 1,
    minWidth: 0,
  },
  // UX draws the sentence at ink 75 % (no token): onGoldMuted (72 %).
  sentence: {
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.onGoldMuted,
  },
  strong: {
    ...font(700),
    color: colors.onGold,
  },
  cardTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4_5'],
    borderRadius: radii.xl,
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.goldTint,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  tile: {
    width: 72,
    height: 72,
    borderRadius: radii.lgPlus,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileNumeral: {
    ...font(700),
    fontSize: 38,
    lineHeight: 42,
    fontVariant: ['tabular-nums'],
    color: colors.onGold,
  },
  sentenceTablet: {
    ...font(400),
    fontSize: 17,
    lineHeight: 24,
    color: colors.textStrong2,
  },
  strongTablet: {
    ...font(700),
    color: colors.textPrimary,
  },
  limit: {
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing['4_5'],
    backgroundColor: colors.fillWell,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  limitTablet: {
    paddingVertical: spacing['4_5'],
    paddingHorizontal: spacing[5],
  },
  limitText: {
    ...font(400),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  limitStrong: {
    ...font(700),
    color: colors.textPrimary,
  },
});
