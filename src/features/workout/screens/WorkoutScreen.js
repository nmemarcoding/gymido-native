import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import { breakpoints, colors } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import ScheduleSetupCard from '../../plans/components/ScheduleSetupCard';
import AppHeader from '../../shell/AppHeader';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { resolveMode } from '../../shell/shellRules';
import { useShellUiStore } from '../../shell/shellUiStore';
import { startWorkout } from '../api/workoutApi';
import PlanDayCard from '../components/PlanDayCard';
import TodayHeroCard from '../components/TodayHeroCard';
import WorkoutSkeleton from '../components/WorkoutSkeleton';
import { WorkoutEmptyState, WorkoutErrorState } from '../components/WorkoutStates';
import { loadWorkoutPage } from '../loadWorkoutPage';
import { CompletionPopup } from '../runtime/RuntimeOverlays';
import SessionRuntime from '../runtime/SessionRuntime';
import { applyOverlay, reconcileOverlay } from '../runtime/sessionMath';
import {
  completedThisWeekCount,
  needsScheduleSetup,
  scheduledWeekdaysByDayId,
  showsHeroStart,
  todayDetail,
  todayState,
  trainingDaysLabel,
} from '../workoutFormat';
import useLeaveWorkoutGuard from './useLeaveWorkoutGuard';

const SAVED_TOAST_MS = 3500;
const CONTRADICTED = "That set didn't save after all. Tap it again.";
const EMPTY = {
  session: null,
  currentPlan: null,
  todayStatus: null,
  planDays: [],
  completedThisWeekDayIds: [],
  exerciseStatsMap: {},
};

// The Workout screen (RN-SPEC-workout), pushed only in the Today stack. The
// hub (Part A) and the session runtime (Part B) are one screen with two
// render branches; it never remounts on focus (§26.1, invariant D).
export default function WorkoutScreen() {
  return <WorkoutPage />;
}

function WorkoutPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const setSessionActive = useShellUiStore((state) => state.setSessionActive);
  const user = useAuthStore((state) => state.user);
  const storedPreference = useAuthStore((state) => state.workspace);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(EMPTY);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isStartingDayId, setIsStartingDayId] = useState(null);
  // [O12]: confirmed writes, the failed-reload bar and its retry.
  const [overlay, setOverlay] = useState({});
  // The latest overlay for the writers below, so reconciling (and its error)
  // happens outside a state updater, which must stay pure.
  const overlayRef = useRef({});
  const [reloadError, setReloadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [popup, setPopup] = useState(null);
  const writeSeq = useRef(0);
  const generation = useRef(0);
  const sessionRef = useRef(null);
  sessionRef.current = page.session;

  // §7 single loader. Every load gets a new generation and only the newest
  // may commit (invariant C, O12 §3a). Silent loads (a session is running,
  // O10) keep the screen; their failure raises the O12 bar instead.
  const load = useCallback(async ({ silent = false } = {}) => {
    generation.current += 1;
    const mine = generation.current;
    const startSeq = writeSeq.current;
    if (!silent) {
      setStatus('loading');
    }
    const result = await loadWorkoutPage();
    if (mine !== generation.current) {
      return result;
    }
    if (result.ok) {
      setPage(result.data);
      setLoadError(null);
      setStatus('loaded');
      setReloadError(false);
      const { kept, contradicted } = reconcileOverlay(result.data.session, overlayRef.current, startSeq);
      overlayRef.current = kept;
      setOverlay(kept);
      if (contradicted) {
        setActionError(CONTRADICTED);
      }
    } else if (silent && sessionRef.current?.id) {
      setReloadError(true);
    } else {
      setLoadError(result.error);
      setStatus('error');
    }
    return result;
  }, []);

  const writeOverlay = useCallback((setId, fields) => {
    writeSeq.current += 1;
    const seq = writeSeq.current;
    overlayRef.current = { ...overlayRef.current, [setId]: { fields, seq } };
    setOverlay(overlayRef.current);
  }, []);

  // Focus (§1.3 refined by §26.1): no session → a fresh hub; a running
  // session → a silent refetch. Pairing C: blur marks the in-flight load
  // stale; pairing B: the session flag clears on blur and unmount.
  useFocusEffect(
    useCallback(() => {
      const running = Boolean(sessionRef.current?.id);
      if (!running) {
        setActionError('');
        setIsStartingDayId(null);
      }
      load({ silent: running });
      return () => {
        generation.current += 1;
        setSessionActive(false);
      };
    }, [load, setSessionActive])
  );

  // Invariant B: while focused, isSessionActive === Boolean(session?.id).
  useEffect(() => {
    if (isFocused) {
      setSessionActive(Boolean(page.session?.id));
    }
  }, [isFocused, page.session?.id, setSessionActive]);

  // Dated change 23 Oct 2026 (owner ruling): Back mid-session asks first.
  const leaveGuard = useLeaveWorkoutGuard({ isActive: Boolean(page.session?.id), isFocused, navigation });

  // §26.1: the completion popup is dismissed on blur.
  useEffect(() => {
    if (!isFocused) {
      setPopup(null);
    }
  }, [isFocused]);

  const handoff = route.params?.message;
  useEffect(() => {
    if (handoff) {
      setSuccessMessage(handoff);
      navigation.setParams({ message: undefined });
    }
  }, [handoff, navigation]);

  // ⚠W10: the success toast clears after 3500 ms; the error toast never does.
  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setSuccessMessage(''), SAVED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  async function handleStart(dayId) {
    const enrollmentId = page.currentPlan?.enrollment?.id;
    if (!enrollmentId) {
      setActionError('Activate a plan first.');
      return;
    }
    setActionError('');
    setIsStartingDayId(dayId);
    try {
      const created = await startWorkout({ user_plan_enrollment_id: enrollmentId, workout_plan_day_id: dayId });
      setPage((current) => ({ ...current, session: created.session ?? current.session }));
      setSuccessMessage('Workout started.');
      await load({ silent: Boolean(created.session?.id) });
    } catch (error) {
      // [O7]
      setActionError(getServerMessage(error));
    } finally {
      setIsStartingDayId(null);
    }
  }

  async function retryReload() {
    setRetrying(true);
    await load({ silent: true });
    setRetrying(false);
  }

  // §1.2, in order. [O10] the skeleton never covers a live session.
  const branch = (() => {
    // Owner directive (23 Oct 2026, web matched): below md an active session
    // shows no header row and no bell, so SessionChrome sits right under the
    // top inset; from md the compact row (ModeSwitch + bell) stays.
    if (page.session?.id && status !== 'error') {
      const mode = resolveMode({ user, path: '/workout', storedPreference });
      const header = width >= breakpoints.md ? <AppHeader path="/workout" query="active=1" mode={mode} /> : null;
      return (
        <SessionRuntime
          session={applyOverlay(page.session, overlay)}
          planName={page.currentPlan?.enrollment?.plan?.name}
          exerciseStatsMap={page.exerciseStatsMap}
          header={header}
          reload={() => load({ silent: true })}
          writeOverlay={writeOverlay}
          actionError={actionError}
          setActionError={setActionError}
          successMessage={successMessage}
          setSuccessMessage={setSuccessMessage}
          reloadError={reloadError}
          retrying={retrying}
          onRetry={retryReload}
          onCompleted={setPopup}
        />
      );
    }

    return (
      <ShellPage testID="workout-screen">
        <Hub
          status={status}
          loadError={loadError}
          page={page}
          width={width}
          actionError={actionError}
          successMessage={successMessage}
          isStartingDayId={isStartingDayId}
          onRetry={() => load()}
          onStart={handleStart}
          onScheduleSaved={async () => {
            setSuccessMessage('Training days saved.');
            await load();
          }}
        />
      </ShellPage>
    );
  })();

  // §23.2: the popup must survive the session → hub switch, so it is rendered
  // ONCE, beside whichever branch shows, never inside a branch: a Modal that
  // unmounts in one parent while a new one mounts in another made the popup
  // flash for about a second and vanish on iOS (W2, 8 Oct 2026). (ported
  // from the 28 Sep build)
  return (
    <>
      {branch}
      <CompletionPopup popup={popup} onClose={() => setPopup(null)} />
      <ConfirmDialog
        testID="leave-workout-dialog"
        cancelTestID="leave-workout-stay"
        confirmTestID="leave-workout-leave"
        isOpen={leaveGuard.open}
        onClose={leaveGuard.stay}
        onConfirm={leaveGuard.leave}
        title="Leave workout?"
        description="Your workout stays saved. You can pick it up from Today."
        confirmLabel="Leave"
        cancelLabel="Stay"
        tone="primary"
      />
    </>
  );
}

function Hub({ status, loadError, page, width, actionError, successMessage, isStartingDayId, onRetry, onStart, onScheduleSaved }) {
  const toasts = (
    <>
      {successMessage ? <InlineToast testID="workout-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} /> : null}
      {actionError ? <InlineToast testID="workout-action-error" tone={ToastTone.error} title="Workout error" message={actionError} /> : null}
    </>
  );

  if (status === 'loading') {
    return <WorkoutSkeleton />;
  }
  if (status === 'error') {
    return <WorkoutErrorState message={loadError?.message || 'Please try again.'} onRetry={onRetry} />;
  }
  if (!page.currentPlan?.enrollment?.plan) {
    return (
      <View style={styles.page}>
        {toasts}
        <WorkoutEmptyState onBrowse={() => openShellPath('/plans')} />
      </View>
    );
  }

  const { currentPlan, todayStatus, planDays, completedThisWeekDayIds } = page;
  const weekdaysByDay = scheduledWeekdaysByDayId(currentPlan.schedule);
  const heroDayId = todayStatus?.plan_day?.id;
  const columns = width >= 1280 ? 3 : width >= breakpoints.sm ? 2 : 1;

  return (
    <View style={styles.page}>
      {toasts}
      {needsScheduleSetup(currentPlan, planDays) ? (
        <ScheduleSetupCard
          planName={currentPlan.enrollment.plan.name}
          planDays={planDays}
          enrollmentId={currentPlan.enrollment.id}
          onSaved={onScheduleSaved}
        />
      ) : null}
      <TodayHeroCard
        planName={currentPlan.enrollment.plan.name || 'Your plan'}
        dayCountLabel={trainingDaysLabel(planDays.length)}
        state={todayState(todayStatus)}
        detail={todayDetail(todayStatus)}
        ringValue={completedThisWeekCount(planDays, completedThisWeekDayIds)}
        ringTotal={planDays.length}
        showStart={showsHeroStart(todayStatus)}
        starting={isStartingDayId === heroDayId}
        onStart={() => onStart(heroDayId)}
      />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          All training days
        </Text>
        <DayGrid columns={columns}>
          {planDays.map((day, index) => (
            <PlanDayCard
              key={day.id}
              index={index}
              day={day}
              weekdays={weekdaysByDay[day.id] ?? []}
              isDone={completedThisWeekDayIds.includes(day.id)}
              starting={isStartingDayId === day.id}
              onStart={() => onStart(day.id)}
            />
          ))}
        </DayGrid>
      </View>
    </View>
  );
}

// §2: 1 column below 640, 2 from 640, 3 from 1280, gap 12.
function DayGrid({ columns, children }) {
  const [width, setWidth] = useState(0);
  const gap = 12;
  const itemWidth = columns > 1 && width > 0 ? (width - gap * (columns - 1)) / columns : undefined;
  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {(Array.isArray(children) ? children : [children]).map((child, index) => (
        <View key={child?.key ?? index} style={itemWidth ? { width: itemWidth } : styles.fullWidth}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 20,
    paddingBottom: 20,
  },
  section: {
    gap: 12,
  },
  heading: {
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fullWidth: {
    width: '100%',
  },
});
