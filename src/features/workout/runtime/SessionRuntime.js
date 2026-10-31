import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Keyboard, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { formatNumber, formatWeight } from '../../../shared/format/numbers';
import { formatDuration } from '../../../shared/time/format';
import { InlineToast } from '../../../shared/components/ToastHost';
import { CAP_BODY, useLargeTextReflow } from '../../../shared/components/largeText';
import { useKeyboardOverlap } from '../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { ToastTone } from '../../../shared/components/toastStore';
import { breakpoints, colors, font, motion, spacing } from '../../../shared/theme/tokens';
import { BackdropBand } from '../../shell/StatusBarBackdrop';
import { useProfileStore } from '../../profile/profileStore';
import { abandonWorkout, completeWorkout, updateSessionSet } from '../api/workoutApi';
import { ExerciseSheet, SessionExerciseList, WorkoutExerciseNav } from './ExerciseNavigation';
import HowToSheet, { showHowToPill, useHowToLibrary } from './HowToSheet';
import {
  BrowsingBar,
  DID_IT_HEIGHT,
  DidItButton,
  DiscardWorkoutAction,
  ExerciseSegments,
  ExerciseStage,
  HowToButton,
  LastExerciseNote,
  ReloadErrorBar,
  SessionChrome,
  SessionStats,
  SetEditor,
  StaleSessionBanner,
  UpNextLink,
} from './RuntimeParts';
import { DISC_SIZE, DiscardDialog, ExactAlarmDialog, FinishEarlyDialog, RestTimerWidget, SpeakIntroDialog } from './RuntimeOverlays';
import { finishEarlyMessage, pickMessageIndex, readLastMessageIndex, saveLastMessageIndex } from './finishEarly';
import { restHero, restNextPreview } from './restPresentation';
import { FULL, fitSizes, nextFitStep } from './phoneFit';
import SetArcCard from './SetArcCard';
import restAlertPlatform from './restAlertPlatform';
import {
  buildSetEditPatch,
  buildSetPatch,
  centeredScrollOffset,
  completionDurationSeconds,
  completionSnapshot,
  createPendingSets,
  draftFromSavedSet,
  firstPendingSetKey,
  lastTimeLabel,
  lastTimeWeight,
  memberWeightUnit,
  muscleGroups,
  nextSetKeyAfter,
  orderedSets,
  previousSetFor,
  propagateDraft,
  restSecondsFor,
  sanitizeReps,
  seedDrafts,
  seedRepsDrafts,
  sessionProgress,
  sessionViewState,
  setKey,
  staleSessionTitle,
  stepReps,
  targetReps,
  stepWeight,
  targetRange,
  validateDraftWeight,
  volumeInUnit,
} from './sessionMath';
import useElapsedTimer from './useElapsedTimer';
import useRestAlerts from './useRestAlerts';
import useRestTimer from './useRestTimer';
import { endSessionState, useSessionValue } from './workoutSessionStore';
import { keepUnitsTogether } from '../../../shared/format/counts';

// The phone column (app-shell §"phone", §19.6); tablets use the window.
const COLUMN_MAX_WIDTH = 430;
// F1 tablet landscape: the logger column is clamp(320, 38vw, 480).
const TABLET_LOGGER_MIN = 320;
const TABLET_LOGGER_MAX = 480;
// Tablet: Workout dock, 40 above the bottom (+ inset).
const TABLET_DOCK_BOTTOM = 40;
// The dock's estimate before it is measured: the room under Did it (Up next).
const UP_NEXT_ESTIMATE = 32;
const LOCK_REST = 'Rest timer running — wait or skip it first';
// T-132 web 2.1.15 phone values (FE answers, web main 93d9eae3), one spot.
// Q2: the phone header bar is sticky at every size, large text included.
export const PHONE_HEADER_STICKY_AT_LARGE_TEXT = true;
// Q1: the gold rail is the header's last row: no room under it.
export const PHONE_HEADER_BOTTOM_GAP = 0;
// T-161 spec §3: the phone page ends 8 + the bottom safe area above the visible bottom.
export const PHONE_PAGE_BOTTOM = spacing[2];
// The longest the page stays hidden while the fit steps (PM 31 Oct: ~150 ms).
export const FIT_REVEAL_MS = 250;
// A step that changed nothing gives no layout event: after this long the same measurement is taken again.
const FIT_IDLE_MS = 80;
// The once-only re-check from FULL after a fit that ended below FULL (spec §5.3 web guard), a frame later.
const FIT_RECHECK_MS = 16;
// M1 restarts after settling: at most this many a second (a flapping layout must never loop).
const FIT_RESTARTS_PER_SECOND = 3;
// Q7: the minimised rest disc sits 24 above the bottom (+ the safe area);
// nothing keeps it off Did it (web RT:94-100).
export const PHONE_DISC_BOTTOM = spacing[6];

// The session runtime (RN-SPEC-workout Part B, v2 Phase 3 §3 / UX F1).
// `session` is already the O12-overlaid view; every derived value reads it.
// Layouts: phone live (stage · segments · set card · dock), phone browsing
// (stage + ring · rail · browsing bar · stats · set card · exercise nav),
// tablet live (stage column | logger column + inline list, dock), tablet
// browsing (single column, nav pill). One chrome in every state (ND3).
// RN-SPEC-workout O9 dated change (25 Oct 2026, T-37): a 409 from the set
// toggle or Complete means the session was already ended on another device.
export const ENDED_ELSEWHERE = 'This workout was already ended on another device. Start a new one when you’re ready.';

// { library exercise id: thumbnail url } for the completion popup.
export function exerciseImageMap(session) {
  const map = {};
  for (const item of session?.exercises ?? []) {
    const id = item.exercise?.id;
    const url = item.exercise?.thumbnail?.url;
    if (id != null && url) {
      map[id] = url;
    }
  }
  return map;
}

export function tabletLoggerWidth(width) {
  if (width >= breakpoints.lg) {
    return Math.min(TABLET_LOGGER_MAX, Math.max(TABLET_LOGGER_MIN, Math.round(width * 0.38)));
  }
  return Math.round(width * 0.45);
}

export default function SessionRuntime({
  session,
  planName,
  exerciseStatsMap,
  header,
  reload,
  reloadWithLoader,
  writeOverlay,
  actionError,
  setActionError,
  successMessage,
  setSuccessMessage,
  reloadError,
  retrying,
  onRetry,
  onCompleted,
  loadHowTo,
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const isFocused = useIsFocused();
  const stacked = useLargeTextReflow();
  const profile = useProfileStore((state) => state.profile);
  const volumeUnit = memberWeightUnit(profile);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  // The All (n) opener: the exercise sheet returns focus here on close.
  const allRef = useRef(null);
  const rowRefs = useRef({});
  // §22.3: the viewport and content heights are read when the key changes,
  // never as effect deps (a keyboard resize must not re-centre the row).
  const visibleHeight = useRef(0);
  const contentHeight = useRef(0);
  const [navHeight, setNavHeight] = useState(96);
  const [chromeHeight, setChromeHeight] = useState(48);
  const [measuredDock, setDockHeight] = useState(null);
  // T-59 follow-up: the unlogged drafts live in the session store, so a
  // remount of the screen (font scale, rotation, leaving and coming back)
  // keeps what was typed.
  const [drafts, setDrafts] = useSessionValue(session.id, 'drafts', {});
  const [repsDrafts, setRepsDrafts] = useSessionValue(session.id, 'repsDrafts', {});
  const [validation, setValidation] = useState({});
  // T-146 (FE Q1 default): the done set opened for editing on the phone card.
  const [editingSetId, setEditingSetId] = useState(null);
  const pendingSets = useRef(null);
  if (pendingSets.current === null) {
    pendingSets.current = createPendingSets();
  }
  const [pendingSetIds, setPendingSetIds] = useState(() => new Set());
  // T-89 (QA, web = native): the set PATCHes in flight, so Complete can wait
  // for them to settle; a set saved after POST /complete is lost.
  const setRequests = useRef(new Map());
  const [highlightedSetKey, setHighlightedSetKey] = useState('');
  const [viewingIndex, setViewingIndex] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [muscle, setMuscle] = useState('all');
  const [showDiscard, setShowDiscard] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  // T-105: the "Finish early?" sheet. The message outlives `open`, so the body
  // stays while the sheet fades out (reviewer N3); `asking` blocks a second
  // tap during the message read (N2).
  const [finishEarly, setFinishEarly] = useState({ open: false, message: null });
  const askingRef = useRef(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const elapsed = useElapsedTimer(session.started_at);
  const howTo = useHowToLibrary(loadHowTo ? { load: loadHowTo } : undefined);
  // Edge-to-edge Android isn't resized for the keyboard (iOS uses
  // automaticallyAdjustKeyboardInsets below). UX native final audit 27 Oct
  // 2026, final batch: the room is what the keyboard COVERS of the window
  // (useKeyboardOverlap), which includes the nav bar under the IME; the raw
  // height leaves it out.
  const keyboardHeight = useKeyboardOverlap();
  // A116 + ruling 2 amendment 1: the stage's bottom edge in the scroll and
  // whether it has scrolled out from under the top band.
  const reducedMotion = useReducedMotion();
  const [stageBottom, setStageBottom] = useState(null);
  // A116 device FAIL (iPhone, Release cc3b39b): the stage frame's top and its
  // bottom block's (How to + caption) top inside it, so the band can follow
  // the content rather than the whole stage.
  const [stageY, setStageY] = useState(null);
  // T-162 spec §5 / P5 (the phone fit): the column's height (the screen; the free room), the header bar's and the content
  // column's measured heights (the used room: the P5-SC header scales too), the weight/reps focus (the fit holds while a field has focus and re-fits when focus leaves the fields:
  // `blurs` counts the leaves), the stage's measures (LiveStage onMeasure) and the ladder's state for the current key.
  const [rootHeight, setRootHeight] = useState(null);
  const headerRef = useRef(null);
  const [fieldFocused, setFieldFocusedState] = useState(false);
  const [blurs, setBlurs] = useState(0);
  // §5.3: focus moving straight into the other field keeps the hold, so a blur lands a tick later unless a focus follows.
  const blurTimer = useRef(null);
  const setFieldFocused = useCallback((focused) => {
    clearTimeout(blurTimer.current);
    if (focused) {
      setFieldFocusedState(true);
      return;
    }
    blurTimer.current = setTimeout(() => {
      setFieldFocusedState(false);
      setBlurs((count) => count + 1);
    }, 0);
  }, []);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const heldFit = useRef(null);
  const [stageMeasure, setStageMeasure] = useState({});
  const onStageMeasure = useCallback((measured) => {
    setStageMeasure((prev) => (Object.keys(measured).every((key) => prev[key] === measured[key]) ? prev : { ...prev, ...measured }));
  }, []);
  const [usedLayout, setUsedLayout] = useState({ height: null, header: 0, seq: 0 });
  const [fitStore, setFitStore] = useState({ key: null, state: FULL, settled: false, seq: -1 });
  const [contentY, setContentY] = useState(null);
  const [pastPhoto, setPastPhoto] = useState(false);
  const bandOpacity = useRef(new Animated.Value(0)).current;

  // Rest-done sound and alerts (time §7.2, O4, A1, A2, A3). The spoken copy
  // is the short form once no set is left besides the one just done.
  const restAlerts = useRestAlerts(
    restAlertPlatform,
    (setId) => (session.exercises ?? []).some((exercise) => (exercise.sets ?? []).some((set) => !set.is_completed && set.id !== setId)),
    session.id
  );
  const rest = useRestTimer({ onRestComplete: setHighlightedSetKey, alerts: restAlerts.alerts, sessionId: session.id });

  const exercises = session.exercises ?? [];
  const progress = useMemo(() => sessionProgress(session), [session]);
  const ordered = useMemo(() => orderedSets(session), [session]);
  const groups = useMemo(() => muscleGroups(session), [session]);
  const staleTitle = staleSessionTitle(session.started_at);

  // §20.2: seed drafts on every load, never overwriting existing ones (the
  // reps drafts follow the same rule; U3 prefill).
  useEffect(() => {
    setDrafts((current) => seedDrafts(session, exerciseStatsMap, current));
    setRepsDrafts((current) => seedRepsDrafts(session, current));
    // The setters are stable per session (useSessionValue).
  }, [session, exerciseStatsMap, setDrafts, setRepsDrafts]);

  // §26 auto-advance: follow the active exercise whenever it changes.
  useEffect(() => {
    if (progress.activeExerciseIndex >= 0) {
      setViewingIndex(progress.activeExerciseIndex);
    }
  }, [progress.activeExerciseIndex]);

  // T-146 rev 40: another exercise in view starts at the top (the phone's
  // Resume banner is the first thing under the bar, then the photo).
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [viewingIndex]);

  // §26.1: the sheets and the discard dialog are dismissed on blur.
  useEffect(() => {
    if (!isFocused) {
      setShowSheet(false);
      setShowDiscard(false);
      setShowHowTo(false);
    }
  }, [isFocused]);

  // §22.3: fires only when the key changes to a non-empty value, and only if
  // its card is mounted; centred and clamped to the content. T-154: a fitted
  // phone page has nothing to scroll to (it stays at the top).
  const pageFitsRef = useRef(false);
  useEffect(() => {
    if (!highlightedSetKey || pageFitsRef.current) {
      return;
    }
    const row = rowRefs.current[highlightedSetKey];
    if (!row || !contentRef.current) {
      return;
    }
    row.measureLayout(
      contentRef.current,
      (_x, y, _w, h) => {
        const offset = centeredScrollOffset({ rowY: y, rowHeight: h, visibleHeight: visibleHeight.current, contentHeight: contentHeight.current });
        if (offset !== null) {
          scrollRef.current?.scrollTo({ y: offset, animated: true });
        }
      },
      () => {}
    );
  }, [highlightedSetKey]);

  // §23.1 automatic completion (⚠W13). It fires when the counts reach "all
  // done"; a failed completion doesn't re-fire it. completingRef is set
  // synchronously in handleComplete, so the effect and a Complete tap in the
  // same frame can't both send POST /complete.
  const completeRef = useRef(null);
  const completingRef = useRef(false);
  useEffect(() => {
    if (progress.totalSets > 0 && progress.completedSets === progress.totalSets && !completingRef.current) {
      completeRef.current?.();
    }
  }, [progress.totalSets, progress.completedSets]);

  // `saved` (T-146 M1): un-logging a done set from the edit state sends its
  // SAVED values, never an unsaved edit.
  async function toggleSet(exercise, set, saved = null) {
    // T-89 review LOW: no new set save once Complete has started (it would
    // land after POST /complete and get the server's 409).
    if (completingRef.current) {
      return;
    }
    setHighlightedSetKey('');
    const draft = saved ?? drafts[set.id];
    if (!set.is_completed) {
      const error = validateDraftWeight(draft?.actualWeightValue, draft?.actualWeightUnit || 'lb');
      if (error) {
        setValidation((current) => ({ ...current, [set.id]: error }));
        return;
      }
    }
    // A double tap while this set's PATCH is pending is ignored.
    if (!pendingSets.current.begin(set.id)) {
      return;
    }
    const finish = () => {
      pendingSets.current.end(set.id);
      setPendingSetIds(pendingSets.current.snapshot());
    };
    setActionError('');
    setPendingSetIds(pendingSets.current.snapshot());
    // U3: the reps the member entered go with the weight draft.
    const body = buildSetPatch(set, { ...draft, actualReps: repsDrafts[set.id] });
    try {
      const request = updateSessionSet(session.id, exercise.id, set.id, body);
      setRequests.current.set(set.id, request);
      let result;
      try {
        result = await request;
      } finally {
        setRequests.current.delete(set.id);
      }
      const saved = body.is_completed ? result?.workout_session_exercise_set : null;
      if (saved) {
        const sentUnit = body.actual_weight_unit || draft?.actualWeightUnit || 'lb';
        setDrafts((current) => ({ ...current, [set.id]: draftFromSavedSet(saved, sentUnit) }));
      }
      // O12 §3: the rest starts before anything else, then the overlay, then the reload.
      if (body.is_completed) {
        const nextKey = nextSetKeyAfter(ordered, set.id);
        // T-146 §1.4 (owner-approved change): no rest after the workout's
        // final set (no set left anywhere), even with a rest time; open sets
        // in an earlier exercise still rest.
        const seconds = nextKey ? restSecondsFor(set) : 0;
        if (seconds > 0) {
          rest.start(set.id, seconds, nextKey);
        } else {
          rest.clear();
          setHighlightedSetKey(nextKey);
        }
      } else {
        rest.clear();
      }
      writeOverlay(set.id, {
        is_completed: body.is_completed,
        actual_reps: body.actual_reps,
        actual_weight_value: saved ? saved.actual_weight_value ?? null : body.actual_weight_value,
        actual_weight_unit: saved ? saved.actual_weight_unit ?? null : body.actual_weight_unit,
        completed_at: body.completed_at,
      });
      setValidation((current) => ({ ...current, [set.id]: undefined }));
      finish();
      reload();
    } catch (error) {
      finish();
      if (getStatus(error) === 409) {
        endedElsewhere();
        return;
      }
      // [O9]: the server's message.
      setActionError(getServerMessage(error));
    }
  }

  // T-146 (FE Q1 default): "Save set k" re-saves a done set with the edited
  // weight and reps (it stays done); the card then returns to the live set.
  async function saveEditedSet(exercise, set) {
    if (completingRef.current) {
      return;
    }
    const draft = drafts[set.id];
    const error = validateDraftWeight(draft?.actualWeightValue, draft?.actualWeightUnit || 'lb');
    if (error) {
      setValidation((current) => ({ ...current, [set.id]: error }));
      return;
    }
    if (!pendingSets.current.begin(set.id)) {
      return;
    }
    setActionError('');
    setPendingSetIds(pendingSets.current.snapshot());
    const body = buildSetEditPatch(set, { ...draft, actualReps: repsDrafts[set.id] });
    const finish = () => {
      pendingSets.current.end(set.id);
      setPendingSetIds(pendingSets.current.snapshot());
    };
    try {
      const request = updateSessionSet(session.id, exercise.id, set.id, body);
      setRequests.current.set(set.id, request);
      let result;
      try {
        result = await request;
      } finally {
        setRequests.current.delete(set.id);
      }
      const saved = result?.workout_session_exercise_set;
      writeOverlay(set.id, {
        is_completed: true,
        actual_reps: body.actual_reps,
        actual_weight_value: saved ? saved.actual_weight_value ?? null : body.actual_weight_value,
        actual_weight_unit: saved ? saved.actual_weight_unit ?? null : body.actual_weight_unit,
        completed_at: body.completed_at,
      });
      setValidation((current) => ({ ...current, [set.id]: undefined }));
      setEditingSetId(null);
      finish();
      reload();
    } catch (failure) {
      finish();
      if (getStatus(failure) === 409) {
        endedElsewhere();
        return;
      }
      setActionError(getServerMessage(failure));
    }
  }

  // A done set's saved values as drafts (§20.2 + its saved reps).
  const savedDraftOf = (set) => draftFromSavedSet(set, set.actual_weight_unit || set.target_weight_unit || 'lb');
  const savedRepsOf = (set) => (set.actual_reps != null ? String(set.actual_reps) : '');

  // T-146 M1: leaving a done set's edit (Cancel, another set, Undo) puts its
  // saved values back; nothing is sent.
  function restoreSaved(set) {
    setDrafts((current) => ({ ...current, [set.id]: savedDraftOf(set) }));
    setRepsDrafts((current) => ({ ...current, [set.id]: savedRepsOf(set) }));
    setValidation((current) => (current[set.id] ? { ...current, [set.id]: undefined } : current));
  }

  // Opening a done set loads its saved values; picking another (or the same
  // one again) restores the one left first.
  function selectDoneSet(set) {
    const open = editingSetId != null ? (session.exercises ?? []).flatMap((item) => item.sets ?? []).find((item) => item.id === editingSetId) : null;
    if (open) {
      restoreSaved(open);
    }
    if (editingSetId === set.id) {
      setEditingSetId(null);
      return;
    }
    restoreSaved(set);
    setEditingSetId(set.id);
  }

  function cancelEdit(set) {
    restoreSaved(set);
    setEditingSetId(null);
  }

  function undoDoneSet(exercise, set) {
    restoreSaved(set);
    setEditingSetId(null);
    toggleSet(exercise, set, savedDraftOf(set));
  }

  // T-37: clear the rest and the highlight, show the message, go to the top
  // and reload with the loader. No session any more → the hub, whose
  // "Workout error" toast shows the same message. No completion summary.
  function endedElsewhere() {
    rest.clear();
    endSessionState();
    setHighlightedSetKey('');
    setActionError(ENDED_ELSEWHERE);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    return reloadWithLoader();
  }

  async function handleComplete() {
    if (completingRef.current) {
      return;
    }
    completingRef.current = true;
    const snapshot = completionSnapshot(session, planName, elapsed, volumeUnit);
    setActionError('');
    setIsCompleting(true);
    rest.clear();
    setHighlightedSetKey('');
    try {
      // T-89: never complete ahead of a set save (its result doesn't matter
      // here: a failed save shows its own error and stays unlogged).
      while (setRequests.current.size > 0) {
        await Promise.allSettled([...setRequests.current.values()]);
      }
      const result = await completeWorkout(session.id);
      endSessionState();
      setSuccessMessage('Workout completed.');
      // #15 (3c's PB card) and the photos it can show; volumeUnit per the
      // VOLUME RULE is already in the snapshot. T-64: Time = the server's
      // stored duration (the snapshot's clock only when it is missing).
      onCompleted({
        ...snapshot,
        durationSeconds: completionDurationSeconds(result, snapshot.durationSeconds),
        personalRecords: result?.new_personal_records,
        exerciseImages: exerciseImageMap(session),
      });
      await reload();
    } catch (error) {
      if (getStatus(error) === 409) {
        await endedElsewhere();
      } else {
        setActionError(getServerMessage(error));
      }
    } finally {
      completingRef.current = false;
      setIsCompleting(false);
    }
  }

  async function handleAbandon() {
    // [O9]: the previous action error is cleared by the next action.
    setActionError('');
    setShowDiscard(false);
    setIsAbandoning(true);
    rest.clear();
    setHighlightedSetKey('');
    try {
      await abandonWorkout(session.id);
      endSessionState();
      await reload();
    } catch (error) {
      // RN-SPEC-workout §24 (dated 27 Oct 2026): a 409 ("not in progress")
      // means the session already stopped (an earlier abandon's response was
      // lost). The user wanted out: exactly like success, no error.
      if (getStatus(error) === 409) {
        endSessionState();
        await reload();
      } else {
        setActionError(getServerMessage(error));
      }
    } finally {
      setIsAbandoning(false);
    }
  }

  completeRef.current = handleComplete;

  // T-105 (owner D1): Complete with n ≥ 1 sets left (read now) asks first; with
  // none it completes as before. The message never repeats the last one shown.
  async function requestComplete() {
    const left = progress.totalSets - progress.completedSets;
    if (left < 1) {
      handleComplete();
      return;
    }
    if (askingRef.current || finishEarly.open) {
      return;
    }
    askingRef.current = true;
    try {
      const index = pickMessageIndex(await readLastMessageIndex());
      saveLastMessageIndex(index);
      setFinishEarly({ open: true, message: finishEarlyMessage(index, left) });
    } finally {
      askingRef.current = false;
    }
  }
  const closeFinishEarly = () => setFinishEarly((current) => ({ ...current, open: false }));

  function changeDraft(exercise, set, field, value) {
    setDrafts((current) => propagateDraft(current, exercise, set.id, field, value));
    setValidation((current) => (current[set.id] ? { ...current, [set.id]: undefined } : current));
  }

  // ND1 / ND2 steppers; the new value is announced (F1 a11y).
  function step(exercise, set, field, direction) {
    if (field === 'weight') {
      const draft = drafts[set.id];
      const unit = draft?.actualWeightUnit || 'lb';
      const start = lastTimeWeight(previousSetFor(exercise, set), unit);
      const before = String(draft?.actualWeightValue ?? '').trim();
      const value = stepWeight(draft?.actualWeightValue, unit, direction, start);
      changeDraft(exercise, set, 'actualWeightValue', value);
      if (value) {
        AccessibilityInfo.announceForAccessibility?.(`${value} ${unit}`);
      } else if (before !== '') {
        // Batch 3 (c), web parity: only the "−" that clears the field speaks.
        AccessibilityInfo.announceForAccessibility?.('Weight cleared');
      }
      return;
    }
    const value = stepReps(repsDrafts[set.id], direction, targetReps(set));
    setRepsDrafts((current) => ({ ...current, [set.id]: value }));
    if (value) {
      AccessibilityInfo.announceForAccessibility?.(`${value} reps`);
    }
  }

  const viewing = Math.min(Math.max(viewingIndex ?? 0, 0), Math.max(exercises.length - 1, 0));
  const exercise = exercises[viewing];
  const activeIndex = progress.activeExerciseIndex;
  const { currentIndex: sheetCurrent, isActiveView, laterIncomplete, isLastIncomplete } = sessionViewState(exercises, viewing, activeIndex);
  const browsing = !isActiveView && activeIndex >= 0;
  const firstPendingKey = firstPendingSetKey(exercise);
  // Batch 2 item 2 (web parity): only the ACTIVE exercise has the live editor;
  // a browsed exercise's pending rows are locked (its done rows keep Undo).
  const editorSet = exercise && !browsing ? (exercise.sets ?? []).find((item) => setKey(exercise.id, item.id) === firstPendingKey) ?? null : null;
  const contentWidth = width - insets.left - insets.right;
  const tablet = contentWidth >= breakpoints.md;
  const liveSetLeft = progress.completedSets < progress.totalSets;
  // T-132 (web 2.1.15 phone): phones draw the chrome in a solid header bar
  // ABOVE the scroll, never over the photo; the tablet keeps its floating
  // pills (in flow at large text).
  const chromeOverlay = tablet && !stacked;
  // Batch 2 item 3: the per-exercise segments only live, with 2+ exercises
  // (the gold session rail is in SessionChrome, always).
  const showSegments = !browsing && exercises.length > 1;
  // T-154 (rev 42, owner: one screen, no scroll): at normal text the phone page fits the free height; phoneFit gives
  // the sizes in the ruling's shrink order. With an increased OS text size (the a11y exception) the page scrolls.
  const fitActive = !tablet && !stacked;
  const fitUpNext = !browsing && isActiveView && (laterIncomplete !== -1 || isLastIncomplete);
  // S3 slims the Up next row: only when that row shows (not the last exercise's note).
  const fitUpNextRow = !browsing && isActiveView && laterIncomplete !== -1;
  const fitPreviousRow = browsing || (exercise?.sets ?? []).some((item) => item.is_completed) || Boolean(editorSet && previousSetFor(exercise, editorSet));
  const fitHasPhoto = Boolean(exercise?.exercise?.thumbnail?.url);
  const doneSets = (exercise?.sets ?? []).filter((item) => item.is_completed).length;
  // §5.3: anything that changes the room or the content starts again from FULL: the room, the exercise, its done/total,
  // the rows that appear or collapse, the name's lines, the photo getting its aspect, leaving a field.
  const fitKey = JSON.stringify([
    rootHeight == null ? null : Math.round(rootHeight),
    exercise?.id,
    doneSets,
    exercise?.sets?.length ?? 0,
    browsing,
    fitPreviousRow,
    fitUpNext,
    editingSetId,
    stageMeasure.photoNatural ?? null,
    stageMeasure.nameLines ?? 1,
    blurs,
  ]);
  const fitState = fitStore.key === fitKey ? fitStore.state : FULL;
  const freshFit = fitActive && exercise ? fitSizes(fitState, { browse: browsing }) : null;
  const fitColumnWidth = Math.min(width - insets.left - insets.right, COLUMN_MAX_WIDTH);
  const fit = fieldFocused && heldFit.current ? heldFit.current : freshFit;
  if (!fieldFocused) {
    heldFit.current = freshFit;
  }
  // §5.1: over = used − free; used = the header bar + the content column, free = the column − the page's 8 − the bottom
  // safe area (the header is in both, so its P5-SC scaling never moves the room). One step per measurement until it fits
  // or no step is left (the layout then stays; no scroll). The measurements are the onLayout events (the laid-out sizes):
  // a synchronous measure() in a layout effect read ~72 taller than the final layout on iOS (T-162 diag, 31 Oct).
  useLayoutEffect(() => {
    if (!fitActive || !exercise || fieldFocused || rootHeight == null) {
      return;
    }
    // A new key starts from FULL (drawn this render); the last layout event is from before it: adopt the key and wait for
    // FULL's own layout.
    if (fitStore.key !== fitKey) {
      // The ladder is driven from layout: adopting the new key here is its first step, before paint.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFitStore({ key: fitKey, state: FULL, settled: false, seq: usedLayout.seq, rechecked: false, restarts: [] });
      return;
    }
    // Step only on a layout event that came after the last step.
    if (usedLayout.height == null || usedLayout.seq <= fitStore.seq) {
      return;
    }
    const used = usedLayout.height + usedLayout.header;
    // §5.3 (web: ResizeObserver): after it settles, any other change of the content's height (the weight error line, a
    // message above the card) starts again from FULL.
    if (fitStore.settled) {
      const now = Date.now();
      const restarts = (fitStore.restarts ?? []).filter((at) => now - at < 1000);
      if (Math.round(used) !== fitStore.used && restarts.length < FIT_RESTARTS_PER_SECOND) {
        // Each run gets its own re-check (web parity, review L5).
        setFitStore({ key: fitKey, state: FULL, settled: false, seq: usedLayout.seq, rechecked: false, restarts: [...restarts, now] });
      }
      return;
    }
    const over = Math.ceil(used - (rootHeight - PHONE_PAGE_BOTTOM - insets.bottom));
    const next = nextFitStep(fitStore.state, {
      over,
      hasPhoto: fitHasPhoto,
      browse: browsing,
      photoDrawn: stageMeasure.photoNatural ?? null,
      nameLines: stageMeasure.nameLines ?? 1,
      columnWidth: fitColumnWidth,
      upNext: fitUpNextRow,
    });
    const probe = { over, used: Math.round(used), root: Math.round(rootHeight), rechecked: fitStore.rechecked, restarts: fitStore.restarts };
    setFitStore(next ? { key: fitKey, state: next, settled: false, seq: usedLayout.seq, ...probe } : { key: fitKey, state: fitStore.state, settled: true, seq: usedLayout.seq, ...probe });
  }, [fitActive, exercise, fieldFocused, rootHeight, fitStore, fitKey, usedLayout, insets.bottom, fitHasPhoto, browsing, stageMeasure.photoNatural, stageMeasure.nameLines, fitColumnWidth, fitUpNextRow]);
  // A layout event can be in flight from before a step (seen on device: a fit settled on the previous layout and ended
  // ~70 too small). So: a step that brings no layout event is measured again after FIT_IDLE_MS, and a fit that ends
  // below FULL re-checks once from FULL (web's guard, §5.3).
  const fitStepping = Boolean(fit) && !fieldFocused && fitStore.key === fitKey && !fitStore.settled;
  useEffect(() => {
    if (!fitStepping) {
      return undefined;
    }
    const seq = fitStore.seq;
    const timer = setTimeout(() => setUsedLayout((prev) => (prev.seq === seq ? { ...prev, seq: prev.seq + 1 } : prev)), FIT_IDLE_MS);
    return () => clearTimeout(timer);
  }, [fitStepping, fitStore.seq, fitStore.state]);
  const fitBelowFull = fitStore.state.level !== FULL.level || fitStore.state.photo !== FULL.photo;
  const fitRecheckDue = Boolean(fit) && !fieldFocused && fitStore.key === fitKey && fitStore.settled && fitBelowFull && !fitStore.rechecked;
  useEffect(() => {
    if (!fitRecheckDue) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setFitStore((prev) => (prev.key === fitKey && prev.settled ? { ...prev, state: FULL, settled: false, rechecked: true } : prev));
    }, FIT_RECHECK_MS);
    return () => clearTimeout(timer);
  }, [fitRecheckDue, fitKey]);
  // The steps are never seen (PM 31 Oct): on the first mount and on a change of exercise or view the page is held
  // invisible until the fit settles, at most FIT_REVEAL_MS, then shown in one go. In-place changes (a set, Undo, the edit
  // row, the photo's aspect, a message) re-fit visibly, without a blank frame (review L1).
  // Settled for good: at FULL, or after the re-check.
  const fitSettled = fitStore.key === fitKey && fitStore.settled && (!fitBelowFull || fitStore.rechecked);
  const fitView = `${exercise?.id ?? ''}|${browsing}`;
  const [shownView, setShownView] = useState(null);
  if (fit && fitSettled && shownView !== fitView) {
    setShownView(fitView);
  }
  const fitHidden = Boolean(fit) && !fieldFocused && !fitSettled && shownView !== fitView;
  useEffect(() => {
    if (!fitHidden) {
      return undefined;
    }
    const timer = setTimeout(() => setShownView(fitView), FIT_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [fitHidden, fitView]);
  // The fit's state for e2e (web: data-fit-step / data-scaled), in the page's testID: the level, the photo cap, the
  // last measured over, the used and the column heights, settled.
  const fitStoreNow = fitStore.key === fitKey ? fitStore : null;
  const fitMarker = fit
    ? `fit-L${fit.level}-P${fitState.photo ?? 'n'}-O${fitStoreNow?.over ?? 'x'}-U${fitStoreNow?.used ?? 'x'}-R${fitStoreNow?.root ?? 'x'}${fitStoreNow?.settled ? '-settled' : ''}`
    : null;
  const onPageContentLayout = (event) => {
    const { height: measured } = event.nativeEvent.layout;
    setUsedLayout((prev) => ({ ...prev, height: measured, seq: prev.seq + 1 }));
  };
  const onHeaderLayout = (event) => {
    const { height: measured } = event.nativeEvent.layout;
    setUsedLayout((prev) => ({ ...prev, header: measured, seq: prev.seq + 1 }));
  };
  pageFitsRef.current = Boolean(fit) && fitStore.key === fitKey && fitStore.settled && !(fitStore.over > 0);
  // P5-SC: the scaled header has 6 above the pills (10 normally).
  const chromeTop = (header ? spacing[3] : insets.top + (fit?.scaled ? 6 : spacing['2_5'])) + (tablet ? spacing[3] : 0);
  // §17 / web parity: a button press takes focus off the weight input.
  const dismiss = (handler) => (...args) => {
    Keyboard.dismiss();
    return handler(...args);
  };
  const openSheet = dismiss(() => setShowSheet(true));

  const chrome = (
    <SessionChrome
      planName={planName || 'Workout'}
      completedSets={progress.completedSets}
      totalSets={progress.totalSets}
      exerciseCount={exercises.length}
      elapsed={elapsed}
      onExit={dismiss(() => setShowDiscard(true))}
      onAll={openSheet}
      // T-105: Complete in the header at every size (ND4 tone: primary when no
      // live set is left, else glass); "Complete workout" from 1024.
      wide={width >= breakpoints.lg}
      onComplete={dismiss(requestComplete)}
      completing={isCompleting}
      completeDisabled={pendingSetIds.size > 0}
      completePrimary={!liveSetLeft}
      allRef={allRef}
      tablet={tablet}
      scaled={Boolean(fit?.scaled)}
      onLayout={chromeOverlay ? (event) => setChromeHeight(event.nativeEvent.layout.height) : undefined}
      style={
        chromeOverlay
          ? [styles.chromeOverlay, { top: chromeTop }]
          : [styles.chromeInFlow, { paddingTop: chromeTop }, !tablet && { paddingBottom: PHONE_HEADER_BOTTOM_GAP }]
      }
    />
  );
  const stageTop = chromeOverlay ? chromeTop + chromeHeight + spacing[3] : 0;
  // UX native final audit 27 Oct 2026, A116 + ruling 2 amendment 1: the
  // session's top band, in the status-bar backdrop's colours. It covers the
  // top edge down to the floating pills' bottom (only the status bar when the
  // pills scroll in flow, large text). No band while the edge-to-edge photo
  // is under it; it fades in (150 ms, at once with reduced motion) once the
  // photo has scrolled out from under it. Only where one scroll holds the
  // stage under floating pills (tablet browsing): the tablet live logger
  // column already starts below the pills and its stage column does not
  // scroll.
  // T-132: phones have no band: their header bar is solid and above the
  // scroll (tablet browsing keeps it).
  const oneScroll = tablet && browsing;
  const bandHeight = oneScroll ? (chromeOverlay ? chromeTop + chromeHeight : header ? 0 : insets.top) : 0;
  // A116 device FAIL (27 Oct 2026, iPhone Release cc3b39b): the band waited
  // for the whole stage to clear the pills, so on a short live page (about
  // 100 of scroll) it never came while "Current exercise" and How to ran
  // under them. It now shows as soon as content passes under the PILLS: when
  // the open photo's bottom edge (the stage's How to + caption block starts
  // there; photoEdge − scrollY) goes above the pills' bottom. The stage
  // bottom stands in until that block has been measured.
  const photoEdge = stageY !== null && contentY !== null ? stageY + contentY : stageBottom;
  const bandOn = bandHeight > 0 && photoEdge !== null && pastPhoto;
  const onPageScroll = (event) => {
    const past = photoEdge !== null && photoEdge - event.nativeEvent.contentOffset.y <= bandHeight;
    setPastPhoto((current) => (current === past ? current : past));
  };
  useEffect(() => {
    if (reducedMotion) {
      bandOpacity.setValue(bandOn ? 1 : 0);
      return undefined;
    }
    const fade = Animated.timing(bandOpacity, { toValue: bandOn ? 1 : 0, duration: motion.durationFast, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [bandOn, reducedMotion, bandOpacity]);
  const howToEntry = exercise?.exercise?.id ? howTo.entries[exercise.exercise.id] : null;
  const howToButton =
    exercise?.exercise?.id && showHowToPill(howToEntry, exercise) ? (
      <HowToButton
        tablet={tablet}
        onPage={!tablet && !browsing}
        compact={Boolean(fit?.rowCompact)}
        scaled={Boolean(fit?.scaled)}
        onPress={dismiss(() => {
          howTo.fetchEntry(exercise.exercise.id);
          setShowHowTo(true);
        })}
      />
    ) : null;

  // Prefetch the viewed exercise's How-to so an empty one hides its pill.
  const viewedLibraryId = exercise?.exercise?.id;
  const { fetchEntry } = howTo;
  useEffect(() => {
    if (viewedLibraryId) {
      fetchEntry(viewedLibraryId);
    }
  }, [viewedLibraryId, fetchEntry]);

  const messages =
    staleTitle || reloadError || successMessage || actionError ? (
      <View style={styles.messages}>
        {staleTitle ? <StaleSessionBanner title={staleTitle} /> : null}
        {reloadError ? <ReloadErrorBar retrying={retrying} onRetry={onRetry} /> : null}
        {successMessage ? <InlineToast testID="workout-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} /> : null}
        {actionError ? <InlineToast testID="workout-action-error" tone={ToastTone.error} title="Workout error" message={actionError} /> : null}
      </View>
    ) : null;

  const didIt = editorSet ? (
    <DidItButton
      set={editorSet}
      isPending={pendingSetIds.has(editorSet.id)}
      isLocked={Boolean(rest.timer)}
      lockReason={LOCK_REST}
      onPress={dismiss(() => toggleSet(exercise, editorSet))}
      arc={!tablet}
      compact={Boolean(fit?.compactCard)}
      scaled={Boolean(fit?.scaled)}
    />
  ) : null;
  // T-146 phone: the done set being edited (FE Q1), only while it is still done.
  const editingSet = !tablet && exercise ? (exercise.sets ?? []).find((item) => item.id === editingSetId && item.is_completed) ?? null : null;
  const saveSet = editingSet ? (
    <DidItButton
      set={editingSet}
      title={`Save set ${editingSet.set_number}`}
      isPending={pendingSetIds.has(editingSet.id)}
      isLocked={false}
      onPress={dismiss(() => saveEditedSet(exercise, editingSet))}
      arc
      compact={Boolean(fit?.compactCard)}
      scaled={Boolean(fit?.scaled)}
    />
  ) : null;
  // The set the phone card's steppers edit.
  const cardSet = editingSet ?? editorSet;
  // T-146 rev 40 (phone browsing): the row under the read-only arc: the rep
  // target + "Last time …" of the exercise's next (else first) set.
  const browseSet = exercise ? (exercise.sets ?? []).find((item) => !item.is_completed) ?? exercise.sets?.[0] ?? null : null;
  const browseLine = browsing && browseSet
    ? [targetRange(browseSet) ? `${targetRange(browseSet)} reps` : '', lastTimeLabel(previousSetFor(exercise, browseSet), drafts[browseSet.id]?.actualWeightUnit || 'lb') ?? '']
        .filter(Boolean)
        .join(' · ')
    : '';

  const editorKey = editorSet ? setKey(exercise.id, editorSet.id) : '';
  const setCard = exercise && !tablet ? (
    <SetArcCard
      exercise={exercise}
      set={editorSet}
      editing={editingSet}
      draft={cardSet ? drafts[cardSet.id] : undefined}
      reps={cardSet ? repsDrafts[cardSet.id] : undefined}
      lastTime={editorSet ? lastTimeLabel(previousSetFor(exercise, editorSet), drafts[editorSet.id]?.actualWeightUnit || 'lb') : null}
      highlighted={Boolean(editorKey) && highlightedSetKey === editorKey}
      validationError={cardSet ? validation[cardSet.id] : undefined}
      pendingSetIds={pendingSetIds}
      cardRef={(node) => {
        if (editorKey) {
          rowRefs.current[editorKey] = node;
        }
      }}
      onWeightChange={(value) => changeDraft(exercise, cardSet, 'actualWeightValue', value)}
      onUnitChange={(value) => changeDraft(exercise, cardSet, 'actualWeightUnit', value)}
      onRepsChange={(value) => setRepsDrafts((current) => ({ ...current, [cardSet.id]: sanitizeReps(value) }))}
      onStep={(field, direction) => step(exercise, cardSet, field, direction)}
      onSelectDone={dismiss(selectDoneSet)}
      onCancel={dismiss(cancelEdit)}
      onUndo={dismiss((item) => undoDoneSet(exercise, item))}
      action={editingSet ? saveSet : didIt}
      browsing={browsing}
      browseLine={browseLine}
      fit={fit}
      onFieldFocus={setFieldFocused}
    />
  ) : exercise ? (
    <SetEditor
      exercise={exercise}
      set={editorSet}
      draft={editorSet ? drafts[editorSet.id] : undefined}
      reps={editorSet ? repsDrafts[editorSet.id] : undefined}
      lastTime={editorSet ? lastTimeLabel(previousSetFor(exercise, editorSet), drafts[editorSet.id]?.actualWeightUnit || 'lb') : null}
      tablet={tablet}
      highlighted={Boolean(editorKey) && highlightedSetKey === editorKey}
      validationError={editorSet ? validation[editorSet.id] : undefined}
      pendingSetIds={pendingSetIds}
      cardRef={(node) => {
        if (editorKey) {
          rowRefs.current[editorKey] = node;
        }
      }}
      onWeightChange={(value) => changeDraft(exercise, editorSet, 'actualWeightValue', value)}
      onUnitChange={(value) => changeDraft(exercise, editorSet, 'actualWeightUnit', value)}
      onRepsChange={(value) => setRepsDrafts((current) => ({ ...current, [editorSet.id]: sanitizeReps(value) }))}
      onStep={(field, direction) => step(exercise, editorSet, field, direction)}
      onToggleSet={dismiss((item) => toggleSet(exercise, item))}
      // T-132 (web 2.1.15 phone): Did it sits INSIDE the set card; the
      // tablet keeps it in the logger column's dock.
      action={tablet ? null : didIt}
    />
  ) : null;

  const lastNote = isActiveView && isLastIncomplete ? <LastExerciseNote /> : null;
  // T-155: the full-width row by default; the small link only in the fit's compact sizes.
  const discard = <DiscardWorkoutAction abandoning={isAbandoning} link={Boolean(fit?.discardLink)} scaled={Boolean(fit?.scaled)} onPress={dismiss(() => setShowDiscard(true))} />;
  // T-132 (web WP:1076-1115, phone): card → Up next / "Last exercise" →
  // Discard, 12 apart, with 12 more above Discard.
  const endActions = tablet ? (
    <View style={styles.endActions}>
      {lastNote}
      {/* T-105: Complete moved to the header; Discard stays here. */}
      {discard}
    </View>
  ) : (
    <>
      {lastNote}
      <View style={fit ? { marginTop: fit.discardTop } : styles.discardPhone}>{discard}</View>
    </>
  );

  const browsingBar = <BrowsingBar tablet={tablet} onResume={dismiss(() => setViewingIndex(activeIndex))} />;
  const volume = formatWeight(volumeInUnit(progress.volumeKg, volumeUnit), null, 0);
  const stats = <SessionStats time={formatDuration(elapsed)} volume={volume} volumeUnit={volumeUnit} reps={formatNumber(progress.actualReps, 0)} tablet={tablet} />;

  const stage = exercise ? (
    <ExerciseStage
      exercise={exercise}
      index={viewing}
      count={exercises.length}
      isActive={isActiveView}
      variant={browsing ? 'browse' : tablet ? 'split' : 'live'}
      tablet={tablet}
      top={tablet && !browsing ? (chromeOverlay ? stageTop : 0) : stageTop}
      chrome={tablet && browsing && !chromeOverlay ? chrome : null}
      howTo={howToButton}
      segments={tablet && showSegments ? <ExerciseSegments exercises={exercises} viewingIndex={viewing} tablet /> : null}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        setStageY(y);
        setStageBottom(y + height);
      }}
      onContentLayout={(event) => setContentY(event.nativeEvent.layout.y)}
      fit={fit}
      onMeasure={fitActive ? onStageMeasure : undefined}
    />
  ) : null;

  const scrollProps = {
    ref: scrollRef,
    onLayout: (event) => {
      visibleHeight.current = event.nativeEvent.layout.height;
    },
    onContentSizeChange: (_w, h) => {
      contentHeight.current = h;
    },
    keyboardShouldPersistTaps: 'handled',
    automaticallyAdjustKeyboardInsets: true,
  };
  const androidKeyboard = Platform.OS === 'android' ? keyboardHeight : 0;
  const upNext = !tablet && isActiveView && laterIncomplete !== -1 ? exercises[laterIncomplete] : null;
  // T-132: only the tablet has a dock (Did it under the logger column); the
  // phone's Did it is in the card and Up next follows the card.
  const showDock = !browsing && tablet && Boolean(didIt);
  // P3-2: the tablet dock is an opaque band down to the screen bottom; its
  // measured height already holds the safe area, and the room is that height
  // + a gap. T-132: phones have no dock (24 + the safe area).
  const dockHeight = measuredDock ?? DID_IT_HEIGHT + UP_NEXT_ESTIMATE + spacing[3] + TABLET_DOCK_BOTTOM + insets.bottom;
  const bottomRoom = browsing && tablet
    ? navHeight + spacing[5] + insets.bottom
    : showDock
      ? dockHeight + spacing[4]
      : (tablet ? spacing[6] : PHONE_PAGE_BOTTOM) + insets.bottom;
  // The room the minimised disc docks above: the tablet dock's / the nav's;
  // T-132 the live phone's is 24 + the safe area (web: right 24 / bottom 24).
  const discDockRoom = !tablet && !browsing ? PHONE_DISC_BOTTOM + insets.bottom : bottomRoom;
  // I2 follow-up (a) + UX I2-r ruling: the minimised disc docks just above
  // `bottomRoom`; while it shows, the scroll also keeps the disc (92) + its 24
  // gap, so every row, the last included, scrolls fully clear. Phones too
  // since UX ruling A121 (option B, 27 Oct 2026).
  const discRoom = rest.timer && rest.minimized ? DISC_SIZE + spacing[6] : 0;

  // M6: the expanded Rest is modal for TalkBack too (accessibilityViewIsModal
  // is iOS-only): hide what is behind it while it is open.
  const restExpanded = Boolean(rest.timer) && !rest.minimized;
  const behindRest = {
    importantForAccessibility: restExpanded ? 'no-hide-descendants' : 'auto',
    accessibilityElementsHidden: restExpanded,
  };

  // T-132 (web 2.1.15 phone): the solid header bar (the status-bar area, the
  // chrome and its gold rail) sits ABOVE the page scroll, so the photo starts
  // under it and never runs under the clock or the pills.
  const phoneHeader = tablet ? null : (
    <View ref={headerRef} collapsable={false} testID="session-header-bar" onLayout={onHeaderLayout} style={styles.headerBar}>
      {chrome}
    </View>
  );
  const phoneHeaderSticky = Boolean(phoneHeader) && (!stacked || PHONE_HEADER_STICKY_AT_LARGE_TEXT);

  let body;
  if (tablet && !browsing) {
    // Tablet: Workout. Stage column | logger column; the dock sits under the
    // logger column (its inner width).
    const loggerWidth = tabletLoggerWidth(contentWidth);
    body = (
      <View style={styles.splitRow}>
        <View style={styles.splitStage}>{stage}</View>
        {/* I2 follow-up (b): with the overlay header the column starts below
            it and clips, so a scrolled card never draws under the header. */}
        <View testID="session-logger" style={[styles.logger, { width: loggerWidth }, chromeOverlay && { marginTop: chromeTop + chromeHeight }]}>
          <ScrollView
            {...scrollProps}
            contentContainerStyle={{ paddingTop: chromeOverlay ? spacing[3] : spacing[4], paddingBottom: bottomRoom + discRoom + androidKeyboard, paddingHorizontal: spacing[6] }}
          >
            <View ref={contentRef} collapsable={false} style={styles.loggerContent}>
              {messages}
              {setCard}
              <SessionExerciseList
                title={keepUnitsTogether(planName) || 'Workout'}
                exercises={exercises}
                currentIndex={sheetCurrent}
                viewingIndex={viewing}
                onSelect={dismiss(setViewingIndex)}
              />
              {endActions}
            </View>
          </ScrollView>
          {showDock && didIt ? (
            <View testID="session-dock" onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)} style={[styles.dockTablet, { paddingBottom: TABLET_DOCK_BOTTOM + insets.bottom }]}>
              {didIt}
            </View>
          ) : null}
        </View>
      </View>
    );
  } else {
    body = (
      <ScrollView
        {...scrollProps}
        // T-154: no scroll on a fitted phone page (only the a11y exception, or a fit that failed, scrolls).
        scrollEnabled={!fit || androidKeyboard > 0}
        onScroll={onPageScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomRoom + discRoom + androidKeyboard }}
      >
        <View ref={contentRef} collapsable={false} testID={fitMarker ? `session-page ${fitMarker}` : 'session-page'} onLayout={fit ? onPageContentLayout : undefined} style={fitHidden ? styles.fitHidden : null}>
          {phoneHeader && !phoneHeaderSticky ? phoneHeader : null}
          {/* T-132 (web WP:869-882, 1075): phone browsing puts the bar above the photo. */}
          {browsing && !tablet ? <View style={styles.phoneBrowsingBar}>{browsingBar}</View> : null}
          {stage}
          <View style={[styles.main, tablet && styles.mainTablet, tablet && browsing && styles.mainBrowsing, !tablet && styles.mainPhone, fit && { paddingTop: fit.containerGap, gap: fit.upNextGap }]}>
            {browsing && tablet ? browsingBar : null}
            {browsing && tablet ? stats : null}
            {messages}
            {setCard}
            {/* T-146 rev 40: phone browsing: Volume + Reps as one muted line under the card (Time is the header clock). */}
            {browsing && !tablet && (!fit || fit.statsLine) ? (
              <Text {...CAP_BODY} testID="session-stats-line" style={styles.statsLine}>
                {`${volume} ${volumeUnit} volume · ${formatNumber(progress.actualReps, 0)} reps`}
              </Text>
            ) : null}
            {/* T-132 (web 2.1.15 phone): Up next follows the card. */}
            {upNext ? (
              <UpNextLink
                exercise={upNext}
                compact={Boolean(fit?.upNextSlim)}
                scaled={Boolean(fit?.scaled)}
                // P3: clear of the minimised disc while it sits in its default place.
                clearDisc={Boolean(rest.timer) && rest.minimized && !rest.position}
                onPress={dismiss(() => setViewingIndex(laterIncomplete))}
              />
            ) : null}
            {endActions}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    // QA F1, iOS: a live text-size change leaves unchanged texts with their
    // old measurements (see ShellPage), and the timer re-renders every second.
    // The frame remounts on a new text scale; the session state (sets, rest,
    // dialogs) lives in this component's hooks and is kept.
    <View key={`text-scale-${fontScale}`} style={[styles.frame, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      {header ? (
        <View testID="session-header" {...behindRest} style={[styles.header, { paddingTop: insets.top }]}>
          {header}
        </View>
      ) : null}
      <View
        testID="session-column"
        {...behindRest}
        onLayout={tablet ? undefined : (event) => setRootHeight(event.nativeEvent.layout.height)}
        style={[styles.column, !tablet && styles.columnPhone]}
      >
        {tablet && !browsing && !chromeOverlay ? chrome : null}
        {phoneHeaderSticky ? phoneHeader : null}
        {body}
        {bandHeight > 0 ? (
          <BackdropBand testID="session-top-band" height={bandHeight} opacity={reducedMotion ? (bandOn ? 1 : 0) : bandOpacity} />
        ) : null}
        {chromeOverlay ? chrome : null}
        {/* Owner 30 Oct (web 2.4.1): no bottom exercise navigator on phones; the header's All (N) switches. */}
        {browsing && tablet ? (
          <WorkoutExerciseNav
            exercises={exercises}
            viewingIndex={viewing}
            onView={dismiss(setViewingIndex)}
            onOpenSheet={openSheet}
            onHeight={setNavHeight}
          />
        ) : null}
      </View>
      <RestTimerWidget
        timer={rest.timer}
        next={restNextPreview(session, rest.timer?.nextSetKey, drafts)}
        hero={rest.timer ? restHero(session, rest.timer.setId, rest.timer.nextSetKey) : null}
        minimized={rest.minimized}
        onMinimize={dismiss(() => rest.setMinimized(true))}
        onExpand={dismiss(() => rest.setMinimized(false))}
        onAdjust={dismiss(rest.adjust)}
        onSkip={dismiss(() => {
          setHighlightedSetKey(rest.timer?.nextSetKey ?? '');
          rest.clear();
        })}
        position={rest.position}
        onPosition={rest.setPosition}
        // UX verdict I2 (iPad): the tablet disc docks above the opaque dock,
        // in the same room the scroll keeps for it (ignored on phones).
        dockRoom={discDockRoom}
      />
      <ExerciseSheet
        open={showSheet}
        planName={planName || 'Workout'}
        returnFocusRef={allRef}
        exercises={exercises}
        muscleGroups={groups}
        activeMuscle={muscle}
        onMuscle={setMuscle}
        currentIndex={sheetCurrent}
        onSelect={(index) => {
          setViewingIndex(index);
          setShowSheet(false);
        }}
        onClose={() => setShowSheet(false)}
      />
      {exercise ? (
        <HowToSheet
          open={showHowTo}
          sessionExercise={exercise}
          entry={howToEntry}
          onRetry={() => howTo.fetchEntry(exercise.exercise?.id, true)}
          onClose={() => setShowHowTo(false)}
        />
      ) : null}
      <DiscardDialog open={showDiscard} onKeep={() => setShowDiscard(false)} onDiscard={handleAbandon} />
      <FinishEarlyDialog
        open={finishEarly.open}
        message={finishEarly.message}
        onKeep={closeFinishEarly}
        onFinish={() => {
          closeFinishEarly();
          return handleComplete();
        }}
      />
      <ExactAlarmDialog open={restAlerts.offerOpen} onNotNow={restAlerts.closeOffer} onOpenSettings={restAlerts.openSettings} />
      <SpeakIntroDialog
        open={restAlerts.introOpen}
        onKeepOn={restAlerts.keepSpeaking}
        onTurnOff={restAlerts.turnOffSpeaking}
        onOpenAnnounceSettings={restAlerts.openAnnounceSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  header: {
    paddingHorizontal: spacing[5],
  },
  column: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  columnPhone: {
    maxWidth: COLUMN_MAX_WIDTH,
  },
  fitHidden: {
    opacity: 0,
  },
  chromeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  chromeInFlow: {
    paddingBottom: spacing[3],
  },
  messages: {
    gap: spacing[3],
  },
  main: {
    gap: spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  mainBrowsing: {
    gap: spacing['2_5'],
    paddingTop: spacing[3],
  },
  mainTablet: {
    gap: spacing[4],
    paddingHorizontal: spacing[8],
  },
  endActions: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  // T-132 (web 2.1.15 phone): the page column (mt 16, 12 apart), Discard's
  // extra 12, and the browsing bar / stats placed around the photo.
  // T-155: card → 12 → Up next → 12 → Discard (rev 42 compact: 8 / 4; the fit sets them).
  mainPhone: {
    gap: spacing[3],
  },
  discardPhone: {
    paddingTop: spacing[3],
  },
  phoneBrowsingBar: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  // Spec §4: 16/24 500 muted, tabular, centred.
  statsLine: {
    ...font(500),
    fontSize: 16,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    color: colors.textMuted,
  },
  // T-132 (web 2.1.15 SC:108, Q1): the header bar: the ground-bar fill
  // (0.88; it sits over the page ground, above the scroll, so it reads solid)
  // and a 1 px white-7% hairline at the bottom, under the rail.
  headerBar: {
    backgroundColor: colors.groundBar,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  splitStage: {
    flex: 1,
  },
  logger: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  loggerContent: {
    gap: spacing[4],
  },
  dockTablet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[6],
    backgroundColor: colors.ground,
  },
});
