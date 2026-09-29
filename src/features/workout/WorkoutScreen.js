import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { routes } from '../../navigation/routes';
import { findTabNavigation, openTab } from '../../navigation/shell/shellNavigation';
import { ShellPage } from '../../navigation/shell/ShellChrome';
import { useFocusGeneration } from '../../navigation/shell/useFocusGeneration';
import { getWebApiErrorMessage } from '../../shared/api/apiError';
import { Toast } from '../../shared/components/feedback';
import { colors, textStyles } from '../../shared/theme/tokens';
import { useWorkoutSessionStore } from './workoutSessionStore';
import { getCurrentPlan, getWorkoutPlanDays } from '../plans/api/plansApi';
import {
  abandonWorkout,
  completeWorkout,
  getCompletedWorkouts,
  getCurrentWorkoutSession,
  getExerciseStats,
  getTodayWorkoutStatus,
  startWorkout,
  updateWorkoutSet,
} from './api/workoutApi';
import PlanDayCard from './components/PlanDayCard';
import TodayHeroCard from './components/TodayHeroCard';
import WorkoutSkeleton from './components/WorkoutSkeleton';
import { WorkoutEmptyState, WorkoutErrorState } from './components/WorkoutStates';
import { CompletionPopup, DraggableRestTimer } from './runtime/Overlays';
import { applyOverlay, overlayDisagrees, overlayEntry } from './runtime/confirmedWrites';
import { buildSetPayload, completionSnapshot } from './runtime/runtimeRules';
import SessionRuntime, { useSessionRuntime } from './runtime/SessionRuntime';
import ScheduleSetupCard from './ScheduleSetupCard';
import {
  buildExerciseStatsMap,
  completedThisWeekCount as countCompleted,
  getCurrentWeekRange,
  hubPlanName,
  needsSchedule as computeNeedsSchedule,
  scheduledWeekdaysByDayId,
  showsHeroStart,
} from './workoutRules';

// RN-SPEC-plans §4.8: the hand-off toast clears after 3500ms.
export const SAVED_TOAST_MS = 3500;

// [O7] + [O9]: the server's message via the RN-SPEC-plans §4.7 precedence for
// Start and for all three runtime actions, e.g. a 409 reads "Workout session
// already in progress" / "Workout session is not in progress". The helper never
// returns '', so the web's fallback strings are unreachable and aren't shipped.
// Note a 422 still reads "Validation failed": the top-level message wins.
// [O12 §1] Native-only invented copy, accepted 27 Sep 2026: a row flipping back
// with no explanation would look exactly like the bug O12 fixes.
export const OVERLAY_DISAGREE_MESSAGE = "That set didn't save after all. Tap it again.";

export function actionErrorMessage(error) {
  return getWebApiErrorMessage(error);
}

// The Workout hub (RN-SPEC-workout Part A). One screen, two branches.
function WorkoutContent({ generation, isCurrent, onSaved, successMessage }) {
  const navigation = useNavigation();
  const [session, setSession] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [planDays, setPlanDays] = useState([]);
  const [completedThisWeekDayIds, setCompletedThisWeekDayIds] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState('');
  const [isStartingDayId, setIsStartingDayId] = useState(null);
  const [exerciseStatsMap, setExerciseStatsMap] = useState({});
  const [pendingSetId, setPendingSetId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [completionPopup, setCompletionPopup] = useState(null);
  // [O12] confirmed-write overlay, the failed-reload bar, and the load generation.
  const [confirmedSets, setConfirmedSets] = useState({});
  const confirmedRef = useRef({});
  const [reloadError, setReloadError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const loadGenRef = useRef(0);

// [O10] The invariant, for any trigger: the skeleton is shown only when there is
// no session to cover it. session?.id and the skeleton are never on screen
// together. So EVERY reload while a session is running is silent — the
// post-mutation reload, the reloads after Complete and Discard (a session is
// still running when those start), and the focus reload of §26.1 — while the
// initial load, an error retry and any hub reload keep the full loading state.
//
// What shows during a silent reload: nothing. [O12 §4] supersedes O10 §3 here —
// "Saving…" now ends when the PATCH settles, because the confirmed-write overlay
// renders the row as completed the instant the save lands, and a row cannot
// read "Saving…" and "Undo" at once.
  const sessionRef = useRef(null);
  sessionRef.current = session;

  // §7: the single loader. Five calls in parallel, then the plan days
  // sequentially when an enrollment exists. §6.1 gives the per-call failure rules.
  const loadWorkoutPage = useCallback(async () => {
    // [O12 §3a] Every load carries a generation, and only the newest may commit.
    // Without it two overlapping reloads can land newest-then-older, and the
    // older payload genuinely is pre-PATCH — indistinguishable from a stale read,
    // and the likeliest cause of the owner's two-active-sets report (§6).
    loadGenRef.current += 1;
    const loadGen = loadGenRef.current;
    const alive = () => isCurrent(generation) && loadGen === loadGenRef.current;
    // [O10] decided from the live session, not from the caller.
    const silent = Boolean(sessionRef.current?.id);
    if (!silent) {
      setStatus('loading');
      setError(null);
    }
    try {
      const { startDate, endDate } = getCurrentWeekRange();
      const [currentSession, plan, today, stats, completed] = await Promise.all([
        getCurrentWorkoutSession(),
        getCurrentPlan().catch((planError) => {
          if (planError?.response?.status === 404) {
            return null;
          }
          throw planError;
        }),
        getTodayWorkoutStatus().catch((todayError) => {
          if (todayError?.response?.status === 404) {
            return null;
          }
          throw todayError;
        }),
        getExerciseStats().catch(() => null),
        getCompletedWorkouts({ startDate, endDate }).catch(() => null),
      ]);

      const planId = plan?.enrollment?.plan?.id;
      const days = planId ? await getWorkoutPlanDays(planId) : [];
      if (!alive()) {
        return { ok: false, stale: true };
      }

      // [O12 §1] reconcile the overlay against the server's rows. The server
      // always wins; if it disagrees, the row visibly flips back, so say why.
      if (overlayDisagrees(confirmedRef.current, currentSession)) {
        setActionError(OVERLAY_DISAGREE_MESSAGE);
      }
      confirmedRef.current = {};
      setConfirmedSets({});
      setReloadError(false);

      setSession(currentSession);
      setCurrentPlan(plan);
      setTodayStatus(today);
      setPlanDays(days);
      setExerciseStatsMap(buildExerciseStatsMap(stats));
      setCompletedThisWeekDayIds((completed || []).map((item) => item.workout_plan_day_id));
      setStatus('loaded');
      return { ok: true };
    } catch (loadError) {
      if (!alive()) {
        return { ok: false, stale: true };
      }
      if (silent) {
        // [O10 §4 / O12 §2] never tear a live workout down for a failed reload.
        // Keep the last-known data AND every overlay entry on screen — the
        // overlay is the only correct source until a reload agrees — and show
        // the retry bar. A failed reload gates NOTHING: the timer has already
        // started and the next set is already active (O12 §3a).
        setReloadError(true);
        return { ok: false, error: loadError };
      }
      setError(loadError);
      setStatus('error');
      return { ok: false, error: loadError };
    }
  }, [generation, isCurrent]);

  // [O12 §2] Retry re-runs the FULL six-call load, never just the call that
  // failed: the loader has no per-call result tracking, so a partial refetch
  // would leave the screen holding data from two different moments.
  const retryReload = useCallback(async () => {
    setIsRetrying(true);
    try {
      await loadWorkoutPage();
    } finally {
      setIsRetrying(false);
    }
  }, [loadWorkoutPage]);

  useEffect(() => {
    loadWorkoutPage();
  }, [loadWorkoutPage]);

  // §4.
  const handleStartWorkout = async (workoutPlanDayId) => {
    const enrollmentId = currentPlan?.enrollment?.id;
    if (!enrollmentId) {
      setActionError('Activate a plan first.');
      return;
    }
    setActionError('');
    setIsStartingDayId(workoutPlanDayId);
    try {
      const started = await startWorkout({ enrollmentId, workoutPlanDayId });
      setSession(started);
      onSaved('Workout started.');
      await loadWorkoutPage();
    } catch (startError) {
      setActionError(actionErrorMessage(startError));
    } finally {
      setIsStartingDayId(null);
    }
  };

  // §26 / invariant B: the tab bar hides for the whole session. Re-derived from
  // the live session on every FOCUS (not only on mount, which no longer happens
  // per focus — see invariant D above) and cleared on blur, so the bar can never
  // stay hidden over another tab.
  useFocusEffect(
    useCallback(() => {
      useWorkoutSessionStore.setState({ isSessionActive: Boolean(session?.id) });
      return () => useWorkoutSessionStore.setState({ isSessionActive: false });
    }, [session?.id])
  );

  // §26.1 blur table: the completion popup is transient too. Separate from the
  // isSessionActive effect on purpose — that one re-runs when session?.id
  // changes, which happens the instant a completion clears the session, and
  // would dismiss the popup the moment it appeared.
  useFocusEffect(useCallback(() => () => setCompletionPopup(null), []));

  // [O12 §3] This is the PATCH only. The caller then starts the rest timer, and
  // only after that writes the overlay and kicks off the reload (`confirmWrite`):
  //   await PATCH → start the rest timer → write the overlay → start the reload
  // matching the web exactly. The previous native order awaited the reload
  // before starting the timer, so on a slow connection the athlete lost that
  // much rest. Returns the accepted payload, or null when the save failed — in
  // which case nothing advances and nothing is written to the overlay.
  const handleToggleSet = async ({ exercise, set, draft }) => {
    setActionError('');
    setPendingSetId(set.id);
    const payload = buildSetPayload(set, draft);
    try {
      await updateWorkoutSet({
        sessionId: session.id,
        exerciseId: exercise.id,
        setId: set.id,
        payload,
      });
      return payload;
    } catch (updateError) {
      setActionError(actionErrorMessage(updateError));
      return null;
    } finally {
      // [O12 §4] "Saving…" ends when the PATCH settles, success or failure.
      setPendingSetId(null);
    }
  };

  // [O12 §1] Record what the server accepted, then reload. The two are coupled
  // on purpose: every write starts its own reload, which bumps the load
  // generation and makes any older in-flight reload stale — so a reload that
  // commits always post-dates every entry, and can resolve all of them at once.
  const confirmWrite = useCallback(
    (setId, payload) => {
      confirmedRef.current = { ...confirmedRef.current, [setId]: overlayEntry(payload) };
      setConfirmedSets(confirmedRef.current);
      loadWorkoutPage();
    },
    [loadWorkoutPage]
  );

  const handleCompleteWorkout = async ({ elapsedSeconds }) => {
    // §23.1: the popup is a client-side snapshot taken BEFORE the request (⚠W16).
    const snapshot = completionSnapshot({ session, currentPlan, elapsedSeconds });
    setActionError('');
    setIsCompleting(true);
    try {
      await completeWorkout(session.id);
      onSaved('Workout completed.');
      setCompletionPopup(snapshot);
      await loadWorkoutPage();
    } catch (completeError) {
      setActionError(actionErrorMessage(completeError));
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAbandonWorkout = async () => {
    setActionError('');
    setIsAbandoning(true);
    try {
      await abandonWorkout(session.id);
      await loadWorkoutPage();
    } catch (abandonError) {
      setActionError(actionErrorMessage(abandonError));
    } finally {
      setIsAbandoning(false);
    }
  };

  // §26: the runtime's state lives here, so a reload (status → 'loading')
  // never destroys the rest timer or the typed drafts.
  //
  // [O12 §1] The overlay is read at ONE point: everything the runtime derives —
  // the rows, the header count, the rail, the ring, the next set — comes from
  // `sessionForRender`, so they can never disagree with each other.
  const sessionForRender = useMemo(() => applyOverlay(session, confirmedSets), [session, confirmedSets]);

  const runtime = useSessionRuntime({
    session: sessionForRender,
    currentPlan,
    exerciseStatsMap,
    onToggleSet: handleToggleSet,
    onConfirmWrite: confirmWrite,
    onComplete: handleCompleteWorkout,
    onAbandon: handleAbandonWorkout,
    isCompleting,
  });

  const weekdaysByDayId = useMemo(() => scheduledWeekdaysByDayId(currentPlan?.schedule), [currentPlan]);
  const completedCount = countCompleted(planDays, completedThisWeekDayIds);

  const toasts = (
    <>
      {successMessage ? <Toast tone="success" title="Saved" message={successMessage} /> : null}
      {/* ⚠W10: the error toast never auto-clears. */}
      {actionError ? <Toast tone="error" title="Workout error" message={actionError} /> : null}
    </>
  );

  const page = (content) => (
    <ShellPage path="/workout" testID="workout-screen">
      {content}
    </ShellPage>
  );

  if (status === 'loading') {
    return page(<WorkoutSkeleton />);
  }

  if (status === 'error') {
    return page(<WorkoutErrorState message={error?.message || 'Please try again.'} onRetry={loadWorkoutPage} />);
  }

  // §1.2: the session check precedes the plan check. The session does NOT use
  // ShellPage: §19.0 needs the header and the exercise nav outside the scroll,
  // which SessionShell owns.
  if (session?.id) {
    return (
      <SessionRuntime
        session={sessionForRender}
        reloadError={reloadError}
        isRetrying={isRetrying}
        onRetryReload={retryReload}
        currentPlan={currentPlan}
        runtime={runtime}
        onComplete={handleCompleteWorkout}
        isCompleting={isCompleting}
        isAbandoning={isAbandoning}
        pendingSetId={pendingSetId}
        banner={toasts}
        overlay={
          <>
            {/* §22.1: fixed to the window on the web, so it sits outside the
                scroll rather than in the content. */}
            {runtime.restTimer ? (
              <DraggableRestTimer
                restTimer={runtime.restTimer}
                minimized={runtime.minimized}
                position={runtime.timerPosition}
                onMove={runtime.setTimerPosition}
                onExpand={() => runtime.setMinimized(false)}
                onMinimize={() => runtime.setMinimized(true)}
                onAdjust={runtime.adjustRestTimer}
                onSkip={runtime.skipRestTimer}
              />
            ) : null}
            {/* §23.2: rendered in both branches, so it survives the switch. */}
            {completionPopup ? (
              <CompletionPopup popup={completionPopup} onDismiss={() => setCompletionPopup(null)} />
            ) : null}
          </>
        }
      />
    );
  }

  if (!currentPlan?.enrollment?.plan) {
    return page(
      <View style={styles.root}>
        {toasts}
        <WorkoutEmptyState
          onBrowsePlans={() => {
            // ⚠W8: the web reloads at /plans; native switches to the Library tab.
            const tabNavigation = findTabNavigation(navigation);
            if (tabNavigation) {
              openTab(tabNavigation, routes.LibraryTab);
            }
          }}
        />
      </View>
    );
  }

  return page(
    <View style={styles.root}>
      {toasts}
      {completionPopup ? (
        <CompletionPopup popup={completionPopup} onDismiss={() => setCompletionPopup(null)} />
      ) : null}
      {computeNeedsSchedule(currentPlan, planDays) ? (
        <ScheduleSetupCard
          key={currentPlan.enrollment.id}
          planName={currentPlan?.enrollment?.plan?.name}
          planDays={planDays}
          enrollmentId={currentPlan.enrollment.id}
          onScheduled={() => {
            onSaved('Training days saved.');
            loadWorkoutPage();
          }}
        />
      ) : null}

      <TodayHeroCard
        planName={hubPlanName(currentPlan)}
        planDayCount={planDays.length}
        todayStatus={todayStatus}
        completedCount={completedCount}
        showStart={showsHeroStart(todayStatus)}
        isStarting={isStartingDayId === todayStatus?.plan_day?.id}
        onStart={() => handleStartWorkout(todayStatus?.plan_day?.id)}
      />

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>All training days</Text>
        <View style={styles.grid}>
          {planDays.map((day, index) => (
            <PlanDayCard
              key={day.id}
              index={index}
              day={day}
              weekdays={weekdaysByDayId[day.id] || []}
              isDone={completedThisWeekDayIds.includes(day.id)}
              // ⚠W5: only the pressed Start disables.
              isStarting={isStartingDayId === day.id}
              onStart={() => handleStartWorkout(day.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function WorkoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { generation, isCurrent } = useFocusGeneration();
  const [toast, setToast] = useState(null);

  // §1.3: the hand-off message shows once, then the param is cleared.
  const message = route.params?.message;
  useEffect(() => {
    if (message) {
      setToast({ message, id: Date.now() });
    }
  }, [message]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setToast(null);
      if (route.params?.message) {
        navigation.setParams({ message: undefined });
      }
    }, SAVED_TOAST_MS);
    return () => clearTimeout(timer);
    // Restart only for a new toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // WorkoutContent wraps itself in ShellPage, because the session branch needs
  // the shell's overlay slot for the rest timer (§22.1).
  //
  // Invariant D: NOT keyed on `generation`. Keying it would remount the whole
  // runtime on every refocus, which destroys a running rest (and, with it, the
  // O4 notification) just because the user glanced at another tab. `generation`
  // still re-runs the load on focus, and `isCurrent(generation)` still discards
  // a stale one (invariant C), so refocusing reloads without a teardown.
  if (generation === 0) {
    return (
      <ShellPage path="/workout" testID="workout-screen">
        <WorkoutSkeleton />
      </ShellPage>
    );
  }

  return (
    <WorkoutContent
      generation={generation}
      isCurrent={isCurrent}
      successMessage={toast?.message}
      onSaved={(text) => setToast({ message: text, id: Date.now() })}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 20,
    paddingBottom: 20,
  },
  // §19: the runtime uses its own root, not the hub's.
  runtimeRoot: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    ...textStyles.sectionHeading,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  grid: {
    gap: 12,
  },
});
