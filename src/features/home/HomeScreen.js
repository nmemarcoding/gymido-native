import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import CatchUpRow from '../../shared/components/CatchUpRow';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import { InlineToast } from '../../shared/components/ToastHost';
import { ToastTone } from '../../shared/components/toastStore';
import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { useSheetFocus } from '../../shared/hooks/useSheetFocus';
import { breakpoints, colors, textScale, typography } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getCurrentPlan, listPlanDays } from '../plans/api/libraryApi';
import { catchUpConfirmCopy, catchUpRowCopy } from '../plans/missedCatchUp';
import { startDateKey, weekProgressByDate } from '../plans/weekByDate';
import { applySavedWeightLog, useProfileStore } from '../profile/profileStore';
import { askReminderPermissionOnTrainingDay } from '../reminders/reminderSignals';
import ShellPage from '../shell/ShellPage';
import { openPlanDetailAlone, openShellPath } from '../shell/shellLinks';
import { getCurrentWeek, getDashboard } from './api/homeApi';
import {
  avatarInitials,
  defaultWeightUnit,
  greetingLine,
  heroDayTitle,
  heroImageUrl,
  recentWorkoutMeta,
  isSessionOpen,
  todayCard,
  todayDateLabel,
  todayEmptyStats,
  todayExerciseCount,
  weekRing,
  weekStrip,
  weightCard,
} from './homeFormat';
import { RecentWorkouts, TodayHero, TodayStats, WeekCard, WeightCard, WeightValues } from './TodayPlanView';
import { LARGE_TEXT as LT, TodayEmpty, TodayError, TodayHeader, TodayLoading, useReflow } from './TodayStates';
import { getCurrentWorkout, listCompletedWorkouts } from '../workout/api/workoutApi';
import { verifySessionState } from '../workout/runtime/workoutSessionStore';
import WeightLogModal from './WeightLogModal';

const SAVED_TOAST_MS = 3500;
// Stat values (18–20 px): the title cap, never shrunk.
const VALUE_TEXT = { maxFontSizeMultiplier: textScale.title };

// Home (RN-SPEC-home), the Today tab root. Every focus is a fresh mount
// (plans §8.1). v2 Phase 2 B3: the Today header in every state, and the
// empty / error / loading states (TodayStates.js); the ambient gold glow
// from the first render.
export default function HomeScreen() {
  const remountKey = useFocusRemountKey();
  return (
    <ShellPage glow>
      <Home key={remountKey} />
    </ShellPage>
  );
}

// Batch B #3: days > 0 and no schedule → the day count, else null. Any
// failure simply means no setup card. ND4: the same days request also
// gives today's exercises_count (no second call); failure → no days.
// T-81: the same /my-plans/current read gives enrollment.started_on (date
// only, never converted to local); none / failure → null (no Not-started day).
async function loadPlanDays() {
  let startedOn = null;
  try {
    const current = await getCurrentPlan();
    startedOn = startDateKey(current?.enrollment?.started_on);
    const planId = current?.enrollment?.plan?.id;
    if (!planId) {
      return { setupDayCount: null, days: null, startedOn };
    }
    const days = await listPlanDays(planId);
    const setupDayCount = days.length > 0 && (current.schedule || []).length === 0 ? days.length : null;
    return { setupDayCount, days, startedOn };
  } catch {
    return { setupDayCount: null, days: null, startedOn };
  }
}

// U1 + T-81: /my-plans/current/week, then the week's completed workouts
// (GET /workouts?status=completed, week[0].date..week[6].date). Never
// rejects: no week (404 / failure) → { week: null } (the strip hides, the
// ring keeps quick_stats); a failed workouts read → [] (the strip still
// shows from /week).
export async function loadWeek() {
  let week = null;
  try {
    week = await getCurrentWeek();
  } catch {
    week = null;
  }
  if (!Array.isArray(week) || week.length !== 7) {
    return { week: null, completed: [] };
  }
  const startDate = week[0]?.date;
  const endDate = week[6]?.date;
  if (!startDate || !endDate) {
    return { week, completed: [] };
  }
  try {
    const completed = await listCompletedWorkouts({ startDate, endDate });
    return { week, completed: Array.isArray(completed) ? completed : [] };
  } catch {
    return { week, completed: [] };
  }
}

function Home() {
  const email = useAuthStore((state) => state.user?.email);
  const { width } = useWindowDimensions();
  // Fixed per mount (every Today focus remounts): the states draw gradients,
  // which are never swapped on a later change (Android render rule).
  const [tablet] = useState(() => width >= breakpoints.md);
  // §9 reflow (live): stat columns → label/value rows, trailing pills below,
  // the button pair stacks.
  const reflow = useReflow();
  const [load, setLoad] = useState({ status: 'loading', dashboard: null, error: null });
  // T-24 (25 Oct 2026): the ProfileGate already loaded the profile; Home reads the store.
  const profile = useProfileStore((state) => state.profile);
  const [setupDayCount, setSetupDayCount] = useState(null);
  // ND4: the plan's days (GET /plans/{id}/days), for today's exercise count.
  const [planDays, setPlanDays] = useState(null);
  // U1: the week strip; null (hidden) until loaded or on any failure.
  // T-81: + the week's completed workouts and enrollment.started_on.
  const [week, setWeek] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [startedOn, setStartedOn] = useState(null);
  // T-63: GET /workouts/current gave a session → "Resume workout".
  const [sessionOpen, setSessionOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  // T-102: the Catch-up row's T-80 confirm (mounted on the first ask and
  // kept for its close animation); focus returns to the row on Cancel.
  const [catchUpConfirm, setCatchUpConfirm] = useState(null);
  const [confirmMounted, setConfirmMounted] = useState(false);
  const catchUpRef = useRef(null);
  const confirmReturnRef = useRef(null);
  useSheetFocus(Boolean(catchUpConfirm), { returnRef: confirmReturnRef });
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // H1.1 (T-24, 25 Oct 2026): only GET /dashboard; no profile request.
  useEffect(() => {
    const setupLoad = loadPlanDays().then((result) => {
      if (mounted.current) {
        setSetupDayCount(result.setupDayCount);
        setPlanDays(result.days);
        setStartedOn(result.startedOn);
      }
    });
    // U1: optional, never fails the page. T-81: the page waits for it (and
    // its workouts read) so the ring never switches from quick_stats to the
    // /week numbers after it shows.
    const weekLoad = loadWeek().then((result) => {
      if (mounted.current) {
        setWeek(result.week);
        setCompleted(result.completed);
      }
    });
    // T-63 (H1.3 dated 27 Oct): one GET /workouts/current per load, in
    // parallel; a failed read keeps the usual label. The same read is the
    // T-59 re-check: a workout ended elsewhere must not leave its stored rest
    // alert scheduled while the user stays on Today.
    const current = getCurrentWorkout();
    verifySessionState({ fetchCurrent: () => current });
    const sessionLoad = current.then(
      (session) => mounted.current && setSessionOpen(isSessionOpen(session)),
      () => {}
    );
    Promise.allSettled([getDashboard(), setupLoad, sessionLoad, weekLoad]).then(([dashboard]) => {
      if (!mounted.current) {
        return;
      }
      if (dashboard.status === 'fulfilled') {
        setLoad({ status: 'loaded', dashboard: dashboard.value, error: null });
      } else {
        setLoad({ status: 'error', dashboard: null, error: dashboard.reason });
      }
    });
  }, []);

  // T-103 (UX ruling §4, owner 29 Oct 2026; amends T-50): the one OS
  // notification prompt, once Today has loaded a training day of an active
  // plan (asked once ever; the workout start stays the fallback).
  const trainingDay = load.status === 'loaded' && Boolean(load.dashboard?.today_status?.is_workout_day);
  useEffect(() => {
    if (trainingDay) {
      askReminderPermissionOnTrainingDay().catch(() => {});
    }
  }, [trainingDay]);

  // H1.7: after a weight log, refresh quietly; failures keep the old content.
  // T-24: the dashboard only; the profile store was patched from the log.
  const quietRefresh = useCallback(() => {
    getDashboard()
      .then((dashboard) => mounted.current && setLoad((current) => ({ ...current, dashboard })))
      .catch(() => {});
  }, []);

  // ⚠H-8: the timer starts when the message first appears; a second log sets
  // the same text and does not restart it.
  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setSuccessMessage(''), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const header = (
    <TodayHeader
      tablet={tablet}
      initials={avatarInitials(profile, email)}
      dateLabel={todayDateLabel()}
      greeting={greetingLine(profile, email)}
    />
  );

  if (load.status === 'loading') {
    return (
      <View style={styles.page}>
        {header}
        <TodayLoading tablet={tablet} />
      </View>
    );
  }
  if (load.status === 'error') {
    // ⚠H-1: the transport text, no retry.
    return (
      <View style={styles.page}>
        {header}
        <TodayError tablet={tablet} message={load.error?.message} />
      </View>
    );
  }

  const { dashboard } = load;
  const plan = dashboard?.current_plan?.enrollment?.plan;
  const weight = weightCard(dashboard, profile);
  const unit = defaultWeightUnit(profile);
  const recent = dashboard?.recent_workouts ?? [];
  const toast = successMessage ? (
    <InlineToast testID="home-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} />
  ) : null;
  const weightValues = <WeightValues weight={weight} reflow={reflow} StatRow={StatRow} />;
  const recentList = <RecentWorkouts recent={recent} metaOf={(workout) => recentWorkoutMeta(workout, unit)} tablet={tablet} reflow={reflow} />;
  const weightModal = (
    <WeightLogModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      defaultUnit={unit}
      onSuccess={(saved) => {
        applySavedWeightLog(saved);
        setSuccessMessage('Weight logged successfully.');
        quietRefresh();
      }}
    />
  );

  if (!plan) {
    return (
      <View style={styles.page}>
        {toast}
        {header}
        <TodayEmpty
          tablet={tablet}
          stats={todayEmptyStats(dashboard)}
          weight={weight}
          weightValues={weightValues}
          recentEmpty={recent.length === 0}
          recentList={recentList}
          onChoosePlan={() => openShellPath('/plans')}
          onBuildPlan={() => openShellPath('/plans/generate')}
          onSeeProgress={() => openShellPath('/progress')}
          onAddWeight={() => setModalOpen(true)}
        />
        {weightModal}
      </View>
    );
  }

  const strip = weekStrip({ week, completed, startedOn });
  const card = todayCard(dashboard, setupDayCount, sessionOpen);
  return (
    <View style={[styles.page, tablet && styles.pageTablet]}>
      {toast}
      {header}
      <TodayHero
        plan={plan}
        card={card}
        tablet={tablet}
        reflow={reflow}
        imageUrl={heroImageUrl(dashboard)}
        dayTitle={heroDayTitle(dashboard, card)}
        dayOfWeek={strip?.dayOfWeek}
        exerciseCount={card.state === 'training' ? todayExerciseCount(planDays, dashboard) : null}
        onPrimary={() => openShellPath('/workout')}
        onViewPlan={() => openPlanDetailAlone(plan.id)}
      />
      {card.catchUp ? (
        <CatchUpRow
          ref={catchUpRef}
          testID="home-catch-up"
          copy={catchUpRowCopy(card.catchUp)}
          onPress={() => {
            confirmReturnRef.current = catchUpRef.current;
            setConfirmMounted(true);
            setCatchUpConfirm({
              dayId: card.catchUp.miss.planDay?.id,
              ...catchUpConfirmCopy({ miss: card.catchUp.miss, base: card.base, todayTitle: dashboard?.today_status?.plan_day?.title ?? '' }),
            });
          }}
        />
      ) : null}
      <TodayStats ring={weekRing(dashboard, weekProgressByDate({ week, startedOn }))} tablet={tablet} reflow={reflow} />
      {strip ? <WeekCard strip={strip} tablet={tablet} reflow={reflow} onSeeProgress={() => openShellPath('/progress')} /> : null}
      <WeightCard
        hasData={weight.hasData}
        weightValues={weightValues}
        tablet={tablet}
        reflow={reflow}
        onSeeProgress={() => openShellPath('/progress')}
        onAddWeight={() => setModalOpen(true)}
      />
      {recentList}
      {weightModal}
      {confirmMounted ? (
        <ConfirmDialog
          testID="home-catch-up-confirm"
          isOpen={Boolean(catchUpConfirm)}
          onClose={() => setCatchUpConfirm(null)}
          onConfirm={() => {
            const dayId = catchUpConfirm.dayId;
            confirmReturnRef.current = null;
            setCatchUpConfirm(null);
            openShellPath('/workout', { startPlanDayId: dayId });
          }}
          title={catchUpConfirm?.title ?? ''}
          description={catchUpConfirm?.body}
          confirmLabel="Start workout"
          tone="primary"
          hideClose
          playTile
        />
      ) : null}
    </View>
  );
}

// §9 rule 4: a stat column past 1.3 becomes a label → value row.
function StatRow({ label, value, first, valueStyle }) {
  return (
    <View testID={`home-stat-row-${label}`} style={[styles.statRow, !first && styles.statRowDivider]}>
      <Text {...LT.body} style={[styles.statLabel, styles.statRowLabel]}>
        {label}
      </Text>
      <Text {...VALUE_TEXT} style={[valueStyle, styles.statRowValue]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 12,
    paddingBottom: 24,
  },
  pageTablet: {
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    paddingVertical: 8,
  },
  statRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statRowLabel: {
    flexShrink: 1,
  },
  statRowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
