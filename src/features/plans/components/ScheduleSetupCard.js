import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { CardSurface } from '../../../shared/components/Card';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import GradientFill from '../../../shared/components/GradientFill';
import PillButton from '../../../shared/components/PillButton';
import { Eyebrow } from '../../../shared/components/Typography';
import { breakpoints, colors, font, gradients, radii, spacing, textScale, typography } from '../../../shared/theme/tokens';
import ProgressRing from '../../workout/components/ProgressRing';
import { createSchedule, replaceSchedule } from '../api/libraryApi';
import { WEEKDAYS, selectedWeekdaysLabel, toggleWeekday } from '../libraryFormat';
import { formatCount, keepUnitsTogether, NBSP, pluralWord } from '../../../shared/format/counts';

// Phone rows (UX B §Schedule setup): Mon–Thu, then Fri–Sun (+ an empty cell).
const PHONE_ROWS = [WEEKDAYS.slice(0, 4), WEEKDAYS.slice(4)];

// UX §9 large text. The 36/44 titles are display-sized (cap 1.3), wrap by
// word (max 3 lines) and shrink a single long word; body and chip labels
// scale to 2.0; the counts in fixed geometry (the 36 badge, the 120 ring,
// the ✓) cap at 1.2.
const TITLE = { numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7, textBreakStrategy: 'simple', maxFontSizeMultiplier: textScale.display };
const BODY = { maxFontSizeMultiplier: textScale.body };
const BADGE = { maxFontSizeMultiplier: textScale.badge };

export function daysSelectedLabel(count, required) {
  return `${count} of ${formatCount(required, 'day', 'days')} selected`;
}

// S3 (RN-SPEC-plans §5), shown on the Workout hub when a trainer-assigned
// enrollment has no schedule. Items come from every plan day (R = their count).
// v2 Phase 2 B2 (UX #43: a CARD on the Workout tab, not a route): phone =
// 4-column 64-tall chips + the "Selected" row with a 36 count badge (ND5);
// tablet (≥ 768) = 7 chips in one row (84 tall) + the 120 "n of R days
// selected" ring (ND5). Behaviour, copy and the API are v1's.
// T-76 C2: the Workout hub opens this card in place of its "Set up your
// week" card; there it also gets `onCancel` (a ghost "Cancel" under Save that
// goes back) and `headingRef` (focus moves to the heading on open).
// T-53 D (onboarding "Pick your days"): the same card on its own page, where
// the secondary reads "Later" as a 44 text button (`cancelLabel`, `cancelSize`).
export default function ScheduleSetupCard({ planName, planDays, enrollmentId, onSaved, onCancel, headingRef, cancelLabel = 'Cancel', cancelSize = 'default' }) {
  const { width, fontScale } = useWindowDimensions();
  // §9 reflow (live): the chips wrap 2 (phone) / 4 (tablet) per row and the
  // tablet ring drops below the title.
  const reflow = fontScale > textScale.reflowAbove;
  // Fixed at mount: the tablet glow is a gradient (Android render rule).
  const [tablet] = useState(() => width >= breakpoints.md);
  const required = planDays.length;
  const [selected, setSelected] = useState(() => WEEKDAYS.slice(0, required).map((weekday) => weekday.id));
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const pick = `Pick ${formatCount(required, 'training day', 'training days')}`;

  async function save() {
    setSaveError('');
    if (selected.length !== required) {
      setSaveError(`${pick} to continue.`);
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
    <DayChip key={weekday.id} weekday={weekday} on={selected.includes(weekday.id)} tablet={tablet} reflow={reflow} onPress={() => toggle(weekday.id)} />
  );
  const summary = selectedWeekdaysLabel(selected, true);
  const body = `${keepUnitsTogether(planName) || 'Your plan'} doesn’t have training days yet. Choose the weekdays you train and we’ll line up your sessions.`;
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
  const cancelButton = onCancel ? (
    <PillButton testID="schedule-setup-cancel" title={cancelLabel} variant="ghost" size={cancelSize} fullWidth disabled={saving} onPress={onCancel} style={styles.mt8} />
  ) : null;

  if (tablet) {
    return (
      <CardSurface hero testID="schedule-setup" style={styles.cardTablet}>
        <View testID="schedule-setup-glow" pointerEvents="none" style={styles.glow}>
          <GradientFill radial={gradients.heroGlow.radial} colors={gradients.heroGlow.colors} stops={gradients.heroGlow.stops} />
        </View>
        <View testID="schedule-setup-header" style={[styles.headerTablet, reflow && styles.headerStacked]}>
          <View style={[styles.headerText, reflow && styles.headerTextStacked]}>
            <Eyebrow>Set up your week</Eyebrow>
            <Text ref={headingRef} accessibilityRole="header" {...TITLE} style={[styles.titleTablet, styles.mt8]}>
              {`Pick ${required}${NBSP}`}
              <Text style={styles.gold}>{pluralWord(required, 'training day', 'training days')}</Text>
            </Text>
            <Text {...BODY} style={[styles.bodyTablet, styles.mt12]}>
              {body}
            </Text>
          </View>
          <ProgressRing value={selected.length} total={required} size={120} thickness={10} label={daysSelectedLabel(selected.length, required)}>
            <Text testID="schedule-setup-ring-count" {...BADGE} style={styles.ringCount}>
              {selected.length}
            </Text>
          </ProgressRing>
        </View>
        <View testID="schedule-setup-days" role="group" accessibilityLabel="Training days" style={[styles.gridTablet, reflow && styles.gridWrap]}>
          {WEEKDAYS.map(chip)}
        </View>
        <Text testID="schedule-setup-selected" accessibilityLiveRegion="polite" {...BODY} style={styles.selectedTablet}>
          {summary}
        </Text>
        {error}
        {saveButton}
        {cancelButton}
      </CardSurface>
    );
  }

  return (
    <CardSurface hero testID="schedule-setup" style={styles.cardPhone}>
      <Eyebrow>Set up your week</Eyebrow>
      <Text ref={headingRef} accessibilityRole="header" {...TITLE} style={[styles.titlePhone, styles.mt6]}>
        {pick}
      </Text>
      <Text {...BODY} style={[styles.bodyPhone, styles.mt12]}>
        {body}
      </Text>
      {reflow ? (
        <View testID="schedule-setup-days" role="group" accessibilityLabel="Training days" style={[styles.gridPhone, styles.gridWrap]}>
          {WEEKDAYS.map(chip)}
        </View>
      ) : (
        <View testID="schedule-setup-days" role="group" accessibilityLabel="Training days" style={styles.gridPhone}>
          {PHONE_ROWS.map((row, index) => (
            <View key={index} style={styles.rowPhone}>
              {row.map(chip)}
              {row.length < 4 ? <View style={styles.cellSpacer} /> : null}
            </View>
          ))}
        </View>
      )}
      <View style={styles.selectedRow}>
        <View testID="schedule-setup-count" style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text {...BADGE} style={styles.badgeText}>
            {selected.length}
          </Text>
        </View>
        <Text testID="schedule-setup-selected" accessibilityLiveRegion="polite" {...BODY} style={styles.selectedPhone}>
          {summary}
        </Text>
      </View>
      {error}
      {saveButton}
      {cancelButton}
    </CardSurface>
  );
}

// A weekday toggle: gold + ring-selected + ✓ when on (the ✓ is decorative;
// the state is carried by `selected`), surface + hairline when off. Pressed
// follows the STATE RULE (§8.6): the rest colour + a 4 % overlay (ink on
// gold, white on dark), never a new fill.
function DayChip({ weekday, on, tablet, reflow, onPress }) {
  const testID = `schedule-setup-weekday-${weekday.id}`;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={weekday.name}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        styles.chip,
        tablet ? styles.chipTablet : styles.chipPhone,
        reflow && (tablet ? styles.chipWrapTablet : styles.chipWrapPhone),
        on ? [styles.chipOn, tablet && styles.chipOnTablet] : [styles.chipOff, tablet && styles.chipOffTablet],
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed ? (
            <View
              testID={`${testID}-pressed`}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.chipOverlay, tablet && styles.chipOverlayTablet, on ? styles.chipOverlayInk : styles.chipOverlayWhite]}
            />
          ) : null}
          <Text
            {...BODY}
            style={[tablet ? styles.chipTextTablet : styles.chipTextPhone, on ? styles.chipTextOn : [styles.chipTextOff, tablet && styles.chipTextOffTablet]]}
          >
            {weekday.label}
          </Text>
          {on ? (
            <Text {...BADGE} style={[styles.check, tablet && styles.checkTablet]} accessibilityElementsHidden importantForAccessibility="no">
              ✓
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Phone: the code's gold edge on the ladder (gold-line 0.30; no phone
  // card board, UX #43). Tablet: the hero card's own hairline, as drawn.
  cardPhone: {
    borderColor: colors.goldLine,
    padding: spacing[5],
  },
  // Tablet board: radius 32 (radii.xxxl; the hero card's own is 28).
  cardTablet: {
    borderRadius: radii.xxxl,
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
  headerStacked: {
    flexDirection: 'column',
  },
  // flex:1 would collapse in a column.
  headerTextStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  titlePhone: {
    ...typography.titleXl,
    color: colors.textPrimary,
  },
  // Board: 44/46 (display-md is 44/44).
  titleTablet: {
    ...typography.displayMd,
    lineHeight: 46,
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
  // §9: the chip row wraps (never scrolls or squeezes a label mid-word).
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2_5'],
  },
  chipWrapPhone: {
    flexBasis: '40%',
  },
  chipWrapTablet: {
    flexBasis: '20%',
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
  // Tablet board: radius 22 (radii.lgPlus; phone keeps radius-lg 20).
  chipTablet: {
    minHeight: 84,
    borderRadius: radii.lgPlus,
  },
  // ring-selected: a 2 px ground inset + a 1 px gold outer ring (phone).
  chipOn: {
    backgroundColor: colors.gold,
    borderColor: colors.ground,
    boxShadow: `inset 0px 0px 0px 1px ${colors.ground}, 0px 0px 0px 1px ${colors.gold}`,
  },
  // Tablet board: the 2 px ground inset + a 0 12 30 −12 glow in gold-strong
  // (ladder: 0.6), no outer ring.
  chipOnTablet: {
    boxShadow: `inset 0px 0px 0px 1px ${colors.ground}, 0px 12px 30px -12px ${colors.goldStrong}`,
  },
  chipOff: {
    backgroundColor: colors.surface,
    borderColor: colors.hairlineStrong,
  },
  // Tablet board: white 0.05 → fill-subtle (fillWell 0.04, UX §8.5).
  chipOffTablet: {
    backgroundColor: colors.fillWell,
  },
  chipOverlay: {
    borderRadius: radii.lg - 1,
  },
  chipOverlayTablet: {
    borderRadius: 21,
  },
  chipOverlayInk: {
    backgroundColor: colors.pressOverlayInk,
  },
  chipOverlayWhite: {
    backgroundColor: colors.pressOverlay,
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
