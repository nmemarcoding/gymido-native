import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { CardSurface } from '../../../shared/components/Card';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { Eyebrow } from '../../../shared/components/Typography';
import { breakpoints, colors, font, gradients, radii, spacing, typography } from '../../../shared/theme/tokens';
import ProgressRing from '../../workout/components/ProgressRing';
import { createSchedule, replaceSchedule } from '../api/libraryApi';
import { WEEKDAYS, selectedWeekdaysLabel, toggleWeekday } from '../libraryFormat';

// Phone rows (UX B §Schedule setup): Mon–Thu, then Fri–Sun (+ an empty cell).
const PHONE_ROWS = [WEEKDAYS.slice(0, 4), WEEKDAYS.slice(4)];

export function daysSelectedLabel(count, required) {
  return `${count} of ${required} days selected`;
}

// S3 (RN-SPEC-plans §5), shown on the Workout hub when a trainer-assigned
// enrollment has no schedule. Items come from every plan day (R = their count).
// v2 Phase 2 B2 (UX #43: a CARD on the Workout tab, not a route): phone =
// 4-column 64-tall chips + the "Selected" row with a 36 count badge (ND5);
// tablet (≥ 768) = 7 chips in one row (84 tall) + the 120 "n of R days
// selected" ring (ND5). Behaviour, copy and the API are v1's.
export default function ScheduleSetupCard({ planName, planDays, enrollmentId, onSaved }) {
  const { width } = useWindowDimensions();
  // Fixed at mount: the tablet glow is a gradient (Android render rule).
  const [tablet] = useState(() => width >= breakpoints.md);
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

  const toggle = (id) => setSelected((current) => toggleWeekday(current, id, required));
  const chip = (weekday) => (
    <DayChip key={weekday.id} weekday={weekday} on={selected.includes(weekday.id)} tablet={tablet} onPress={() => toggle(weekday.id)} />
  );
  const summary = selectedWeekdaysLabel(selected, true);
  const body = `${planName || 'Your plan'} doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.`;
  const error = saveError ? (
    <ErrorAlert testID="schedule-setup-error" title="Couldn’t save your days" description={saveError} style={tablet ? null : styles.mt12} />
  ) : null;
  const saveButton = (
    <PillButton
      testID="schedule-setup-save"
      title="Save training days"
      size="cta"
      fullWidth
      loading={saving}
      onPress={save}
      style={tablet ? null : styles.mt16}
    />
  );

  if (tablet) {
    return (
      <CardSurface hero testID="schedule-setup" style={[styles.card, styles.cardTablet]}>
        <View testID="schedule-setup-glow" pointerEvents="none" style={styles.glow}>
          <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={gradients.heroGlow.stops} />
        </View>
        <View style={styles.headerTablet}>
          <View style={styles.headerText}>
            <Eyebrow>Set up your week</Eyebrow>
            <Text textBreakStrategy="simple" accessibilityRole="header" style={[styles.titleTablet, styles.mt8]}>
              {`Pick ${required} `}
              <Text style={styles.gold}>{`training day${plural}`}</Text>
            </Text>
            <Text style={[styles.bodyTablet, styles.mt12]}>{body}</Text>
          </View>
          <ProgressRing value={selected.length} total={required} size={120} thickness={10} label={daysSelectedLabel(selected.length, required)}>
            <Text testID="schedule-setup-ring-count" style={styles.ringCount}>
              {selected.length}
            </Text>
          </ProgressRing>
        </View>
        <View role="group" accessibilityLabel="Training days" style={styles.gridTablet}>
          {WEEKDAYS.map(chip)}
        </View>
        <Text testID="schedule-setup-selected" accessibilityLiveRegion="polite" style={styles.selectedTablet}>
          {summary}
        </Text>
        {error}
        {saveButton}
      </CardSurface>
    );
  }

  return (
    <CardSurface hero testID="schedule-setup" style={[styles.card, styles.cardPhone]}>
      <Eyebrow>Set up your week</Eyebrow>
      <Text textBreakStrategy="simple" accessibilityRole="header" style={[styles.titlePhone, styles.mt6]}>
        {`Pick ${required} training day${plural}`}
      </Text>
      <Text style={[styles.bodyPhone, styles.mt12]}>{body}</Text>
      <View role="group" accessibilityLabel="Training days" style={styles.gridPhone}>
        {PHONE_ROWS.map((row, index) => (
          <View key={index} style={styles.rowPhone}>
            {row.map(chip)}
            {row.length < 4 ? <View style={styles.cellSpacer} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.selectedRow}>
        <View testID="schedule-setup-count" style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeText}>{selected.length}</Text>
        </View>
        <Text testID="schedule-setup-selected" accessibilityLiveRegion="polite" style={styles.selectedPhone}>
          {summary}
        </Text>
      </View>
      {error}
      {saveButton}
    </CardSurface>
  );
}

// A weekday toggle: gold + ring-selected + ✓ when on (the ✓ is decorative;
// the state is carried by `selected`), surface + hairline when off.
function DayChip({ weekday, on, tablet, onPress }) {
  return (
    <Pressable
      testID={`schedule-setup-weekday-${weekday.id}`}
      accessibilityRole="button"
      accessibilityLabel={weekday.name}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        tablet ? styles.chipTablet : styles.chipPhone,
        on ? [styles.chipOn, pressed && styles.chipOnPressed] : [styles.chipOff, tablet && styles.chipOffTablet, pressed && styles.chipOffPressed],
      ]}
    >
      <Text style={[tablet ? styles.chipTextTablet : styles.chipTextPhone, on ? styles.chipTextOn : [styles.chipTextOff, tablet && styles.chipTextOffTablet]]}>
        {weekday.label}
      </Text>
      {on ? (
        <Text style={[styles.check, tablet && styles.checkTablet]} accessibilityElementsHidden importantForAccessibility="no">
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Gold-tint edge (the code's brand border).
  card: {
    borderColor: colors.goldBorder,
  },
  cardPhone: {
    padding: spacing[5],
  },
  cardTablet: {
    padding: 36,
    gap: spacing[6],
  },
  glow: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 320,
    height: 320,
  },
  headerTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[6],
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    maxWidth: 440,
  },
  titlePhone: {
    ...typography.titleXl,
    color: colors.textPrimary,
  },
  titleTablet: {
    ...typography.displayMd,
    color: colors.textPrimary,
  },
  gold: {
    color: colors.gold,
  },
  bodyPhone: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bodyTablet: {
    ...font(400),
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  ringCount: {
    ...typography.displayMd,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  gridPhone: {
    marginTop: spacing[4],
    gap: spacing['2_5'],
  },
  rowPhone: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  cellSpacer: {
    flex: 1,
  },
  gridTablet: {
    flexDirection: 'row',
    gap: spacing['2_5'],
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    // Always 1 px so the chip keeps its size when it turns on.
    borderWidth: 1,
  },
  chipPhone: {
    minHeight: 64,
  },
  chipTablet: {
    minHeight: 84,
  },
  // ring-selected: a 2 px ground inset + a 1 px gold outer ring.
  chipOn: {
    backgroundColor: colors.gold,
    borderColor: colors.ground,
    boxShadow: `inset 0px 0px 0px 1px ${colors.ground}, 0px 0px 0px 1px ${colors.gold}`,
  },
  chipOnPressed: {
    backgroundColor: colors.goldDeep,
  },
  chipOff: {
    backgroundColor: colors.surface,
    borderColor: colors.hairlineStrong,
  },
  chipOffTablet: {
    backgroundColor: colors.fillChip,
  },
  chipOffPressed: {
    backgroundColor: colors.fillButton,
  },
  chipTextPhone: {
    fontSize: 15,
    lineHeight: 20,
  },
  chipTextTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  chipTextOn: {
    ...font(700),
    color: colors.onGold,
  },
  chipTextOff: {
    ...font(500),
    color: colors.textStrong2,
  },
  chipTextOffTablet: {
    ...font(600),
  },
  check: {
    ...font(700),
    position: 'absolute',
    top: 6,
    right: 9,
    fontSize: 11,
    lineHeight: 12,
    color: colors.onGold,
  },
  checkTablet: {
    top: 8,
    right: 10,
    fontSize: 12,
    lineHeight: 14,
  },
  // ND5 phone: the "Selected" row with its count badge.
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[5],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingVertical: spacing['3_5'],
    paddingHorizontal: spacing[4],
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldTint,
  },
  badgeText: {
    ...font(700),
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
  },
  selectedPhone: {
    ...typography.bodySm,
    flex: 1,
    minWidth: 0,
    color: colors.textStrong2,
  },
  selectedTablet: {
    ...font(400),
    fontSize: 16,
    lineHeight: 24,
    color: colors.textStrong2,
  },
  mt6: {
    marginTop: spacing['1_5'],
  },
  mt8: {
    marginTop: spacing[2],
  },
  mt12: {
    marginTop: spacing[3],
  },
  mt16: {
    marginTop: spacing[4],
  },
});
