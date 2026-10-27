import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CAP_BODY, TITLE_TEXT } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import { colors, font, radii, spacing } from '../../../shared/theme/tokens';
import { openShellPath } from '../../shell/shellLinks';
import { workoutDaysLabel } from '../libraryFormat';
import WeekdayGrid from './WeekdayGrid';

// §4.6 ScheduleCard, v2 look (UX H): radius 28, padding 22; eyebrow 13/600
// gold, title 22/28/700, body 14/21 secondary, the 7 detail chips, then the
// full-width 56 CTA. `gold` = the page's one gold action ("Start workout
// plan", or "Update schedule" when no Today Start is on the page); otherwise
// the glass twin. Disabled + spinner while activating; disabled when
// trainer-locked (the parent passes `disabled`).
export default function PlanScheduleCard({ isCurrentPlan, requiredDays, selected, onToggle, isActivating, disabled, onSubmit, gold }) {
  return (
    <View testID="plan-schedule-card" style={styles.card}>
      <Text {...CAP_BODY} style={styles.eyebrow}>
        {isCurrentPlan ? 'Schedule' : 'Start this plan'}
      </Text>
      <Text {...TITLE_TEXT} accessibilityRole="header" style={styles.title}>
        {isCurrentPlan ? 'Your training days' : `Pick ${workoutDaysLabel(requiredDays)}`}
      </Text>
      <Text {...CAP_BODY} style={styles.body}>
        {isCurrentPlan
          ? `These are the ${requiredDays} day${requiredDays === 1 ? '' : 's'} you train on. Adjust them and tap update to reschedule.`
          : 'Choose the weekdays to train. Activating this plan replaces any current active plan.'}
      </Text>
      <WeekdayGrid selected={selected} onToggle={onToggle} testIDPrefix="plan-weekday" variant="detail" />
      <PillButton
        testID="plan-activate"
        title={isCurrentPlan ? 'Update schedule' : 'Start workout plan'}
        variant={gold ? 'primary' : 'secondary'}
        fullWidth
        loading={isActivating}
        disabled={disabled}
        onPress={onSubmit}
        style={styles.cta}
      />
    </View>
  );
}

// §4.5 (after a 409 on cancel): gold-tint box, gold-line edge, role status.
export function TrainerLockBanner() {
  const [pressed, setPressed] = useState(false);
  return (
    <View testID="plan-trainer-lock" accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.lockBanner}>
      <Text {...CAP_BODY} style={styles.lockTitle}>
        This plan is managed by your trainer
      </Text>
      <Text {...CAP_BODY} style={styles.lockBody}>
        You can’t switch plans while your trainer is coaching you. Your workouts, progress and training days all still
        work as normal — end coaching from{' '}
        <Text
          testID="plan-trainer-lock-link"
          accessibilityRole="link"
          onPress={() => openShellPath('/my-trainer')}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[styles.lockLink, pressed && styles.lockLinkPressed]}
        >
          My trainer
        </Text>{' '}
        if you want your plan back.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing['5_5'],
  },
  eyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  // 22/28/700 −0.02em.
  title: {
    ...font(700),
    marginTop: spacing['1_5'],
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.44,
    color: colors.textPrimary,
  },
  body: {
    ...font(400),
    marginTop: spacing['1_5'],
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  cta: {
    minHeight: 56,
    marginTop: spacing[5],
  },
  lockBanner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldTint,
    padding: spacing[4],
  },
  lockTitle: {
    ...font(700),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  lockBody: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  lockLink: {
    ...font(700),
    color: colors.gold,
  },
  lockLinkPressed: {
    textDecorationLine: 'underline',
  },
});
