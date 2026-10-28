import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { routes } from '../../../navigation/routes';
import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { RetryButton } from '../../../shared/components/ErrorAlert';
import { InlineError } from '../../../shared/components/FeedbackBox';
import { CAP_BODY } from '../../../shared/components/largeText';
import Loader from '../../../shared/components/Loader';
import StateSlot from '../../../shared/components/StateSlot';
import StatusPill from '../../../shared/components/StatusPill';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import { useFocusRemountKey } from '../../../shared/hooks/useFocusRemountKey';
import { breakpoints, colors, font, gradients, spacing } from '../../../shared/theme/tokens';
import { formatLocalDateForInput } from '../../../shared/time/format';
import CopyToMyPlansCard from '../../myPlans/components/CopyToMyPlansCard';
import ShellPage from '../../shell/ShellPage';
import { handOffToWorkout, openShellPath } from '../../shell/shellLinks';
import {
  cancelEnrollment,
  createSchedule,
  enrollInPlan,
  getCurrentPlan,
  getCurrentWeek,
  getPlan,
  listDayExercises,
  listPlanDays,
  replaceSchedule,
} from '../api/libraryApi';
import DayRow from '../components/DayRow';
import PlanScheduleCard, { TrainerLockBanner } from '../components/PlanScheduleCard';
import { PlanHero, PlanSummary } from '../components/PlanSummary';
import ThisWeek from '../components/ThisWeek';
import { BackToPlans, useIsTablet } from '../components/planUi';
import { useInnerBack } from '../../shell/useInnerBack';
import {
  buildScheduleItems,
  exerciseDetailId,
  initialWeekdays,
  thisWeekCards,
  toggleWeekday,
  workoutDaysLabel,
} from '../libraryFormat';
import { keepUnitsTogether } from '../../../shared/format/counts';

// The phone board's page glow: radial-gradient(110% 45% at 80% −8%,
// glow-gold-ambient 0.18, transparent 60%). The tablet hero draws its own.
export const PLAN_DETAIL_GLOW = Object.freeze({
  radial: Object.freeze({ cx: 0.8, cy: -0.08, rx: 1.1, ry: 0.45 }),
  colors: gradients.accountGlow.colors,
  stops: Object.freeze([0, 0.6]),
});

// S2 (RN-SPEC-plans §4), v2 look per UX H (Plan detail #9, Tablet: Plan
// detail #89). Every focus remounts and reloads (§8.1).
export default function PlanDetailScreen() {
  const remountKey = useFocusRemountKey();
  const { width } = useWindowDimensions();
  // Tablets stay tablets in both orientations, so the glow never toggles.
  const tablet = width >= breakpoints.md;
  return (
    <ShellPage testID="plan-detail-screen" glow={tablet ? false : PLAN_DETAIL_GLOW}>
      <PlanDetail key={remountKey} />
    </ShellPage>
  );
}

// Never throws synchronously, so a missing/broken call stays a settled
// rejection (⚠8: allSettled, no single failure fails the page).
const settle = (call) => Promise.resolve().then(call);

function PlanDetail() {
  const navigation = useNavigation();
  // T-65 (PHONE-NAV spec §3): "‹ Plans" goes back, else replaces to /plans (Android back the same).
  const goBack = useInnerBack(navigation, '/plans');
  const route = useRoute();
  const planId = route.params?.planId;
  const [load, setLoad] = useState({ status: 'loading' });
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [activationError, setActivationError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [lockedEnrollmentId, setLockedEnrollmentId] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  const tablet = useIsTablet();
  const mounted = useRef(true);
  const activating = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // §4.2: everything is allSettled, so no single failure fails the page (⚠8).
  useEffect(() => {
    let alive = true;
    (async () => {
      // Approved #9: the enrolled week is read with the rest (used only when
      // this plan is the current one; a failure just hides "This week").
      const [planResult, daysResult, currentResult, weekResult] = await Promise.allSettled([
        getPlan(planId),
        listPlanDays(planId),
        getCurrentPlan(),
        settle(() => getCurrentWeek()),
      ]);
      const current = currentResult.status === 'fulfilled' ? currentResult.value : null;
      const days = daysResult.status === 'fulfilled' ? daysResult.value : [];
      const exerciseResults = await Promise.allSettled(days.map((day) => listDayExercises(planId, day.id)));
      if (!alive) {
        return;
      }
      const exercisesByDay = {};
      days.forEach((day, index) => {
        const result = exerciseResults[index];
        exercisesByDay[day.id] = result.status === 'fulfilled' ? result.value : [];
      });
      const value = planResult.status === 'fulfilled' ? planResult.value : null;
      const matchingPlan = value ? value.plan || value : null;
      const enrolledPlan =
        Number(current?.enrollment?.workout_plan_id) === Number(planId) ? current.enrollment.plan : null;
      const plan = matchingPlan || enrolledPlan;
      // Audit b1 X4 (§4.2, 27 Oct 2026): no plan AND GET /plans/{id} rejected
      // with anything but a 404 → the error state, never the hollow page; a
      // 404 with no matching enrollment keeps ⚠8.
      if (!plan && planResult.status === 'rejected' && getStatus(planResult.reason) !== 404) {
        setLoad({ status: 'error', error: planResult.reason });
        return;
      }
      const requiredDays = days.length;
      // M5: only a plan the public endpoint returned can be copied.
      const isPublic = planResult.status === 'fulfilled';
      const week = weekResult.status === 'fulfilled' ? weekResult.value : [];
      setLoad({ status: 'loaded', plan, days, exercisesByDay, current, requiredDays, isPublic, week });
      setSelectedDayId(days[0]?.id ?? null);
      setSelectedWeekdays(initialWeekdays({ currentPlan: current, plan, requiredDays }));
    })().catch((error) => {
      // §4.2 / ⚠8: the web's `error` state ("Plan unavailable"), practically
      // unreachable (everything is allSettled) but never a stuck loader.
      if (alive) {
        setLoad({ status: 'error', error });
      }
    });
    return () => {
      alive = false;
    };
  }, [planId, reloadCount]);

  if (load.status === 'loading') {
    return (
      <StateSlot loader>
        <Loader label="Loading plan" />
      </StateSlot>
    );
  }
  if (load.status === 'error') {
    // UX D row 12: the transport text, else the fallback. N2 (approved):
    // the one Retry style under it re-runs the page load; the back stays.
    return (
      <View style={styles.page}>
        <BackToPlans tablet={tablet} onPress={goBack} />
        <StateSlot>
          <InlineError testID="plan-detail-error" title="Plan unavailable" message={load.error?.message || 'Please try again.'} />
          <RetryButton
            testID="plan-detail-retry"
            style={styles.retry}
            onPress={() => {
              setLoad({ status: 'loading' });
              setReloadCount((count) => count + 1);
            }}
          />
        </StateSlot>
      </View>
    );
  }

  const { plan, days, exercisesByDay, current, requiredDays, isPublic, week } = load;
  // ⚠8: compared literally, so no enrollment and no plan is `undefined === undefined`.
  const isCurrentPlan = current?.enrollment?.plan?.id === plan?.id;
  const currentEnrollmentId = current?.enrollment?.id;
  const isTrainerLocked = lockedEnrollmentId !== null && lockedEnrollmentId === current?.enrollment?.id;
  const totalExercises = days.reduce((sum, day) => sum + (exercisesByDay[day.id]?.length ?? 0), 0);
  // T-81 (PM ruling 3, RN-SPEC T-81): per-slot states from the /week status
  // + enrollment.started_on (already in GET /my-plans/current; absent → no
  // Not started cards). No /workouts call.
  const weekCards = isCurrentPlan ? thisWeekCards(week, exercisesByDay, { startedOn: current?.enrollment?.started_on, now: new Date() }) : null;
  // One gold action per page: the Today card's Start when it shows, else the
  // schedule CTA (UX H states; N6's rule on native).
  const scheduleGold = !weekCards?.today;
  const openExercise = (item) => navigation.push(routes.ExerciseDetail, { exerciseId: String(exerciseDetailId(item)) });

  // §4.7, exactly.
  async function handleActivate() {
    setActivationError('');
    if (selectedWeekdays.length !== requiredDays) {
      setActivationError(`Select ${workoutDaysLabel(requiredDays)} to continue.`);
      return;
    }
    // Review LOW: a ref guard, so a double tap before the re-render runs once.
    if (activating.current) {
      return;
    }
    activating.current = true;
    setIsActivating(true);
    const items = buildScheduleItems(days, selectedWeekdays, requiredDays);
    const name = keepUnitsTogether(plan?.name) || 'Plan';
    try {
      if (isCurrentPlan && currentEnrollmentId) {
        await replaceSchedule(currentEnrollmentId, items);
        handOffToWorkout(navigation, route, `${name} schedule updated.`);
        return;
      }
      if (currentEnrollmentId) {
        try {
          await cancelEnrollment(currentEnrollmentId);
          // The old enrollment is gone even if the enrol below fails: a retry
          // starts directly instead of cancelling it again (as M3 does).
          if (mounted.current) {
            setLoad((previous) => ({ ...previous, current: null }));
          }
        } catch (error) {
          if (getStatus(error) === 409) {
            if (mounted.current) {
              setLockedEnrollmentId(currentEnrollmentId);
              setActivationError(getServerMessage(error));
            }
            return;
          }
          throw error;
        }
      }
      const created = await enrollInPlan({ workout_plan_id: Number(planId), started_on: formatLocalDateForInput() });
      const enrollmentId = created.enrollment?.id ?? created.id;
      try {
        await createSchedule(enrollmentId, items);
      } catch (error) {
        if (getStatus(error) !== 409) {
          throw error;
        }
        await replaceSchedule(enrollmentId, items);
      }
      handOffToWorkout(navigation, route, `${name} activated.`);
    } catch (error) {
      if (mounted.current) {
        setActivationError(getServerMessage(error));
      }
    } finally {
      activating.current = false;
      if (mounted.current) {
        setIsActivating(false);
      }
    }
  }

  const topBar = (
    <View style={styles.topBar}>
      <BackToPlans tablet={tablet} onPress={goBack} />
      {isCurrentPlan ? <StatusPill testID="plan-detail-current" label="Current plan" tone={tablet ? 'active' : 'gold'} /> : null}
    </View>
  );

  const thisWeek = weekCards ? (
    <ThisWeek cards={weekCards} tablet={tablet} onStart={() => openShellPath('/workout')} onOpenExercise={openExercise} />
  ) : null;

  const workoutDays = (
    <View style={styles.daysSection}>
      <Text {...CAP_BODY} accessibilityRole="header" style={[styles.daysHeading, tablet && styles.daysHeadingTablet]}>
        Workout days
      </Text>
      <View style={styles.dayList}>
        {days.map((day) => (
          <DayRow
            key={day.id}
            day={day}
            tablet={tablet}
            exercises={exercisesByDay[day.id] ?? []}
            isOpen={selectedDayId === day.id}
            onToggle={() => setSelectedDayId((open) => (open === day.id ? null : day.id))}
            onOpenExercise={openExercise}
          />
        ))}
      </View>
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      {activationError ? (
        <InlineToast testID="plan-activation-error" tone={ToastTone.error} title="Plan activation failed" message={activationError} />
      ) : null}
      {isTrainerLocked ? <TrainerLockBanner /> : null}
      <PlanScheduleCard
        isCurrentPlan={isCurrentPlan}
        requiredDays={requiredDays}
        selected={selectedWeekdays}
        onToggle={(id) => setSelectedWeekdays((selected) => toggleWeekday(selected, id, requiredDays))}
        isActivating={isActivating}
        disabled={isActivating || (isTrainerLocked && !isCurrentPlan)}
        onSubmit={handleActivate}
        gold={scheduleGold}
      />
      {isPublic ? <CopyToMyPlansCard planId={planId} plan={plan} dayCount={days.length} /> : null}
    </View>
  );

  if (tablet) {
    return (
      <View style={[styles.page, styles.pageTablet]}>
        {topBar}
        <PlanHero plan={plan} dayCount={days.length} totalExercises={totalExercises} />
        {thisWeek}
        <View testID="plan-detail-columns" style={styles.columns}>
          <View style={styles.leftColumn}>{workoutDays}</View>
          <View style={styles.rightColumn}>{actions}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {topBar}
      <PlanSummary plan={plan} dayCount={days.length} totalExercises={totalExercises} />
      {thisWeek}
      {workoutDays}
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  pageTablet: {
    gap: spacing[4],
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing[3],
  },
  daysSection: {
    marginTop: spacing[2],
  },
  // 15/600 (phone) · 17/600 (tablet), padding 0 4, margin-bottom 12.
  daysHeading: {
    ...font(600),
    marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  daysHeadingTablet: {
    fontSize: 17,
    lineHeight: 22,
  },
  dayList: {
    gap: spacing[3],
  },
  actions: {
    gap: spacing[4],
  },
  // LEFT flex 999 1 480 · RIGHT flex 1 1 340, wrapping (portrait stacks).
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  leftColumn: {
    flexGrow: 999,
    flexShrink: 1,
    flexBasis: 480,
    minWidth: 0,
  },
  rightColumn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 340,
    minWidth: 0,
  },
});
