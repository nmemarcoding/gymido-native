import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import { breakpoints, colors } from '../../../shared/theme/tokens';
import ScheduleSetupCard from '../../plans/components/ScheduleSetupCard';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { useShellUiStore } from '../../shell/shellUiStore';
import { startWorkout } from '../api/workoutApi';
import Card3D from '../components/Card3D';
import PlanDayCard from '../components/PlanDayCard';
import TodayHeroCard from '../components/TodayHeroCard';
import WorkoutSkeleton from '../components/WorkoutSkeleton';
import { WorkoutEmptyState, WorkoutErrorState } from '../components/WorkoutStates';
import { loadWorkoutPage } from '../loadWorkoutPage';
import {
  completedThisWeekCount,
  needsScheduleSetup,
  scheduledWeekdaysByDayId,
  showsHeroStart,
  todayDetail,
  todayState,
  trainingDaysLabel,
} from '../workoutFormat';

const SAVED_TOAST_MS = 3500;
const EMPTY = {
  session: null,
  currentPlan: null,
  todayStatus: null,
  planDays: [],
  completedThisWeekDayIds: [],
  exerciseStatsMap: {},
};

// The Workout screen (RN-SPEC-workout), pushed only in the Today stack. The
// hub (Part A) and the session runtime (Part B, block 6) are one screen with
// two render branches. It never remounts on focus (§26.1, invariant D).
export default function WorkoutScreen() {
  return (
    <ShellPage testID="workout-screen">
      <WorkoutPage />
    </ShellPage>
  );
}

function WorkoutPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const setSessionActive = useShellUiStore((state) => state.setSessionActive);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(EMPTY);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isStartingDayId, setIsStartingDayId] = useState(null);
  const generation = useRef(0);
  const sessionRef = useRef(null);
  sessionRef.current = page.session;

  // §7 single loader. Every load gets a new generation and only the newest
  // may commit (invariant C, O12 §3a). Silent loads (a session is running,
  // O10) keep the screen and never show the error state.
  const load = useCallback(async ({ silent = false } = {}) => {
    generation.current += 1;
    const mine = generation.current;
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
    } else if (!silent) {
      setLoadError(result.error);
      setStatus('error');
    }
    return result;
  }, []);

  // Focus (§1.3 refined by §26.1): no session → a fresh hub (loading, local
  // state reset, reload); a running session → a silent refetch.
  // Lifecycle pairing C: blur marks the in-flight load stale; each focus
  // starts a new generation. Pairing B: the session flag is cleared on blur
  // and unmount, and re-derived below while focused.
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

  // §1.3 / plans §4.8: a hand-off message shows once; the param is cleared
  // so it never shows again on a later focus.
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

  // §4, with [O7]: the server's message on failure.
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
      setActionError(getServerMessage(error));
    } finally {
      setIsStartingDayId(null);
    }
  }

  const toasts = (
    <>
      {successMessage ? (
        <InlineToast testID="workout-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} />
      ) : null}
      {actionError ? (
        <InlineToast testID="workout-action-error" tone={ToastTone.error} title="Workout error" message={actionError} />
      ) : null}
    </>
  );

  // §1.2, in order. [O10] the skeleton never covers a live session.
  if (status === 'loading' && !page.session?.id) {
    return <WorkoutSkeleton />;
  }
  if (status === 'error' && !page.session?.id) {
    return <WorkoutErrorState message={loadError?.message || 'Please try again.'} onRetry={() => load()} />;
  }
  if (page.session?.id) {
    return (
      <View style={styles.page}>
        {toasts}
        <SessionRuntimeStub planName={page.currentPlan?.enrollment?.plan?.name} />
      </View>
    );
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
  const state = todayState(todayStatus);
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
          onSaved={async () => {
            setSuccessMessage('Training days saved.');
            await load();
          }}
        />
      ) : null}
      <TodayHeroCard
        planName={currentPlan.enrollment.plan.name || 'Your plan'}
        dayCountLabel={trainingDaysLabel(planDays.length)}
        state={state}
        detail={todayDetail(todayStatus)}
        ringValue={completedThisWeekCount(planDays, completedThisWeekDayIds)}
        ringTotal={planDays.length}
        showStart={showsHeroStart(todayStatus)}
        starting={isStartingDayId === heroDayId}
        onStart={() => handleStart(heroDayId)}
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
              onStart={() => handleStart(day.id)}
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

// Placeholder for the session runtime (Part B, block 6): the seam of §18.
function SessionRuntimeStub({ planName }) {
  return (
    <Card3D testID="workout-session-stub" style={styles.stub}>
      <Text style={styles.stubEyebrow}>Workout in progress</Text>
      <Text style={styles.stubTitle}>{planName || 'Your plan'}</Text>
      <Text style={styles.stubBody}>The session screen arrives with the runtime block.</Text>
    </Card3D>
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
  stub: {
    padding: 20,
  },
  stubEyebrow: {
    fontSize: 11.2,
    lineHeight: 16.8,
    fontWeight: '700',
    letterSpacing: 2.016,
    textTransform: 'uppercase',
    color: colors.brand700,
  },
  stubTitle: {
    marginTop: 6,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  stubBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
