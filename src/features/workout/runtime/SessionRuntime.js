import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { formatNumber, formatWeight } from '../../../shared/format/numbers';
import { formatDuration } from '../../../shared/time/format';
import { InlineToast } from '../../../shared/components/ToastHost';
import { useLargeTextReflow } from '../../../shared/components/largeText';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { ToastTone } from '../../../shared/components/toastStore';
import { breakpoints, colors, spacing } from '../../../shared/theme/tokens';
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
  SessionRail,
  SessionStats,
  SetEditor,
  StaleSessionBanner,
  UpNextLink,
} from './RuntimeParts';
import { CompleteWorkoutButton, DiscardDialog, ExactAlarmDialog, RestTimerWidget, SpeakIntroDialog } from './RuntimeOverlays';
import { restNextPreview } from './restPresentation';
import restAlertPlatform from './restAlertPlatform';
import {
  buildSetPatch,
  centeredScrollOffset,
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
  validateDraftWeight,
  volumeInUnit,
} from './sessionMath';
import useElapsedTimer from './useElapsedTimer';
import useRestAlerts from './useRestAlerts';
import useRestTimer from './useRestTimer';
import { keepUnitsTogether } from '../../../shared/format/counts';

// The phone column (app-shell §"phone", §19.6); tablets use the window.
const COLUMN_MAX_WIDTH = 430;
// F1 tablet landscape: the logger column is clamp(320, 38vw, 480).
const TABLET_LOGGER_MIN = 320;
const TABLET_LOGGER_MAX = 480;
// Tablet: Workout dock, 40 above the bottom (+ inset).
const TABLET_DOCK_BOTTOM = 40;
const LOCK_REST = 'Rest timer running — wait or skip it first';

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
  const [drafts, setDrafts] = useState({});
  const [repsDrafts, setRepsDrafts] = useState({});
  const [validation, setValidation] = useState({});
  const pendingSets = useRef(null);
  if (pendingSets.current === null) {
    pendingSets.current = createPendingSets();
  }
  const [pendingSetIds, setPendingSetIds] = useState(() => new Set());
  const [highlightedSetKey, setHighlightedSetKey] = useState('');
  const [viewingIndex, setViewingIndex] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [muscle, setMuscle] = useState('all');
  const [showDiscard, setShowDiscard] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const elapsed = useElapsedTimer(session.started_at);
  const howTo = useHowToLibrary(loadHowTo ? { load: loadHowTo } : undefined);
  // Edge-to-edge Android isn't resized for the keyboard (iOS uses
  // automaticallyAdjustKeyboardInsets below).
  const keyboardHeight = useKeyboardHeight();

  // Rest-done sound and alerts (time §7.2, O4, A1, A2, A3). The spoken copy
  // is the short form once no set is left besides the one just done.
  const restAlerts = useRestAlerts(restAlertPlatform, (setId) =>
    (session.exercises ?? []).some((exercise) => (exercise.sets ?? []).some((set) => !set.is_completed && set.id !== setId))
  );
  const rest = useRestTimer({ onRestComplete: setHighlightedSetKey, alerts: restAlerts.alerts });

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
  }, [session, exerciseStatsMap]);

  // §26 auto-advance: follow the active exercise whenever it changes.
  useEffect(() => {
    if (progress.activeExerciseIndex >= 0) {
      setViewingIndex(progress.activeExerciseIndex);
    }
  }, [progress.activeExerciseIndex]);

  // §26.1: the sheets and the discard dialog are dismissed on blur.
  useEffect(() => {
    if (!isFocused) {
      setShowSheet(false);
      setShowDiscard(false);
      setShowHowTo(false);
    }
  }, [isFocused]);

  // §22.3: fires only when the key changes to a non-empty value, and only if
  // its card is mounted; centred and clamped to the content.
  useEffect(() => {
    if (!highlightedSetKey) {
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

  async function toggleSet(exercise, set) {
    setHighlightedSetKey('');
    const draft = drafts[set.id];
    if (!set.is_completed) {
      const error = validateDraftWeight(draft?.actualWeightValue);
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
      const result = await updateSessionSet(session.id, exercise.id, set.id, body);
      const saved = body.is_completed ? result?.workout_session_exercise_set : null;
      if (saved) {
        const sentUnit = body.actual_weight_unit || draft?.actualWeightUnit || 'lb';
        setDrafts((current) => ({ ...current, [set.id]: draftFromSavedSet(saved, sentUnit) }));
      }
      // O12 §3: the rest starts before anything else, then the overlay, then the reload.
      if (body.is_completed) {
        const seconds = restSecondsFor(set);
        const nextKey = nextSetKeyAfter(ordered, set.id);
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

  // T-37: clear the rest and the highlight, show the message, go to the top
  // and reload with the loader. No session any more → the hub, whose
  // "Workout error" toast shows the same message. No completion summary.
  function endedElsewhere() {
    rest.clear();
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
      const result = await completeWorkout(session.id);
      setSuccessMessage('Workout completed.');
      // #15 (3c's PB card) and the photos it can show; volumeUnit per the
      // VOLUME RULE is already in the snapshot.
      onCompleted({ ...snapshot, personalRecords: result?.new_personal_records, exerciseImages: exerciseImageMap(session) });
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
      await reload();
    } catch (error) {
      setActionError(getServerMessage(error));
    } finally {
      setIsAbandoning(false);
    }
  }

  completeRef.current = handleComplete;

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
  const chromeOverlay = !stacked;
  // Batch 2 item 3: the per-exercise segments only live, with 2+ exercises
  // (the gold session rail is in SessionChrome, always).
  const showSegments = !browsing && exercises.length > 1;
  const chromeTop = (header ? spacing[3] : insets.top + spacing['2_5']) + (tablet ? spacing[3] : 0);
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
      allRef={allRef}
      tablet={tablet}
      onLayout={chromeOverlay ? (event) => setChromeHeight(event.nativeEvent.layout.height) : undefined}
      style={chromeOverlay ? [styles.chromeOverlay, { top: chromeTop }] : [styles.chromeInFlow, { paddingTop: chromeTop }]}
    />
  );
  const stageTop = chromeOverlay ? chromeTop + chromeHeight + spacing[3] : 0;
  const howToEntry = exercise?.exercise?.id ? howTo.entries[exercise.exercise.id] : null;
  const howToButton =
    exercise?.exercise?.id && showHowToPill(howToEntry, exercise) ? (
      <HowToButton
        tablet={tablet}
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
    />
  ) : null;

  const editorKey = editorSet ? setKey(exercise.id, editorSet.id) : '';
  const setCard = exercise ? (
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
    />
  ) : null;

  const endActions = (
    <View style={styles.endActions}>
      {isActiveView && isLastIncomplete ? <LastExerciseNote /> : null}
      {/* ND4: primary when no live set is left, else glass (3c's button). */}
      <CompleteWorkoutButton primary={!liveSetLeft} completing={isCompleting} onPress={dismiss(handleComplete)} />
      <DiscardWorkoutAction abandoning={isAbandoning} onPress={dismiss(() => setShowDiscard(true))} />
    </View>
  );

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
      chrome={chromeOverlay || (tablet && !browsing) ? null : chrome}
      completedSets={progress.completedSets}
      totalSets={progress.totalSets}
      howTo={howToButton}
      segments={tablet && showSegments ? <ExerciseSegments exercises={exercises} viewingIndex={viewing} tablet /> : null}
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
  const showDock = !browsing && (Boolean(didIt) || Boolean(upNext));
  // P3-2: the dock is an opaque band down to the screen bottom; its measured
  // height already holds the safe area, so the room is that height + a gap.
  const dockHeight = measuredDock ?? DID_IT_HEIGHT + 32 + spacing[3] + (tablet ? TABLET_DOCK_BOTTOM : spacing[7]) + insets.bottom;
  const bottomRoom = browsing ? navHeight + spacing[5] + insets.bottom : showDock ? dockHeight + spacing[4] : spacing[6] + insets.bottom;

  // M6: the expanded Rest is modal for TalkBack too (accessibilityViewIsModal
  // is iOS-only): hide what is behind it while it is open.
  const restExpanded = Boolean(rest.timer) && !rest.minimized;
  const behindRest = {
    importantForAccessibility: restExpanded ? 'no-hide-descendants' : 'auto',
    accessibilityElementsHidden: restExpanded,
  };

  let body;
  if (tablet && !browsing) {
    // Tablet: Workout. Stage column | logger column; the dock sits under the
    // logger column (its inner width).
    const loggerWidth = tabletLoggerWidth(contentWidth);
    body = (
      <View style={styles.splitRow}>
        <View style={styles.splitStage}>{stage}</View>
        <View style={[styles.logger, { width: loggerWidth }]}>
          <ScrollView
            {...scrollProps}
            contentContainerStyle={{ paddingTop: chromeOverlay ? stageTop : spacing[4], paddingBottom: bottomRoom + androidKeyboard, paddingHorizontal: spacing[6] }}
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
      <ScrollView {...scrollProps} contentContainerStyle={{ paddingBottom: bottomRoom + androidKeyboard }}>
        <View ref={contentRef} collapsable={false}>
          {stage}
          {showSegments ? <ExerciseSegments exercises={exercises} viewingIndex={viewing} /> : null}
          <View style={[styles.main, tablet && styles.mainTablet, browsing && styles.mainBrowsing]}>
            {browsing ? <BrowsingBar tablet={tablet} onResume={dismiss(() => setViewingIndex(activeIndex))} /> : null}
            {browsing ? stats : null}
            {messages}
            {setCard}
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
      <View testID="session-column" {...behindRest} style={[styles.column, !tablet && styles.columnPhone]}>
        {tablet && !browsing && !chromeOverlay ? chrome : null}
        {body}
        {chromeOverlay ? chrome : null}
        {showDock && !tablet ? (
          <View testID="session-dock" onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)} style={[styles.dock, { paddingBottom: spacing[7] + insets.bottom }]}>
            {didIt}
            {upNext ? <UpNextLink exercise={upNext} onPress={dismiss(() => setViewingIndex(laterIncomplete))} /> : null}
          </View>
        ) : null}
        {browsing ? (
          <WorkoutExerciseNav
            exercises={exercises}
            viewingIndex={viewing}
            onView={dismiss(setViewingIndex)}
            onOpenSheet={openSheet}
            onHeight={setNavHeight}
            tablet={tablet}
          />
        ) : null}
      </View>
      <RestTimerWidget
        timer={rest.timer}
        next={restNextPreview(session, rest.timer?.nextSetKey, drafts)}
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
  // UX verdict P3-2: OPAQUE (the ground token), edge to edge and down to the
  // screen bottom, so nothing scrolls behind or shows through it.
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.ground,
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
