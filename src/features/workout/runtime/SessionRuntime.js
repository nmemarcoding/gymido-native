import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getServerMessage, getStatus } from '../../../shared/api/apiError';
import { formatNumber, formatWeight } from '../../../shared/format/numbers';
import { formatDuration } from '../../../shared/time/format';
import { InlineToast } from '../../../shared/components/ToastHost';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { ToastTone } from '../../../shared/components/toastStore';
import { breakpoints, colors, shadows } from '../../../shared/theme/tokens';
import { abandonWorkout, completeWorkout, updateSessionSet } from '../api/workoutApi';
import { ExerciseSheet, WorkoutExerciseNav } from './ExerciseNavigation';
import {
  BrowsingBar,
  ExerciseStage,
  ReloadErrorBar,
  SessionChrome,
  SetRow,
  StaleSessionBanner,
  StatTile,
  UpNextCard,
} from './RuntimeParts';
import { CompleteWorkoutButton, DiscardButton, DiscardDialog, ExactAlarmDialog, RestTimerWidget, SpeakIntroDialog } from './RuntimeOverlays';
import restAlertPlatform from './restAlertPlatform';
import {
  buildSetPatch,
  centeredScrollOffset,
  completionSnapshot,
  createPendingSets,
  draftFromSavedSet,
  firstPendingSetKey,
  muscleGroups,
  nextSetKeyAfter,
  orderedSets,
  propagateDraft,
  restSecondsFor,
  seedDrafts,
  sessionProgress,
  sessionViewState,
  setKey,
  staleSessionTitle,
  validateDraftWeight,
} from './sessionMath';
import useElapsedTimer from './useElapsedTimer';
import useRestAlerts from './useRestAlerts';
import useRestTimer from './useRestTimer';

const COLUMN_MAX_WIDTH = 430;

// The session runtime (RN-SPEC-workout Part B). `session` is already the
// O12-overlaid view; every derived value reads it. The chrome and the bottom
// nav sit outside the scroll (§19.0).
// RN-SPEC-workout O9 dated change (25 Oct 2026, T-37): a 409 from the set
// toggle or Complete means the session was already ended on another device.
export const ENDED_ELSEWHERE = 'This workout was already ended on another device. Start a new one when you’re ready.';

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
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const isFocused = useIsFocused();
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const rowRefs = useRef({});
  // §22.3: the viewport and content heights are read when the key changes,
  // never as effect deps (a keyboard resize must not re-centre the row).
  const visibleHeight = useRef(0);
  const contentHeight = useRef(0);
  const [navHeight, setNavHeight] = useState(96);
  const [drafts, setDrafts] = useState({});
  const [validation, setValidation] = useState({});
  const pendingSets = useRef(null);
  if (pendingSets.current === null) {
    pendingSets.current = createPendingSets();
  }
  const [pendingSetIds, setPendingSetIds] = useState(() => new Set());
  const [highlightedSetKey, setHighlightedSetKey] = useState('');
  const [viewingIndex, setViewingIndex] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [muscle, setMuscle] = useState('all');
  const [showDiscard, setShowDiscard] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const elapsed = useElapsedTimer(session.started_at);
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

  // §20.2: seed drafts on every load, never overwriting existing ones.
  useEffect(() => {
    setDrafts((current) => seedDrafts(session, exerciseStatsMap, current));
  }, [session, exerciseStatsMap]);

  // §26 auto-advance: follow the active exercise whenever it changes.
  useEffect(() => {
    if (progress.activeExerciseIndex >= 0) {
      setViewingIndex(progress.activeExerciseIndex);
    }
  }, [progress.activeExerciseIndex]);

  // §26.1: the sheet and the discard dialog are dismissed on blur.
  useEffect(() => {
    if (!isFocused) {
      setShowSheet(false);
      setShowDiscard(false);
    }
  }, [isFocused]);

  // §22.3: fires only when the key changes to a non-empty value, and only if
  // its row is mounted; centred and clamped to the content (ported from the
  // 28 Sep build).
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
    const body = buildSetPatch(set, draft);
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
    const snapshot = completionSnapshot(session, planName, elapsed);
    setActionError('');
    setIsCompleting(true);
    rest.clear();
    setHighlightedSetKey('');
    try {
      await completeWorkout(session.id);
      setSuccessMessage('Workout completed.');
      onCompleted(snapshot);
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

  const viewing = Math.min(Math.max(viewingIndex ?? 0, 0), Math.max(exercises.length - 1, 0));
  const exercise = exercises[viewing];
  const activeIndex = progress.activeExerciseIndex;
  const { currentIndex: sheetCurrent, isActiveView, laterIncomplete, isLastIncomplete } = sessionViewState(exercises, viewing, activeIndex);
  const firstPendingKey = firstPendingSetKey(exercise);
  // The column is capped at 430 (§19.6), so its breakpoints follow the
  // column's width, not the window's.
  const columnWidth = Math.min(width - insets.left - insets.right, COLUMN_MAX_WIDTH);
  const wide = columnWidth >= breakpoints.sm;
  const gutter = wide ? 20 : 16;
  // §17 / web parity: a button press takes focus off the weight input.
  const dismiss = (handler) => (...args) => {
    Keyboard.dismiss();
    return handler(...args);
  };

  return (
    // §19.6 (tablet layout deferred): at every width the runtime uses the phone
    // layout, so header, chrome and scroll sit in the shell's centred phone
    // column (min(window, 430), app-shell §"phone"), with the side insets for
    // landscape tablets (app-shell [O2]). The nav's inner is capped at 460
    // (§19.8). (ported from the 28 Sep build)
    // QA F1, iOS: a live text-size change leaves unchanged texts with their
    // old measurements (see ShellPage), and the timer re-renders every second.
    // The frame remounts on a new text scale; the session state (sets, rest,
    // dialogs) lives in this component's hooks and is kept.
    <View
      key={`text-scale-${fontScale}`}
      style={[styles.frame, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}
    >
      <View testID="session-column" style={styles.column}>
        {header ? <View style={{ paddingHorizontal: gutter }}>{header}</View> : null}
        <SessionChrome
          planName={planName || 'Workout'}
          completedSets={progress.completedSets}
          totalSets={progress.totalSets}
          exerciseCount={exercises.length}
          onExit={dismiss(() => setShowDiscard(true))}
          onAll={dismiss(() => setShowSheet(true))}
        />
        <ScrollView
          ref={scrollRef}
          onLayout={(event) => {
            visibleHeight.current = event.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_w, h) => {
            contentHeight.current = h;
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          // §19 / §19.0: web's fixed margin-bottom 144 below the content, plus
          // the safe area the pinned nav adds, so the last row and its error
          // always scroll clear of the nav. On Android an open keyboard adds
          // its height, so the last set's weight input can scroll above it.
          contentContainerStyle={{
            paddingBottom: Math.max(144 + insets.bottom, navHeight + 20) + (Platform.OS === 'android' ? keyboardHeight : 0),
          }}
        >
          <View ref={contentRef} collapsable={false} style={styles.content}>
            <View style={[styles.messages, { paddingHorizontal: gutter }]}>
              {staleTitle ? <StaleSessionBanner title={staleTitle} /> : null}
              {reloadError ? <ReloadErrorBar retrying={retrying} onRetry={onRetry} /> : null}
              {successMessage ? <InlineToast testID="workout-saved-toast" tone={ToastTone.success} title="Saved" message={successMessage} /> : null}
              {actionError ? <InlineToast testID="workout-action-error" tone={ToastTone.error} title="Workout error" message={actionError} /> : null}
            </View>
            <View style={[styles.stats, { paddingHorizontal: gutter, gap: wide ? 16 : 12, paddingVertical: wide ? 20 : 16 }]}>
              <StatTile label="Time" value={formatDuration(elapsed)} />
              <StatTile label="Volume" value={formatWeight(progress.liveVolume, 'lb', 0)} />
              <StatTile label="Reps" value={formatNumber(progress.actualReps, 0)} />
            </View>
            <View style={[styles.main, { paddingHorizontal: gutter }]}>
              {!isActiveView && activeIndex >= 0 ? <BrowsingBar onResume={dismiss(() => setViewingIndex(activeIndex))} /> : null}
              {exercise ? (
                <ExerciseStage exercise={exercise} index={viewing} count={exercises.length} isActive={isActiveView}>
                  {(exercise.sets ?? []).map((set) => {
                    const key = setKey(exercise.id, set.id);
                    const completed = Boolean(set.is_completed);
                    const isNext = key === firstPendingKey;
                    const isLocked = !completed && (Boolean(rest.timer) || !isNext);
                    return (
                      <View key={set.id} ref={(node) => (rowRefs.current[key] = node)} collapsable={false}>
                        <SetRow
                          set={set}
                          draft={drafts[set.id]}
                          isNext={isNext}
                          isLocked={isLocked}
                          lockReason={rest.timer && isNext ? 'Rest timer running — wait or skip it first' : 'Finish the previous set first'}
                          isPending={pendingSetIds.has(set.id)}
                          highlighted={highlightedSetKey === key}
                          validationError={validation[set.id]}
                          onWeightChange={(value) => changeDraft(exercise, set, 'actualWeightValue', value)}
                          onUnitChange={(value) => changeDraft(exercise, set, 'actualWeightUnit', value)}
                          onToggle={dismiss(() => toggleSet(exercise, set))}
                        />
                      </View>
                    );
                  })}
                </ExerciseStage>
              ) : null}
              {isActiveView && laterIncomplete !== -1 ? (
                <UpNextCard
                  exercise={exercises[laterIncomplete]}
                  setsLeft={(exercises[laterIncomplete].sets ?? []).filter((set) => !set.is_completed).length}
                  onPress={dismiss(() => setViewingIndex(laterIncomplete))}
                />
              ) : null}
              {isLastIncomplete ? (
                <View style={styles.lastNote}>
                  <Text style={styles.lastNoteText}>Last exercise — finish strong</Text>
                </View>
              ) : null}
              <CompleteWorkoutButton completing={isCompleting} onPress={dismiss(handleComplete)} />
              <DiscardButton abandoning={isAbandoning} onPress={dismiss(() => setShowDiscard(true))} />
            </View>
          </View>
        </ScrollView>
      </View>
      <WorkoutExerciseNav
        exercises={exercises}
        viewingIndex={viewing}
        onView={dismiss(setViewingIndex)}
        onOpenSheet={dismiss(() => setShowSheet(true))}
        onHeight={setNavHeight}
      />
      <RestTimerWidget
        timer={rest.timer}
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
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: COLUMN_MAX_WIDTH,
    alignSelf: 'center',
  },
  content: {
    paddingTop: 16,
  },
  messages: {
    gap: 20,
  },
  stats: {
    flexDirection: 'row',
  },
  main: {
    gap: 16,
  },
  lastNote: {
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: shadows.emboss,
  },
  lastNoteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.brand700,
  },
});
