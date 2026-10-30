import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { getServerMessage } from '../../../shared/api/apiError';
import { keepUnitsTogether } from '../../../shared/format/counts';
import BackPill from '../../../shared/components/BackPill';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { InlineToast } from '../../../shared/components/ToastHost';
import { ToastTone } from '../../../shared/components/toastStore';
import GradientFill from '../../../shared/components/GradientFill';
import { CAP_BODY, DISPLAY_TITLE_TEXT, LINE_TEXT, TITLE_TEXT } from '../../../shared/components/largeText';
import PillButton from '../../../shared/components/PillButton';
import Skeleton from '../../../shared/components/Skeleton';
import { useSheetFocus } from '../../../shared/hooks/useSheetFocus';
import { breakpoints, colors, font, gradients, spacing, textScale, titleTracking } from '../../../shared/theme/tokens';
import { listDayExercises } from '../../plans/api/libraryApi';
import ScheduleSetupCard from '../../plans/components/ScheduleSetupCard';
import { WEEKDAYS, planDayTitle } from '../../plans/libraryFormat';
import { catchUpConfirmCopy, weekMisses } from '../../plans/missedCatchUp';
import { useProfileStore } from '../../profile/profileStore';
import ShellPage from '../../shell/ShellPage';
import { openShellPath } from '../../shell/shellLinks';
import { useShellUiStore } from '../../shell/shellUiStore';
import { getWorkout, startWorkout } from '../api/workoutApi';
import { PlayIcon } from '../components/hub/HubIcons';
import HubDayRows from '../components/hub/HubDayRows';
import HubTodayCard from '../components/hub/HubTodayCard';
import DaySheet from '../components/page/DaySheet';
import { LastWorkoutRow, MissedLine, StatsCard } from '../components/page/PageRows';
import WeekCard from '../components/page/WeekCard';
import { WorkoutEmptyState, WorkoutErrorState } from '../components/WorkoutStates';
import { OTHER_DAYS_COPY, dayRows, hubState, hubWeek, missedBase, startConfirmCopy } from '../hubModel';
import { loadWorkoutPage } from '../loadWorkoutPage';
import {
  dayCells,
  daySheet,
  doneRows,
  finishedPlan,
  lastWhenText,
  lastWorkoutCell,
  missedLine,
  newestWorkout,
  planLine,
  primaryAction,
  ringLabel,
  sheetDayIds,
  sheetRows,
  weekReference,
  weekStats,
  workoutTitle,
} from '../pageModel';
import { CompletionPopup } from '../runtime/RuntimeOverlays';
import restAlertPlatform from '../runtime/restAlertPlatform';
import { requestPermissionAtWorkoutStart } from '../runtime/restAlerts';
import { LeaveWorkoutDialog } from '../runtime/SessionDialogs';
import SessionRuntime from '../runtime/SessionRuntime';
import { applyOverlay, memberWeightUnit, reconcileOverlay } from '../runtime/sessionMath';
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
      <ShellPage
        testID="workout-screen"
        // T-140 ruling §2.1: Back left · bell right, ONE row. M1 (U5): always
        // the Today root; goBack under backBehavior "history" could land on
        // another tab.
        headerLeading={<BackPill testID="workout-back-today" label="Today" onPress={() => openShellPath('/')} />}
        // The header row lines up with the page's centred column (Hub below).
        contentMaxWidth={pageMaxWidth(width, height)}
      >
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


// The page title and (T-140 §6) the plan line "{plan} · week N". The kit
// BackPill (T-65, M1) sits on the shell header's bell row (headerLeading).
function HubHeader({ wide, planText, large = false }) {
  return (
    <View testID="workout-hub-header" style={styles.header}>
      <Text testID="workout-title" accessibilityRole="header" {...DISPLAY_TITLE_TEXT} style={wide ? styles.titleWide : styles.title}>
        Workout
      </Text>
      {planText ? (
        <Text testID="workout-plan-line" {...LINE_TEXT} numberOfLines={large ? 2 : 1} style={[styles.planLine, wide && styles.planLineWide]}>
          {planText}
        </Text>
      ) : null}
    </View>
  );
}

// T-140 (RN-SPEC): the plan days' exercises, one GET
// /plans/{id}/days/{dayId}/exercises per day, each once, after the load
// (undefined while loading, [] on a failure). Kept per plan.
function useSheetExercises(planId) {
  const [store, setStore] = useState({ planId: null, byDay: {} });
  const asked = useRef({ planId: null, ids: new Set() });
  const byDay = store.planId === planId ? store.byDay : {};
  const ensure = useCallback(
    (dayIds) => {
      if (!planId) {
        return;
      }
      if (asked.current.planId !== planId) {
        asked.current = { planId, ids: new Set() };
      }
      for (const dayId of dayIds) {
        if (asked.current.ids.has(dayId)) {
          continue;
        }
        asked.current.ids.add(dayId);
        const save = (items) =>
          setStore((current) => ({ planId, byDay: { ...(current.planId === planId ? current.byDay : {}), [dayId]: items } }));
        listDayExercises(planId, dayId)
          .then(save)
          .catch(() => save([]));
      }
    },
    [planId]
  );
  return [byDay, ensure];
}

// T-140 (RN-SPEC): a Done sheet's sessions, GET /workouts/{id} once per
// session when a Done sheet opens (undefined while loading, null on a
// failure: the sheet falls back to the planned rows with ✓).
function useSessionDetails() {
  const [byId, setById] = useState({});
  const asked = useRef(new Set());
  const ensure = useCallback((ids) => {
    for (const id of ids) {
      if (id == null || asked.current.has(id)) {
        continue;
      }
      asked.current.add(id);
      const save = (session) => setById((current) => ({ ...current, [id]: session }));
      getWorkout(id)
        .then(save)
        .catch(() => save(null));
    }
  }, []);
  return [byId, ensure];
}

function focus(ref) {
  const node = findNodeHandle(ref.current);
  if (node) {
    AccessibilityInfo.setAccessibilityFocus(node);
  }
}

// The page's centred column: 600 on a tablet in portrait, 920 at ≥ 1024
// landscape, none on a phone (ruling §9).
function pageMaxWidth(width, height) {
  if (width >= breakpoints.lg && width > height) {
    return 920;
  }
  return width >= breakpoints.md ? 600 : null;
}

// The confirm opens once the day sheet has slid away (two modals never
// animate at once).
const SHEET_TO_CONFIRM_MS = 320;

// T-140 Workout page "A-balanced" (owner approved 30 Oct 2026; UX
// T140-workout-page-BUILD-ruling; web parity). Phone / tablet portrait: one
// column (tablet: centred, max 600, ring 180). ≥ 1024 wide: the week card
// left, stats / Last workout / missed line / the gold action right. Every
// Start runs today's flows unchanged: today's Start starts at once; a
// catch-up and a start-early ask first (T-80 / T-102 confirms).
function Hub({ status, page, width, height = 0, actionError, successMessage, isStartingDayId, onRetry, onStart, onScheduleSaved, fontScale = 1 }) {
  const tablet = width >= breakpoints.md;
  const wide = width >= breakpoints.lg && width > height;
  const profile = useProfileStore((state) => state.profile);
  const { currentPlan, todayStatus, planDays, week } = page;
  const planId = currentPlan?.enrollment?.plan?.id;
  const todayDayId = todayStatus?.plan_day?.id;
  const [exercisesByDay, ensureExercises] = useSheetExercises(planId);
  const [sessionsById, ensureSessions] = useSessionDetails();
  const dayIdsKey = (planDays ?? []).map((day) => day.id).join(',');
  useEffect(() => {
    if (dayIdsKey) {
      ensureExercises(dayIdsKey.split(',').map(Number));
    }
  }, [dayIdsKey, ensureExercises]);
  // UX M3 (the no-schedule day rows): the content width picks the photo size.
  const [contentWidth, setContentWidth] = useState(0);
  // C2: "Choose training days" opens the schedule setup in place; focus goes
  // to its heading, and back to the button on Cancel.
  const [settingUp, setSettingUp] = useState(false);
  const [openCell, setOpenCell] = useState(null);
  const [sheetMounted, setSheetMounted] = useState(false);
  const sheetReturnRef = useRef(null);
  useSheetFocus(Boolean(openCell), { returnRef: sheetReturnRef });
  // T-80: starting a day other than today's planned workout asks first.
  // Focus returns to the control that asked when the dialog is cancelled.
  const [confirm, setConfirm] = useState(null);
  // Mounted on the first ask (and kept, for its close animation).
  const [confirmMounted, setConfirmMounted] = useState(false);
  const confirmReturnRef = useRef(null);
  useSheetFocus(Boolean(confirm), { returnRef: confirmReturnRef });
  const dayRefs = useRef([]);
  const lastRef = useRef(null);
  const missedRef = useRef(null);
  const actionRef = useRef(null);
  const headingRef = useRef(null);
  const chooseRef = useRef(null);
  const wasSettingUp = useRef(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
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
  const now = new Date();
  const finished = currentPlan?.enrollment?.plan ? null : finishedPlan(page.myPlans);
  const planText = finished ? `${finished.name} · finished` : planLine(currentPlan?.enrollment?.plan, currentPlan?.enrollment?.started_on, weekReference(week, now));
  // UX (a) / L2: past the large-text reflow the plan line and the Last
  // workout text may wrap to 2 lines.
  const large = fontScale > textScale.reflowAbove;
  const header = <HubHeader wide={wide} large={large} planText={planText ? keepUnitsTogether(planText) : null} />;
  const pageStyle = [styles.page, tablet && !wide && styles.pageTablet, wide && styles.pageWide];

  if (status === 'loading') {
    return (
      <View style={pageStyle}>
        {header}
        <PageSkeleton />
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
  if (finished) {
    // RN-SPEC T-140 Plan finished: the newest enrollment is completed.
    return (
      <View testID="workout-hub" style={pageStyle}>
        {toasts}
        {header}
        <PlanFinishedCard planName={finished.name} />
        <PillButton testID="workout-primary-action" size="cta" fullWidth title="Find your next plan" onPress={() => openShellPath('/plans')} />
      </View>
    );
  }
  if (!currentPlan?.enrollment?.plan) {
    // §8 No plan: today's empty state (copy + routes unchanged).
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

  // T-81: by date on the server's /week; the fallback stays as before.
  const thisWeek = hubWeek({
    week,
    schedule: currentPlan.schedule,
    doneIds: page.completedThisWeekDayIds,
    completed: page.completedThisWeek,
    startedOn: currentPlan.enrollment.started_on,
    now,
  });
  const state = hubState({ ...page, week: thisWeek.week, byDate: thisWeek.byDate });
  const todayTitle = planDayTitle(todayStatus?.plan_day);
  // T-102: this week's open misses from /week (none without it).
  const misses = weekMisses(week, now);
  const base = missedBase(state);

  const ask = (dayId, copy, ref) => {
    confirmReturnRef.current = ref?.current ?? null;
    setConfirmMounted(true);
    setConfirm({ dayId, ...copy });
  };
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

  if (state === 'noSchedule') {
    // A plan without training days: today's setup state as before (T-76 C2):
    // "Choose training days" + "Or start now" (each day asks first, T-80).
    const rows = dayRows({ planDays, schedule: currentPlan.schedule, doneIds: page.completedThisWeekDayIds, state, todayDayId, misses, week: thisWeek.week, completed: page.completedThisWeek, now });
    const requestStart = (day, ref) =>
      ask(day.dayId, startConfirmCopy({ state, title: day.title, done: Boolean(day.done), isToday: Boolean(todayStatus?.already_completed) && day.dayId === todayDayId, todayTitle }), ref);
    return (
      <View testID="workout-hub" style={pageStyle} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
        {toasts}
        {header}
        {settingUp ? (
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
          <HubTodayCard state={state} tablet={tablet} weekdayName={WEEKDAYS[(now.getDay() + 6) % 7].name} title={todayTitle} onChooseDays={() => setSettingUp(true)} chooseRef={chooseRef} />
        )}
        {rows.length ? (
          <HubDayRows
            copy={OTHER_DAYS_COPY[state]}
            rows={rows}
            exercisesByDay={exercisesByDay}
            startingDayId={isStartingDayId}
            onStart={requestStart}
            contentWidth={contentWidth}
            fontScale={fontScale}
          />
        ) : null}
        {confirmDialog}
      </View>
    );
  }

  const cells = dayCells({ strip: thisWeek.strip, week: thisWeek.week, completed: page.completedThisWeek, misses, planDays });
  const progress = thisWeek.progress;
  const stats = page.completedThisWeekFailed ? null : weekStats(page.completedThisWeek, memberWeightUnit(profile));
  const last = newestWorkout(page.completedThisWeek, page.lastCompleted);
  const missed = missedLine(misses);
  const action = primaryAction({ state, todayDayId, todayTitle, misses });

  const openSheet = (cell, ref) => {
    sheetReturnRef.current = ref?.current ?? null;
    ensureExercises(sheetDayIds(cell));
    if (cell.type === 'done') {
      ensureSessions(cell.done.map((item) => item?.id));
    }
    setSheetMounted(true);
    setOpenCell(cell);
  };
  const missCopy = (miss, title) => catchUpConfirmCopy({ miss, base, todayTitle, title });
  // The sheet closes first; the confirm (or today's start) follows, and a
  // cancelled confirm gives focus back to the day that opened the sheet.
  const runSheetAction = () => {
    const cell = openCell;
    const ref = sheetReturnRef.current;
    sheetReturnRef.current = null;
    setOpenCell(null);
    const dayId = cell.planDay?.id;
    if (cell.type === 'today') {
      onStart(dayId);
      return;
    }
    const copy =
      cell.type === 'missed'
        ? missCopy({ weekdayName: cell.weekday.name, planDay: cell.planDay }, planDayTitle(cell.planDay))
        : startConfirmCopy({ state, title: planDayTitle(cell.planDay), todayTitle });
    timers.current.push(setTimeout(() => ask(dayId, copy, { current: ref }), SHEET_TO_CONFIRM_MS));
  };
  const runAction = () => {
    if (action.kind === 'start') {
      onStart(action.dayId);
    } else {
      ask(action.dayId, missCopy(action.miss), actionRef);
    }
  };

  // A Done sheet lists what was logged (GET /workouts/{id}); if any detail
  // failed, the planned rows with ✓ and no detail.
  let rows = null;
  if (openCell?.type === 'done') {
    rows = doneRows(openCell.done.map((item) => (item?.id == null ? null : sessionsById[item.id])));
    if (rows === null) {
      rows = sheetRows(sheetDayIds(openCell), exercisesByDay, { bare: true });
    }
  } else if (openCell) {
    rows = sheetRows(sheetDayIds(openCell), exercisesByDay);
  }
  const sheet = openCell ? daySheet(openCell, { count: rows?.count ?? null }) : null;
  const daySheetView = sheetMounted ? (
    <DaySheet
      isOpen={Boolean(openCell)}
      sheet={sheet}
      rows={rows}
      starting={isStartingDayId != null}
      onClose={() => setOpenCell(null)}
      onAction={runSheetAction}
    />
  ) : null;

  const weekCard =
    cells.length && progress ? (
      <WeekCard
        cells={cells}
        progress={progress}
        label={ringLabel(state)}
        dayRefs={dayRefs}
        ring={wide ? { size: 190, numberSize: 60, ofSize: 26 } : tablet ? { size: 180 } : undefined}
        onOpenDay={(cell) => openSheet(cell, { current: dayRefs.current[cell.index] })}
      />
    ) : null;
  const statsCard = stats ? <StatsCard time={stats.time} volume={stats.volume} large={wide} /> : null;
  const lastRow = last ? (
    <LastWorkoutRow
      ref={lastRef}
      tall={wide}
      wrap={large}
      title={workoutTitle(last, planDays)}
      when={lastWhenText(last, now)}
      onPress={() => openSheet(lastWorkoutCell(last, cells, now, planDays), lastRef)}
    />
  ) : null;
  const missedRow = missed ? (
    <MissedLine
      ref={missedRef}
      weekday={missed.weekday}
      more={missed.more}
      onPress={() => {
        const cell = cells.find((item) => item.openMiss && item.weekday.name === missed.weekday);
        if (cell) {
          openSheet(cell, missedRef);
        }
      }}
    />
  ) : null;
  const actionButton = action ? (
    <PillButton
      ref={actionRef}
      testID="workout-primary-action"
      size="cta"
      fullWidth
      title={action.label}
      loading={isStartingDayId != null && isStartingDayId === action.dayId}
      disabled={isStartingDayId != null}
      icon={({ color }) => <PlayIcon size={18} color={color} />}
      onPress={runAction}
      style={wide ? styles.actionWide : null}
    />
  ) : null;

  if (wide) {
    return (
      <View testID="workout-hub" style={pageStyle}>
        {toasts}
        {header}
        <View testID="workout-split" style={styles.split}>
          {weekCard ? <View style={styles.splitLeft}>{weekCard}</View> : null}
          <View testID="workout-side" style={styles.splitRight}>
            {statsCard}
            {lastRow}
            {missedRow}
            {actionButton}
          </View>
        </View>
        {daySheetView}
        {confirmDialog}
      </View>
    );
  }

  return (
    <View testID="workout-hub" style={pageStyle}>
      {toasts}
      {header}
      {weekCard}
      {statsCard}
      {lastRow}
      {missedRow}
      {actionButton}
      {daySheetView}
      {confirmDialog}
    </View>
  );
}

// RN-SPEC T-140 Plan finished: eyebrow "Plan complete" (gold 13/600) and
// "You finished {plan}" 28/32/700 on the card ground with the gold glow.
function PlanFinishedCard({ planName }) {
  return (
    <View testID="workout-plan-finished" style={styles.finished}>
      <View pointerEvents="none" style={styles.finishedFill}>
        <GradientFill colors={gradients.card.colors} angle={gradients.card.angle} />
        <GradientFill radial={gradients.workoutFinishedGlow.radial} colors={gradients.workoutFinishedGlow.colors} stops={gradients.workoutFinishedGlow.stops} />
      </View>
      <Text {...CAP_BODY} style={styles.finishedEyebrow}>
        Plan complete
      </Text>
      <Text accessibilityRole="header" {...TITLE_TEXT} style={styles.finishedTitle}>
        {`You finished ${keepUnitsTogether(planName)}`}
      </Text>
    </View>
  );
}

// §8 loading: the ring circle, 7 day circles and the stats card.
function PageSkeleton() {
  return (
    <View testID="workout-skeleton" accessibilityRole="progressbar" accessibilityLabel="Loading workout" accessibilityState={{ busy: true }} style={styles.skeleton}>
      <View style={styles.skeletonCard}>
        <Skeleton radius={82} style={styles.skeletonRing} />
        <View style={styles.skeletonDays}>
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton key={index} radius={20} style={styles.skeletonDay} />
          ))}
        </View>
      </View>
      <Skeleton radius={20} style={styles.skeletonStats} />
      <Text testID="workout-skeleton-status" accessibilityLiveRegion="polite" {...CAP_BODY} style={styles.skeletonText}>
        Loading your workout…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 20,
  },
  pageTablet: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  pageWide: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: spacing[1],
  },
  title: {
    ...font(700),
    marginTop: 20,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: titleTracking(34, -0.04),
    color: colors.textPrimary,
  },
  titleWide: {
    ...font(700),
    marginTop: 20,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: titleTracking(44, -0.04),
    color: colors.textPrimary,
  },
  planLine: {
    ...font(400),
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  planLineWide: {
    fontSize: 16,
    lineHeight: 22,
  },
  split: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 24,
  },
  splitLeft: {
    flexGrow: 3,
    flexShrink: 1,
    flexBasis: 420,
  },
  splitRight: {
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: 280,
    gap: 16,
  },
  actionWide: {
    marginTop: 'auto',
  },
  finished: {
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.cardEdge,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 10,
  },
  finishedFill: {
    ...StyleSheet.absoluteFill,
  },
  finishedEyebrow: {
    ...font(600),
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
  },
  finishedTitle: {
    ...font(700),
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: titleTracking(28, -0.04),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  skeleton: {
    gap: 14,
  },
  skeletonCard: {
    alignItems: 'center',
    gap: 22,
    paddingTop: 20,
    paddingBottom: 14,
  },
  skeletonRing: {
    width: 164,
    height: 164,
  },
  skeletonDays: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  skeletonDay: {
    width: 40,
    height: 40,
  },
  skeletonStats: {
    height: 70,
  },
  skeletonText: {
    ...font(400),
    marginHorizontal: spacing[1],
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
