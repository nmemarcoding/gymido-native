import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import Spinner from '../../../shared/components/Spinner';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import { colors, radii, shadows } from '../../../shared/theme/tokens';
import { createSchedule, replaceSchedule } from '../api/libraryApi';
import { WEEKDAYS, toggleWeekday } from '../libraryFormat';
import { Eyebrow, planStyles } from './PlanBits';
import WeekdayGrid from './WeekdayGrid';

// S3 (RN-SPEC-plans §5), shown on the Workout hub when a trainer-assigned
// enrollment has no schedule. Items come from every plan day (R = their count).
export default function ScheduleSetupCard({ planName, planDays, enrollmentId, onSaved }) {
  const required = planDays.length;
  const [selected, setSelected] = useState(() => WEEKDAYS.slice(0, required).map((weekday) => weekday.id));
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const plural = required === 1 ? '' : 's';

  async function save() {
    setSaveError('');
    if (selected.length !== required) {
      setSaveError(`Pick ${required} training day${plural} to continue.`);
      return;
    }
    setSaving(true);
    const items = planDays.map((day, index) => ({ workout_plan_day_id: day.id, weekday_id: selected[index] }));
    try {
      try {
        await createSchedule(enrollmentId, items);
      } catch (error) {
        if (getStatus(error) !== 409) {
          throw error;
        }
        await replaceSchedule(enrollmentId, items);
      }
      await onSaved();
    } catch (error) {
      setSaveError(getServerMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View testID="schedule-setup" style={[planStyles.card, styles.card]}>
      <Eyebrow>Set up your week</Eyebrow>
      <Text textBreakStrategy="simple" style={[planStyles.titleXl, styles.mt6]}>{`Pick ${required} training day${plural}`}</Text>
      <Text style={[planStyles.body, styles.mt6]}>
        {`${planName || 'Your plan'} doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.`}
      </Text>
      {saveError ? (
        <InlineToast
          testID="schedule-setup-error"
          tone={ToastTone.error}
          title="Couldn’t save your days"
          message={saveError}
          style={styles.mt16}
        />
      ) : null}
      <WeekdayGrid
        selected={selected}
        onToggle={(id) => setSelected((current) => toggleWeekday(current, id, required))}
        testIDPrefix="schedule-setup-weekday"
        fullNames
      />
      <Pressable
        testID="schedule-setup-save"
        accessibilityRole="button"
        accessibilityState={{ disabled: saving, busy: saving }}
        disabled={saving}
        onPress={save}
        style={({ pressed }) => [styles.save, pressed && !saving ? styles.savePressed : styles.saveResting, saving && styles.saving]}
      >
        {saving ? <Spinner size={16} thickness={2} color={colors.navy} track="transparent" /> : null}
        <Text style={styles.saveText}>Save training days</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.trainerLockBorder,
    padding: 20,
  },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.brand400,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveResting: {
    boxShadow: shadows.soft,
  },
  savePressed: {
    backgroundColor: colors.brand500,
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  saving: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.navy,
  },
  mt6: {
    marginTop: 6,
  },
  mt16: {
    marginTop: 16,
  },
});
