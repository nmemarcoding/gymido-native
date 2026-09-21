import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Spinner from '../../../shared/components/Spinner';
import { colors, radii, shadows, textStyles } from '../../../shared/theme/tokens';
import { plural } from '../planRules';
import { ColorPressable, Eyebrow } from './PlanBits';
import { SelectedSummary, WeekdayGrid } from './WeekdayGrid';

// TrainerLockBanner (§4.5): shown only after a cancel 409 proved the lock.
export function TrainerLockBanner({ onOpenMyTrainer }) {
  // Web `hover:underline`, applied while pressed (RN-SPEC-plans §9.1).
  const [linkPressed, setLinkPressed] = useState(false);
  return (
    <View accessibilityLiveRegion="polite" testID="trainer-lock-banner" style={styles.banner}>
      <Text style={styles.bannerTitle}>This plan is managed by your trainer</Text>
      <Text style={styles.bannerBody}>
        You can’t switch plans while your trainer is coaching you. Your workouts, progress and training days all
        still work as normal — end coaching from{' '}
        <Text
          accessibilityRole="link"
          onPress={onOpenMyTrainer}
          onPressIn={() => setLinkPressed(true)}
          onPressOut={() => setLinkPressed(false)}
          style={[styles.bannerLink, linkPressed && styles.bannerLinkPressed]}
        >
          My trainer
        </Text>{' '}
        if you want your plan back.
      </Text>
    </View>
  );
}

// ScheduleCard (§4.6).
export function ScheduleCard({ isCurrentPlan, requiredDays, selected, onToggle, onSubmit, isActivating, disabled }) {
  const pressedLabel = (pressed) => ({
    backgroundColor: pressed ? colors.brand500 : colors.brand400,
  });

  return (
    <View testID="schedule-card" style={styles.card}>
      <Eyebrow>{isCurrentPlan ? 'Schedule' : 'Start this plan'}</Eyebrow>
      <Text style={[textStyles.titleXl, styles.primary, styles.mt6]}>
        {isCurrentPlan ? 'Your training days' : `Pick ${requiredDays} workout ${plural(requiredDays, 'day')}`}
      </Text>
      <Text style={[styles.body, styles.mt6]}>
        {isCurrentPlan
          ? `These are the ${requiredDays} ${plural(requiredDays, 'day')} you train on. Adjust them and tap update to reschedule.`
          : 'Choose the weekdays to train. Activating this plan replaces any current active plan.'}
      </Text>

      <WeekdayGrid selected={selected} onToggle={onToggle} style={styles.mt16} />
      <SelectedSummary selected={selected} />

      {/* Disabled = 60% opacity, applied instantly (not part of transition-colors). */}
      <View style={[styles.ctaWrap, disabled && styles.disabled]}>
        <ColorPressable
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: isActivating }}
          disabled={disabled}
          onPress={onSubmit}
          colorsFor={pressedLabel}
          style={styles.cta}
        >
          {isActivating ? (
            <Spinner size={20} thickness={2} trackColor={colors.spinnerTrackNavy} arcColor={colors.navy} />
          ) : null}
          <Text style={styles.ctaLabel}>{isCurrentPlan ? 'UPDATE SCHEDULE' : 'START WORKOUT PLAN'}</Text>
        </ColorPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: 16,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.brandBorder,
    backgroundColor: colors.brand50,
    padding: 16,
  },
  bannerTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bannerBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  bannerLink: {
    fontWeight: '700',
    color: colors.brand700,
  },
  bannerLinkPressed: {
    textDecorationLine: 'underline',
  },
  card: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
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
  ctaWrap: {
    marginTop: 20,
  },
  disabled: {
    opacity: 0.6,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.xxl,
    paddingVertical: 16,
    boxShadow: shadows.plansGlow,
  },
  ctaLabel: {
    ...textStyles.ctaLarge,
    color: colors.navy,
  },
  mt6: { marginTop: 6 },
  mt16: { marginTop: 16 },
});
