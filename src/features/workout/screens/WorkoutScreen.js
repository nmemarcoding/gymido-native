import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import { keepUnitsTogether } from '../../../shared/format/counts';
import BackPill from '../../../shared/components/BackPill';
import CatchUpRow from '../../../shared/components/CatchUpRow';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import { CAP_BODY, DISPLAY_TITLE_TEXT } from '../../../shared/components/largeText';
import { useSheetFocus } from '../../../shared/hooks/useSheetFocus';
import { breakpoints, colors, font, spacing, textScale, titleTracking } from '../../../shared/theme/tokens';
import { listDayExercises } from '../../plans/api/libraryApi';
import ScheduleSetupCard from '../../plans/components/ScheduleSetupCard';
import { WEEKDAYS, planDayTitle } from '../../plans/libraryFormat';
import { catchUpConfirmCopy, catchUpRowCopy, missedLayout, weekMisses } from '../../plans/missedCatchUp';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { useShellUiStore } from '../../shell/shellUiStore';
import { startWorkout } from '../api/workoutApi';
import HubDayRows from '../components/hub/HubDayRows';
import HubTodayCard from '../components/hub/HubTodayCard';
import HubWeekCard from '../components/hub/HubWeekCard';
import WorkoutSkeleton from '../components/WorkoutSkeleton';
import { WorkoutEmptyState, WorkoutErrorState } from '../components/WorkoutStates';
import { loadWorkoutPage } from '../loadWorkoutPage';
import { CompletionPopup } from '../runtime/RuntimeOverlays';
import restAlertPlatform from '../runtime/restAlertPlatform';
import { requestPermissionAtWorkoutStart } from '../runtime/restAlerts';
import { LeaveWorkoutDialog } from '../runtime/SessionDialogs';
import SessionRuntime from '../runtime/SessionRuntime';
import { applyOverlay, reconcileOverlay } from '../runtime/sessionMath';
import {
  OTHER_DAYS_COPY,
  dayRows,
  hubState,
  hubWeek,
  missedBase,
  startConfirmCopy,
  todayDoneDetail,
  todayDurationMinutes,
  todayMeta,
  upNext,
  weekCompleteDetail,
} from '../hubModel';
import useLeaveWorkoutGuard from './useLeaveWorkoutGuard';

const SAVED_TOAST_MS = 3500;
const CONTRADICTED = "That set didn't save after all. Tap it again.";
const EMPTY = {
  session: null,
  currentPlan: null,
  todayStatus: null,
  planDays: [],
  week: null,
  generatorAvailable: false,
  completedThisWeek: [],
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
  const { width, height, fontScale } = useWindowDimensions();
  const setSessionActive = useShellUiStore((state) => state.setSessionActive);
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

  // T-102 hand-off (Today's Catch-up confirm): read startPlanDayId once and
  // clear it, so a reload never starts it again; when the load finishes,
  // start that day ONCE (no confirm: Today asked), unless a session is open.
  const pendingStart = useRef(null);
  const startParam = route.params?.startPlanDayId;
  useEffect(() => {
    if (startParam != null) {
      // Reviewer L1: with a session already open the hand-off is dropped here,
      // so a failed silent reload can't keep it for a later load.
      pendingStart.current = sessionRef.current?.id ? null : startParam;
      navigation.setParams({ startPlanDayId: undefined });
    }
  }, [startParam, navigation]);
  const startRef = useRef(null);
  useEffect(() => {
    startRef.current = handleStart;
  });
  useEffect(() => {
    if (status !== 'loaded' || pendingStart.current == null) {
      return;
    }
    const dayId = pendingStart.current;
    pendingStart.current = null;
    if (!page.session?.id) {
      startRef.current(dayId);
    }
  }, [status, page]);

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
    // T-50 (RN-SPEC-time §7.2 step 3, dated 2026-10-27): the one
    // notification-permission moment, sent before the start request and not
    // awaited; a failed start has still asked.
    requestPermissionAtWorkoutStart(restAlertPlatform).catch(() => {});
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
    // Owner directive (23 Oct 2026, web matched): an active session shows no
    // header row and no bell, so SessionChrome sits right under the top
    // inset. Dated 27 Oct 2026 (RN-SPEC-workout §1.1, audit b2): the tablet
    // too (it kept the compact row before), so at every width.
    if (page.session?.id && status !== 'error') {
      return (
        <SessionRuntime
          session={applyOverlay(page.session, overlay)}
          planName={page.currentPlan?.enrollment?.plan?.name}
          exerciseStatsMap={page.exerciseStatsMap}
          header={null}
          reload={() => load({ silent: true })}
          reloadWithLoader={() => load()}
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
          height={height}
          fontScale={fontScale}
          actionError={actionError}
          successMessage={successMessage}
          isStartingDayId={isStartingDayId}
          onRetry={() => load()}
          onStart={handleStart}
          // M1 (U5): always the Today root; goBack under backBehavior
          // "history" could land on another tab.
          onBackToToday={() => openShellPath('/')}
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
      <LeaveWorkoutDialog open={leaveGuard.open} onStay={leaveGuard.stay} onLeave={leaveGuard.leave} />
    </>
  );
}


// U5 "‹ Today", the page title and the plan name (T-76 boards: 40/44 phone,
// 52/56 tablet). T-65 (PHONE-NAV spec §3): the page's one back control is the
// kit BackPill; it opens the Today root (M1).
function HubHeader({ tablet, planName, onBack }) {
  return (
    <View testID="workout-hub-header" style={styles.header}>
      <BackPill testID="workout-back-today" label="Today" onPress={onBack} />
      <Text testID="workout-title" accessibilityRole="header" {...DISPLAY_TITLE_TEXT} style={tablet ? styles.titleTablet : styles.title}>
        Workout
      </Text>
      {planName ? (
        <Text testID="workout-plan-name" {...CAP_BODY} style={styles.planName}>
          {keepUnitsTogether(planName)}
        </Text>
      ) : null}
    </View>
  );
}

// T-76: each plan day's exercises (photos + primary muscles), lazy: one GET
// /plans/{id}/days/{dayId}/exercises per day, today's first. undefined while
// loading, [] on a failure (the row draws the initials tile). Fetched again
// only when the plan or its days change, never on a silent reload.
function useDayExercises(planId, dayIdsKey, firstId) {
  // Results are kept with the plan + days they belong to, so a new plan reads
  // as nothing loaded yet without a reset.
  const key = `${planId}|${dayIdsKey}`;
  const [store, setStore] = useState({ key: '', byDay: {} });
  // Today's day only orders the first fetch; a new day (midnight) never refetches.
  // (Declared before the fetch effect, so it updates first on each commit.)
  const firstRef = useRef(firstId);
  useEffect(() => {
    firstRef.current = firstId;
  }, [firstId]);
  useEffect(() => {
    if (!planId || !dayIdsKey) {
      return undefined;
    }
    let live = true;
    const ids = dayIdsKey.split(',').map(Number);
    const first = firstRef.current;
    const ordered = ids.includes(first) ? [first, ...ids.filter((id) => id !== first)] : ids;
    const save = (dayId, items) =>
      live && setStore((current) => ({ key, byDay: { ...(current.key === key ? current.byDay : {}), [dayId]: items } }));
    for (const dayId of ordered) {
      listDayExercises(planId, dayId)
        .then((items) => save(dayId, items))
        .catch(() => save(dayId, []));
    }
    return () => {
      live = false;
    };
  }, [key, planId, dayIdsKey]);
  return store.key === key ? store.byDay : {};
}

function focus(ref) {
  const node = findNodeHandle(ref.current);
  if (node) {
    AccessibilityInfo.setAccessibilityFocus(node);
  }
}

// T-76 (RN-SPEC-workout T-76 block, shared with web): today first, then the
// week, then the other days. Phone: stacked. Tablet portrait: today full
// width, then the week and the other days side by side (1 : 1.15). Tablet
// landscape: today and the week side by side (2 : 1), the other days below
// as cards in auto columns (min 300). Past the large-text reflow: stacked.
function Hub({ status, page, width, height = 0, actionError, successMessage, isStartingDayId, onRetry, onStart, onScheduleSaved, onBackToToday, fontScale = 1 }) {
  const tablet = width >= breakpoints.md;
  const reflow = fontScale > textScale.reflowAbove;
  const split = tablet && !reflow;
  const landscape = split && width > height;
  const { currentPlan, todayStatus, planDays, week } = page;
  const planId = currentPlan?.enrollment?.plan?.id;
  const todayDayId = todayStatus?.plan_day?.id;
  const exercisesByDay = useDayExercises(planId, planDays.map((day) => day.id).join(','), todayDayId);
  // C2: "Choose training days" opens the schedule setup in place; focus goes
  // to its heading, and back to the button on Cancel.
  const [settingUp, setSettingUp] = useState(false);
  // UX M3: the hub's content width picks the day rows' photo size.
  const [contentWidth, setContentWidth] = useState(0);
  // T-80: starting a day other than today's planned workout asks first.
  // Focus returns to the row (or "Start early") when the dialog is cancelled.
  const [confirm, setConfirm] = useState(null);
  // Mounted on the first ask (and kept, for its close animation).
  const [confirmMounted, setConfirmMounted] = useState(false);
  const confirmReturnRef = useRef(null);
  useSheetFocus(Boolean(confirm), { returnRef: confirmReturnRef });
  const catchUpRef = useRef(null);
  const headingRef = useRef(null);
  const chooseRef = useRef(null);
  const wasSettingUp = useRef(false);
  useEffect(() => {
    if (settingUp !== wasSettingUp.current) {
      wasSettingUp.current = settingUp;
      const timer = setTimeout(() => focus(settingUp ? headingRef : chooseRef), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [settingUp]);

  const toasts = (
    <>
      {successMessage ? <InlineToast testID="workout-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} /> : null}
      {actionError ? <InlineToast testID="workout-action-error" tone={ToastTone.error} title="Workout error" message={actionError} /> : null}
    </>
  );
  const header = <HubHeader tablet={tablet} planName={currentPlan?.enrollment?.plan?.name} onBack={onBackToToday} />;
  const pageStyle = [styles.page, tablet && styles.pageTablet];

  if (status === 'loading') {
    return (
      <View style={pageStyle}>
        {header}
        <WorkoutSkeleton split={split && !landscape} />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={pageStyle}>
        {header}
        {/* UX M2 (RN-SPEC T-76): the body is always "Please try again." */}
        <WorkoutErrorState onRetry={onRetry} />
      </View>
    );
  }
  if (!currentPlan?.enrollment?.plan) {
    return (
      <View style={pageStyle}>
        {toasts}
        {header}
        <WorkoutEmptyState
          generatorAvailable={page.generatorAvailable}
          onBrowse={() => openShellPath('/plans')}
          onBuild={() => openShellPath('/plans/generate')}
        />
      </View>
    );
  }

  const now = new Date();
  // T-81: by date on the server's /week; the fallback stays as before.
  const thisWeek = hubWeek({
    week,
    schedule: currentPlan.schedule,
    doneIds: page.completedThisWeekDayIds,
    completed: page.completedThisWeek,
    startedOn: currentPlan.enrollment.started_on,
    now,
  });
  const weekNow = thisWeek.week;
  const state = hubState({ ...page, week: weekNow, byDate: thisWeek.byDate });
  const progress = thisWeek.progress;
  const strip = state === 'noSchedule' ? null : thisWeek.strip;
  const caption = strip ? thisWeek.caption : null;
  const next = upNext({ week: weekNow, schedule: currentPlan.schedule, planDays, now });
  const todayTitle = planDayTitle(todayStatus?.plan_day);
  const todayCount = planDays.find((day) => day.id === todayDayId)?.exercises_count ?? todayStatus?.plan_day?.exercises_count;
  const todayExercises = exercisesByDay[todayDayId];
  // T-102: this week's open misses from /week (none without it). T-113: the
  // hero is never a missed day; ONE Catch-up row under it (rest included).
  const misses = weekMisses(week, now);
  const base = missedBase(state);
  const layout = settingUp ? { hero: null, catchUp: null } : missedLayout(base, misses);
  const catchUp = layout.catchUp;
  const rows = dayRows({ planDays, schedule: currentPlan.schedule, doneIds: page.completedThisWeekDayIds, state, todayDayId, misses, now });
  const ask = (dayId, copy, ref) => {
    confirmReturnRef.current = ref?.current ?? null;
    setConfirmMounted(true);
    setConfirm({ dayId, ...copy });
  };
  // T-80: a row (Start or Repeat) or "Start {Day} early": the copy for this
  // context; T-102 an open-miss row asks with the catch-up rest copy.
  const requestStart = (day, ref) =>
    ask(
      day.dayId,
      day.missedWeekday
        ? catchUpConfirmCopy({ miss: { weekdayName: day.missedWeekday }, base: 'rest', title: day.title })
        : startConfirmCopy({ state, title: day.title, done: Boolean(day.done), isToday: Boolean(todayStatus?.already_completed) && day.dayId === todayDayId, todayTitle }),
      ref
    );
  const confirmDialog = confirmMounted ? (
    <ConfirmDialog
      testID="workout-start-confirm"
      isOpen={Boolean(confirm)}
      onClose={() => setConfirm(null)}
      onConfirm={() => {
        const dayId = confirm.dayId;
        confirmReturnRef.current = null;
        setConfirm(null);
        onStart(dayId);
      }}
      title={confirm?.title ?? ''}
      description={confirm?.body}
      confirmLabel="Start workout"
      tone="primary"
      hideClose
      playTile
    />
  ) : null;
  const catchUpRow = catchUp ? (
    <CatchUpRow
      ref={catchUpRef}
      testID="workout-catch-up"
      copy={catchUpRowCopy(catchUp)}
      disabled={isStartingDayId != null}
      onPress={() => ask(catchUp.miss.planDay?.id, catchUpConfirmCopy({ miss: catchUp.miss, base, todayTitle }), catchUpRef)}
    />
  ) : null;
  const todayCard =
    state === 'noSchedule' && settingUp ? (
      <ScheduleSetupCard
        planName={currentPlan.enrollment.plan.name}
        planDays={planDays}
        enrollmentId={currentPlan.enrollment.id}
        headingRef={headingRef}
        onCancel={() => setSettingUp(false)}
        onSaved={async () => {
          await onScheduleSaved();
          setSettingUp(false);
        }}
      />
    ) : (
      <HubTodayCard
        state={state}
        tablet={tablet}
        weekdayName={WEEKDAYS[(now.getDay() + 6) % 7].name}
        title={todayTitle}
        meta={todayMeta(todayCount, todayExercises)}
        exercises={todayExercises}
        detail={
          state === 'todayDone'
            ? todayDoneDetail(todayCount, todayDurationMinutes(page.completedThisWeek, todayDayId, now))
            : weekCompleteDetail(progress, currentPlan.schedule)
        }
        upNext={next}
        upNextExercises={next ? exercisesByDay[next.dayId] : undefined}
        starting={isStartingDayId != null && (isStartingDayId === todayDayId || isStartingDayId === next?.dayId)}
        onStart={() => onStart(todayDayId)}
        onStartEarly={requestStart}
        onViewProgress={() => openShellPath('/progress')}
        onChooseDays={() => setSettingUp(true)}
        chooseRef={chooseRef}
      />
    );
  const weekCard =
    strip && progress ? <HubWeekCard strip={strip} progress={progress} caption={caption} reflow={reflow} style={split ? (landscape ? styles.sideWeek : styles.splitWeek) : null} /> : null;
  const otherDays = rows.length ? (
    <HubDayRows
      copy={OTHER_DAYS_COPY[state]}
      rows={rows}
      exercisesByDay={exercisesByDay}
      startingDayId={isStartingDayId}
      onStart={requestStart}
      contentWidth={contentWidth}
      fontScale={fontScale}
      cards={landscape}
      style={split && !landscape && weekCard ? styles.splitDays : null}
    />
  ) : null;

  const measure = (event) => setContentWidth(event.nativeEvent.layout.width);
  if (landscape && weekCard) {
    // T-102: the Catch-up row sits under the hero, in the Today column.
    return (
      <View style={pageStyle} onLayout={measure}>
        {toasts}
        {header}
        <View testID="workout-split" style={styles.split}>
          <View testID="workout-side-today" style={[styles.sideToday, styles.column]}>
            {todayCard}
            {catchUpRow}
          </View>
          {weekCard}
        </View>
        {otherDays}
        {confirmDialog}
      </View>
    );
  }

  return (
    <View testID="workout-hub" style={pageStyle} onLayout={measure}>
      {toasts}
      {header}
      {todayCard}
      {catchUpRow}
      {split && weekCard && otherDays ? (
        <View testID="workout-split" style={styles.split}>
          {weekCard}
          {otherDays}
        </View>
      ) : (
        <>
          {weekCard}
          {otherDays}
        </>
      )}
      {confirmDialog}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 14,
  },
  pageTablet: {
    gap: 18,
  },
  header: {
    paddingHorizontal: spacing[1],
  },
  title: {
    ...font(700),
    marginTop: spacing['0_5'],
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: titleTracking(40, -0.05),
    color: colors.textPrimary,
  },
  titleTablet: {
    ...font(700),
    marginTop: spacing['0_5'],
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: titleTracking(52, -0.05),
    color: colors.textPrimary,
  },
  planName: {
    ...font(400),
    marginTop: spacing[1],
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  split: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  splitWeek: {
    flex: 1,
    minWidth: 0,
  },
  splitDays: {
    flex: 1.15,
    minWidth: 0,
  },
  sideToday: {
    flex: 2,
    minWidth: 0,
  },
  sideWeek: {
    flex: 1,
    minWidth: 0,
  },
  column: {
    gap: 14,
  },
});
