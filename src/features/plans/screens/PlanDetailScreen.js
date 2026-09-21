import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../../navigation/routes';
import { replaceWithWorkout } from '../../../navigation/shell/libraryNavigation';
import { CompactHeader } from '../../../navigation/shell/PageHeaders';
import PageLayout from '../../../navigation/shell/PageLayout';
import { useFocusGeneration } from '../../../navigation/shell/useFocusGeneration';
import { getWebApiErrorMessage } from '../../../shared/api/apiError';
import { InlineError, Loader, Toast } from '../../../shared/components/feedback';
import { useColorTransition } from '../../../shared/hooks/useColorTransition';
import { colors, radii, shadows, textStyles } from '../../../shared/theme/tokens';
import { formatDateForInput } from '../../../shared/utils/timestamps';
import {
  cancelMyPlanEnrollment,
  createMyPlanEnrollment,
  createMyPlanSchedule,
  getCurrentPlan,
  getWorkoutPlan,
  getWorkoutPlanDayExercises,
  getWorkoutPlanDays,
  replaceMyPlanSchedule,
} from '../api/plansApi';
import DayRow from '../components/DayRow';
import { Eyebrow, Pill, SectionHeading, StatusBadge } from '../components/PlanBits';
import { ScheduleCard, TrainerLockBanner } from '../components/ScheduleCard';
import { initialWeekdaysFor, requiredScheduleDaysFor, toggleWeekday } from '../planRules';

// "‹ Plans": web hover:text-primary with transition-colors, applied while pressed.
function BackLink({ onPress }) {
  const [pressed, setPressed] = useState(false);
  const color = useColorTransition(pressed ? colors.textPrimary : colors.textMuted);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Plans"
      testID="back-to-plans"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.backLink}
    >
      <Animated.Text style={[styles.backChevron, { color }]}>‹</Animated.Text>
      <Animated.Text style={[styles.backLabel, { color }]}>Plans</Animated.Text>
    </Pressable>
  );
}

function StatCell({ value, label, truncate }) {
  return (
    <View style={styles.statCell}>
      <Text
        numberOfLines={truncate ? 1 : undefined}
        style={[textStyles.statValue, styles.primary, truncate && styles.statTruncate]}
      >
        {value}
      </Text>
      <Text style={[textStyles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// S2 content, keyed on the focus generation (RN-SPEC-plans §8.1).
function PlanDetailContent({ planId, generation, isCurrent, routeKey }) {
  const navigation = useNavigation();
  const [plan, setPlan] = useState(null);
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [dayExercisesByDay, setDayExercisesByDay] = useState({});
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [activationError, setActivationError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  // The lock belongs to an enrollment and is only discovered by a cancel 409
  // (§4.7, ⚠9). Lost on the next focus, as on the web.
  const [lockedEnrollmentId, setLockedEnrollmentId] = useState(null);

  const currentEnrollmentId = currentPlan?.enrollment?.id ?? null;
  const isTrainerLocked = lockedEnrollmentId !== null && lockedEnrollmentId === currentEnrollmentId;
  // Literal comparison, no null guards: with no plan and no enrollment this is
  // undefined === undefined → true (⚠8).
  const isCurrentPlan = currentPlan?.enrollment?.plan?.id === plan?.id;
  const requiredScheduleDays = requiredScheduleDaysFor(plan, days);

  useEffect(() => {
    let isMounted = true;
    const alive = () => isMounted && isCurrent(generation);

    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        // allSettled: no single failure fails the page (§4.2).
        const [planResult, daysResult, currentPlanResult] = await Promise.allSettled([
          getWorkoutPlan(planId),
          getWorkoutPlanDays(planId),
          getCurrentPlan().catch((currentPlanError) => {
            const httpStatus = currentPlanError?.response?.status;
            if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) {
              return null;
            }
            throw currentPlanError;
          }),
        ]);
        if (!alive()) {
          return;
        }

        const nextDays = daysResult.status === 'fulfilled' ? daysResult.value || [] : [];
        const matchingPlan =
          planResult.status === 'fulfilled' ? planResult.value?.plan || planResult.value || null : null;
        const exerciseResults = await Promise.allSettled(
          nextDays.map(async (day) => {
            const result = await getWorkoutPlanDayExercises(planId, day.id);
            return result || [];
          })
        );
        if (!alive()) {
          return;
        }

        const nextDayExercisesByDay = {};
        exerciseResults.forEach((result, index) => {
          const dayId = nextDays[index]?.id;
          if (!dayId) {
            return;
          }
          nextDayExercisesByDay[dayId] = result.status === 'fulfilled' ? result.value : [];
        });

        const nextCurrentPlan = currentPlanResult.status === 'fulfilled' ? currentPlanResult.value : null;
        // A trainer's private plan 404s on GET /plans/{id}; use the enrollment copy.
        const enrolledPlan =
          Number(nextCurrentPlan?.enrollment?.workout_plan_id) === Number(planId)
            ? nextCurrentPlan?.enrollment?.plan || null
            : null;
        const resolvedPlan = matchingPlan || enrolledPlan;

        setPlan(resolvedPlan);
        setDays(nextDays);
        setDayExercisesByDay(nextDayExercisesByDay);
        setCurrentPlan(nextCurrentPlan);
        setSelectedDayId(nextDays[0]?.id || null);
        const nextRequired = requiredScheduleDaysFor(resolvedPlan, nextDays);
        setSelectedWeekdays(initialWeekdaysFor(nextCurrentPlan, resolvedPlan, nextRequired));
        setStatus('loaded');
      } catch (loadError) {
        if (!alive()) {
          return;
        }
        setError(loadError);
        setStatus('error');
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [planId, generation, isCurrent]);

  const totalExercises = useMemo(
    () => Object.values(dayExercisesByDay).reduce((total, list) => total + list.length, 0),
    [dayExercisesByDay]
  );

  const handleWeekdayToggle = (weekdayId) => {
    setSelectedWeekdays((current) => toggleWeekday(current, weekdayId, requiredScheduleDays));
  };

  const handleActivate = async () => {
    setActivationError('');

    if (selectedWeekdays.length !== requiredScheduleDays) {
      setActivationError(
        `Select ${requiredScheduleDays} workout day${requiredScheduleDays === 1 ? '' : 's'} to continue.`
      );
      return;
    }

    setIsActivating(true);

    // Day 1 → earliest selected weekday; only the first N days are sent (⚠1).
    const items = days.slice(0, requiredScheduleDays).map((day, index) => ({
      workout_plan_day_id: day.id,
      weekday_id: selectedWeekdays[index],
    }));

    try {
      if (isCurrentPlan && currentEnrollmentId) {
        // Reschedule: PUT only, never cancel, so it works under the trainer lock.
        await replaceMyPlanSchedule(currentEnrollmentId, { items });
        replaceWithWorkout(navigation, routeKey, `${plan?.name || 'Plan'} schedule updated.`);
        return;
      }

      // Not atomic: cancel → create → schedule, no rollback (⚠2).
      if (currentEnrollmentId) {
        try {
          await cancelMyPlanEnrollment(currentEnrollmentId);
        } catch (cancelError) {
          if (cancelError?.response?.status === 409) {
            setLockedEnrollmentId(currentEnrollmentId);
            setActivationError(getWebApiErrorMessage(cancelError));
            return;
          }
          throw cancelError;
        }
      }

      const enrollmentResult = await createMyPlanEnrollment({
        workout_plan_id: Number(planId),
        started_on: formatDateForInput(new Date()),
      });
      const enrollmentId = enrollmentResult?.enrollment?.id || enrollmentResult?.id;

      try {
        await createMyPlanSchedule(enrollmentId, { items });
      } catch (scheduleError) {
        if (scheduleError?.response?.status === 409) {
          await replaceMyPlanSchedule(enrollmentId, { items });
        } else {
          throw scheduleError;
        }
      }

      replaceWithWorkout(navigation, routeKey, `${plan?.name || 'Plan'} activated.`);
    } catch (submitError) {
      if (submitError?.response?.status === 409) {
        setActivationError(
          getWebApiErrorMessage(submitError) ||
            'You already have an active plan. Finish or deactivate it before starting another one.'
        );
      } else {
        setActivationError(getWebApiErrorMessage(submitError) || 'Failed to activate this plan.');
      }
    } finally {
      setIsActivating(false);
    }
  };

  if (status === 'loading') {
    return <Loader label="Loading plan" />;
  }

  if (status === 'error') {
    return <InlineError title="Plan unavailable" message={error?.message || 'Please try again.'} />;
  }

  // ⚠12: both use days_per_week first, not the number of day rows.
  const dayCount = plan?.days_per_week || days.length;
  const difficulty = plan?.difficulty_level?.name;

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <BackLink onPress={() => navigation.push(routes.PlansList)} />
        {isCurrentPlan ? <StatusBadge label="Current plan" /> : null}
      </View>

      <View testID="summary-card" style={styles.summaryCard}>
        <Eyebrow>{plan?.category?.name || 'Workout plan'}</Eyebrow>
        <Text accessibilityRole="header" style={[textStyles.title2xl, styles.primary, styles.mt6]}>
          {plan?.name}
        </Text>
        {plan?.description ? (
          <Text numberOfLines={3} ellipsizeMode="tail" style={[styles.body, styles.mt8]}>
            {plan.description}
          </Text>
        ) : null}

        <View style={styles.statStrip}>
          <StatCell value={dayCount} label="Days" />
          <View style={styles.statDivider} />
          <StatCell value={totalExercises} label="Exercises" />
          <View style={styles.statDivider} />
          <StatCell value={difficulty || '—'} label="Level" truncate />
        </View>

        <View style={styles.pillRow}>
          <Pill>{`${dayCount}× / week`}</Pill>
        </View>
      </View>

      <View>
        <SectionHeading style={styles.daysHeading}>Workout days</SectionHeading>
        <View style={styles.dayList}>
          {days.map((day) => {
            const isOpen = selectedDayId === day.id;
            return (
              <DayRow
                key={day.id}
                day={day}
                exercises={dayExercisesByDay[day.id] || []}
                isOpen={isOpen}
                onToggle={() => setSelectedDayId(isOpen ? null : day.id)}
              />
            );
          })}
        </View>
      </View>

      <View>
        {activationError ? <Toast tone="error" title="Plan activation failed" message={activationError} /> : null}
        {isTrainerLocked ? (
          <TrainerLockBanner onOpenMyTrainer={() => navigation.navigate(routes.TrainerTab)} />
        ) : null}
        <ScheduleCard
          isCurrentPlan={isCurrentPlan}
          requiredDays={requiredScheduleDays}
          selected={selectedWeekdays}
          onToggle={handleWeekdayToggle}
          onSubmit={handleActivate}
          isActivating={isActivating}
          disabled={isActivating || (isTrainerLocked && !isCurrentPlan)}
        />
      </View>
    </View>
  );
}

// S2 — Plan detail.
export default function PlanDetailScreen() {
  const route = useRoute();
  const { generation, isCurrent } = useFocusGeneration();
  const planId = route.params?.planId;

  return (
    <PageLayout testID="plan-detail-screen">
      <CompactHeader />
      <View style={styles.pullUp}>
        {generation === 0 ? (
          <Loader label="Loading plan" />
        ) : (
          <PlanDetailContent
            key={generation}
            planId={planId}
            generation={generation}
            isCurrent={isCurrent}
            routeKey={route.key}
          />
        )}
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  pullUp: {
    marginTop: -20,
  },
  page: {
    gap: 20,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -8,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backChevron: {
    fontSize: 18,
    lineHeight: 18,
  },
  backLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  summaryCard: {
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
  statStrip: {
    marginTop: 16,
    flexDirection: 'row',
    borderRadius: radii.xxl,
    backgroundColor: colors.background,
    paddingVertical: 12,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statTruncate: {
    paddingHorizontal: 4,
    maxWidth: '100%',
  },
  pillRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  daysHeading: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dayList: {
    gap: 12,
  },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
});
