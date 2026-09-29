import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getWebApiErrorMessage } from '../../shared/api/apiError';
import { Toast } from '../../shared/components/feedback';
import Spinner from '../../shared/components/Spinner';
import { colors, radii, shadows, textStyles } from '../../shared/theme/tokens';
import { createMyPlanSchedule, replaceMyPlanSchedule } from '../plans/api/plansApi';
import { ColorPressable, Eyebrow } from '../plans/components/PlanBits';
import { SelectedSummary, WeekdayGrid } from '../plans/components/WeekdayGrid';
import { plural, toggleWeekday, WEEKDAY_OPTIONS } from '../plans/planRules';

// S3 — first-run schedule for a trainer-assigned plan (RN-SPEC-plans §5).
// Unlike S2, R = planDays.length and every plan day is sent (never a slice).
export default function ScheduleSetupCard({ planName, planDays, enrollmentId, onScheduled }) {
  const requiredDays = planDays.length;
  // Seeded once; the parent mounts this only after the plan days load.
  const [selectedWeekdays, setSelectedWeekdays] = useState(() =>
    WEEKDAY_OPTIONS.slice(0, requiredDays).map((weekday) => weekday.id)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaveError('');
    if (selectedWeekdays.length !== requiredDays) {
      setSaveError(`Pick ${requiredDays} training day${requiredDays === 1 ? '' : 's'} to continue.`);
      return;
    }
    setIsSaving(true);
    const items = planDays.map((day, index) => ({
      workout_plan_day_id: day.id,
      weekday_id: selectedWeekdays[index],
    }));
    try {
      try {
        await createMyPlanSchedule(enrollmentId, { items });
      } catch (createError) {
        if (createError?.response?.status === 409) {
          await replaceMyPlanSchedule(enrollmentId, { items });
        } else {
          throw createError;
        }
      }
      onScheduled();
    } catch (submitError) {
      // The web's '||' fallback is unreachable, so it doesn't ship (RN-SPEC-plans §5).
      setSaveError(getWebApiErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View testID="schedule-setup-card" style={styles.card}>
      <Eyebrow>Set up your week</Eyebrow>
      <Text style={[textStyles.titleXl, styles.primary, styles.mt6]}>
        {`Pick ${requiredDays} training ${plural(requiredDays, 'day')}`}
      </Text>
      <Text style={[styles.body, styles.mt6]}>
        {`${planName || 'Your plan'} doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.`}
      </Text>

      {saveError ? (
        <View style={styles.mt16}>
          <Toast tone="error" title="Couldn’t save your days" message={saveError} />
        </View>
      ) : null}

      <WeekdayGrid
        selected={selectedWeekdays}
        onToggle={(weekdayId) => setSelectedWeekdays((current) => toggleWeekday(current, weekdayId, requiredDays))}
        style={styles.mt16}
      />
      <SelectedSummary selected={selectedWeekdays} />

      <View style={[styles.mt16, isSaving && styles.saving]}>
        <ColorPressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
          disabled={isSaving}
          onPress={handleSave}
          colorsFor={(pressed) => ({ backgroundColor: pressed ? colors.brand500 : colors.brand400 })}
          transitionMs={200}
          style={({ pressed }) => [styles.button, pressed && !isSaving && styles.buttonSunk]}
        >
          {isSaving ? (
            <Spinner size={16} thickness={2} trackColor={colors.navy} arcColor="transparent" />
          ) : null}
          <Text style={styles.buttonLabel}>Save training days</Text>
        </ColorPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.brandBorder,
    backgroundColor: colors.surface,
    padding: 20,
    boxShadow: shadows.plansSoft,
  },
  primary: {
    color: colors.textPrimary,
  },
  body: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
  // RN-SPEC-plans §5 (as the web's class conflicts resolve): shared Button,
  // 14px/600, fully rounded, 16×12, shadow-soft; 200ms transitions.
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.plansSoft,
  },
  // Pressed: brand-500, 1px sink, inset shadow-press replaces shadow-soft.
  buttonSunk: {
    transform: [{ translateY: 1 }],
    boxShadow: shadows.press,
  },
  saving: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.navy,
  },
  mt6: { marginTop: 6 },
  mt16: { marginTop: 16 },
});
