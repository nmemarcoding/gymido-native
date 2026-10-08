import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii } from '../../../shared/theme/tokens';
import { formatDuration, formatNumber, formatWeight } from '../../../shared/time/formatters';
import { claimExactAlarmOffer, openExactAlarmSettings } from '../../../shared/time/exactAlarmOffer';
import { ensureRestNotificationPermission } from '../../../shared/time/restAlerts';
import { ColorPressable } from '../../plans/components/PlanBits';
import { PressedGradient, PRESS_SHADOW, SHADOW_BRAND } from '../components/hubChrome';
import ExerciseStage, { SetRow } from './ExerciseStage';
import ExerciseSheet from './ExerciseSheet';
import { CompletionPopup, DiscardDialog, ExactAlarmOfferDialog } from './Overlays';
import SessionShell from './SessionShell';
import {
  BrowsingBar,
  LastExerciseNote,
  ReloadErrorBar,
  SessionChrome,
  StaleSessionBanner,
  StatTile,
  UpNextCard,
} from './SessionParts';
import {
  elapsedSecondsSince,
  isStaleSession,
  nextSetKeyAfter,
  orderedSets,
  propagateDraft,
  seedDrafts,
  sessionProgress,
  SET_KEY,
  validateWeight,
} from './runtimeRules';
import { NavSegmentBar, isSwipeUpToSheet } from './NavSegment';
import { useRestTimer } from './useRestTimer';

const LOCK_REST = 'Rest timer running — wait or skip it first';
const LOCK_ORDER = 'Finish the previous set first';

// Session runtime (RN-SPEC-workout Part B). Rendered in place of the hub when
// session?.id exists — same screen, same route (§18).
// §26: this state lives on the PAGE, not in the runtime subtree, because every
// mutation reloads the page (status flips to 'loading') and would otherwise
// destroy the rest timer and the typed drafts.
export function useSessionRuntime({
  session,
  currentPlan,
  exerciseStatsMap,
  onToggleSet,
  onConfirmWrite,
  onComplete,
  onAbandon,
  isCompleting,
}) {
  const [drafts, setDrafts] = useState(() => seedDrafts(session, exerciseStatsMap, {}));
  const [validationErrors, setValidationErrors] = useState({});
  const [highlightedSetKey, setHighlightedSetKey] = useState('');
  const [viewingExerciseIndex, setViewingExerciseIndex] = useState(0);
  const [showAllSheet, setShowAllSheet] = useState(false);
  const [allSheetMuscle, setAllSheetMuscle] = useState('all');
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  // A2: the one-time exact-alarm offer (Android). Already recorded as offered.
  const [showExactAlarmOffer, setShowExactAlarmOffer] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => elapsedSecondsSince(session?.started_at));

  // §26.1 blur table: the runtime itself now survives a tab switch (invariant
  // D), so the transient overlays have to be closed explicitly — otherwise the
  // exercise sheet or the discard dialog would still be open on return. Empty
  // deps so this only ever fires on a real blur or unmount.
  useFocusEffect(
    useCallback(
      () => () => {
        setShowAllSheet(false);
        setShowAbandonConfirm(false);
        setShowExactAlarmOffer(false);
      },
      []
    )
  );

  const onRestComplete = useCallback((nextSetKey) => setHighlightedSetKey(nextSetKey), []);
  const {
    restTimer,
    minimized,
    setMinimized,
    startRestTimer,
    clearRestTimer,
    adjustRestTimer,
    skipRestTimer,
    timerPosition,
    setTimerPosition,
  } = useRestTimer({ onRestComplete, sessionId: session?.id });

  // §20.2: drafts are re-seeded on every reload, never overwriting typed values.
  useEffect(() => {
    setDrafts((current) => seedDrafts(session, exerciseStatsMap, current));
  }, [session, exerciseStatsMap]);

  // The live "Time" tile counts from started_at on the device clock.
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(elapsedSecondsSince(session?.started_at)), 1000);
    return () => clearInterval(interval);
  }, [session?.started_at]);

  const progress = useMemo(() => sessionProgress(session), [session]);
  const exercises = session?.exercises || [];
  const activeExerciseIndex = progress.activeExerciseIndex;

  // §26 auto-advance.
  useEffect(() => {
    if (activeExerciseIndex >= 0) {
      setViewingExerciseIndex(activeExerciseIndex);
    }
  }, [activeExerciseIndex]);

  // §23.1: completing the last set auto-completes the workout (⚠W13).
  useEffect(() => {
    if (progress.totalSets > 0 && progress.completedSets === progress.totalSets && !isCompleting) {
      clearRestTimer();
      setHighlightedSetKey('');
      onComplete({ elapsedSeconds });
    }
    // The guard is isCompleting; elapsedSeconds must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.totalSets, progress.completedSets, isCompleting]);

  const nextSetKey = useMemo(() => nextSetKeyAfter(session), [session]);
  const viewing = exercises[Math.min(viewingExerciseIndex, Math.max(exercises.length - 1, 0))];
  const isViewingActive = activeExerciseIndex === -1 || viewingExerciseIndex === activeExerciseIndex;

  const upNext = useMemo(() => {
    if (!isViewingActive) {
      return null;
    }
    const later = exercises.slice(viewingExerciseIndex + 1).find((item) => (item.sets || []).some((set) => !set.is_completed));
    if (!later) {
      return null;
    }
    return { exercise: later, setsLeft: (later.sets || []).filter((set) => !set.is_completed).length };
  }, [exercises, viewingExerciseIndex, isViewingActive]);

  const isLastIncomplete =
    activeExerciseIndex >= 0 && viewingExerciseIndex === activeExerciseIndex && !upNext;

  const handleDraftChange = (exercise, setId, patch) => {
    setDrafts((current) => propagateDraft(current, exercise, setId, patch));
    setValidationErrors((current) => {
      if (!current[setId]) {
        return current;
      }
      const next = { ...current };
      delete next[setId];
      return next;
    });
  };

  const handleToggle = async (exercise, set) => {
    // §22.3: every toggle clears the key first, so un-doing a set never scrolls
    // and a repeat of the same key still fires the effect.
    setHighlightedSetKey('');
    const draft = drafts[set.id];
    if (!set.is_completed) {
      const message = validateWeight(draft?.actualWeightValue);
      if (message) {
        setValidationErrors((current) => ({ ...current, [set.id]: message }));
        return;
      }
    }
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[set.id];
      return next;
    });

    const completing = !set.is_completed;
    const restSeconds = Number(set.rest_seconds_planned || set.rest_seconds_actual || 0);
    // [O12 §3] The order is load-bearing and matches the web:
    //   await PATCH → start the rest timer → write the overlay → start the reload
    // The timer must never wait on the reload. `session` here is already the
    // overlaid one (O12 §4), so `set.is_completed` — and therefore the un-do
    // direction and the next set — reflect saves the reload hasn't caught up to.
    const payload = await onToggleSet({ exercise, set, draft });
    if (!payload) {
      // The save itself failed: nothing advances and nothing is recorded.
      return;
    }
    if (!completing) {
      // Un-completing clears the timer.
      clearRestTimer();
    } else if (restSeconds > 0) {
      startRestTimer({ setId: set.id, restSeconds, nextSetKey: nextSetKeyAfter(session, set.id) });
      // Permission is requested at exactly this moment (RN-SPEC-time §7.2). A2's
      // offer follows the timer's start and nothing waits on it; it never
      // follows the OS dialog back to back.
      ensureRestNotificationPermission()
        .then(claimExactAlarmOffer)
        .then((offer) => {
          if (offer) {
            setShowExactAlarmOffer(true);
          }
        });
    } else {
      clearRestTimer();
      setHighlightedSetKey(nextSetKeyAfter(session, set.id));
    }
    // Un-doing replaces the entry with is_completed: false rather than deleting
    // it, so the row doesn't snap back to its stale server value (O12 §4).
    onConfirmWrite?.(set.id, payload);
  };

  const confirmDiscard = () => {
    setShowAbandonConfirm(false);
    clearRestTimer();
    setHighlightedSetKey('');
    onAbandon();
  };


  return {
    drafts,
    validationErrors,
    highlightedSetKey,
    viewingExerciseIndex,
    setViewingExerciseIndex,
    showAllSheet,
    setShowAllSheet,
    allSheetMuscle,
    setAllSheetMuscle,
    showAbandonConfirm,
    setShowAbandonConfirm,
    showExactAlarmOffer,
    setShowExactAlarmOffer,
    elapsedSeconds,
    progress,
    exercises,
    activeExerciseIndex,
    nextSetKey,
    viewing,
    isViewingActive,
    upNext,
    isLastIncomplete,
    handleDraftChange,
    handleToggle,
    confirmDiscard,
    restTimer,
    minimized,
    setMinimized,
    adjustRestTimer,
    skipRestTimer,
    timerPosition,
    setTimerPosition,
  };
}

// Presentational runtime: all state comes from useSessionRuntime (§26).
export default function SessionRuntime({
  session,
  currentPlan,
  runtime,
  isCompleting,
  isAbandoning,
  pendingSetId,
  banner,
  overlay,
  reloadError,
  isRetrying,
  onRetryReload,
  onComplete,
}) {
  const {
    drafts,
    validationErrors,
    highlightedSetKey,
    viewingExerciseIndex,
    setViewingExerciseIndex,
    showAllSheet,
    setShowAllSheet,
    allSheetMuscle,
    setAllSheetMuscle,
    showAbandonConfirm,
    setShowAbandonConfirm,
    showExactAlarmOffer,
    setShowExactAlarmOffer,
    elapsedSeconds,
    progress,
    exercises,
    activeExerciseIndex,
    nextSetKey,
    viewing,
    isViewingActive,
    upNext,
    isLastIncomplete,
    handleDraftChange,
    handleToggle,
    confirmDiscard,
    // Only the set lock needs the timer here; the widget itself renders in the
    // shell overlay so it stays fixed to the window (§22.1).
    restTimer,
  } = runtime;

  const planName = currentPlan?.enrollment?.plan?.name || 'Workout';

  // §19.0: the header and the exercise nav are siblings of the scroll, not part
  // of it, so neither moves while the set list scrolls behind them.
  return (
    <SessionShell
      overlay={overlay}
      scrollToKey={highlightedSetKey}
      header={
        <SessionChrome
          planName={planName}
          completedSets={progress.completedSets}
          totalSets={progress.totalSets}
          exerciseCount={exercises.length}
          onExit={() => setShowAbandonConfirm(true)}
          onShowAll={() => setShowAllSheet(true)}
        />
      }
      nav={
        <ExerciseNav
          exercises={exercises}
          viewingExerciseIndex={viewingExerciseIndex}
          activeExerciseIndex={activeExerciseIndex}
          onView={setViewingExerciseIndex}
          onShowAll={() => setShowAllSheet(true)}
        />
      }
    >
      <View style={styles.root}>
      {banner}
      {/* [O8] first child of the runtime's scroll content. */}
      {isStaleSession(session) ? <StaleSessionBanner startedAt={session.started_at} /> : null}
      {/* [O12 §2] below the O8 banner, above the live stats. */}
      {reloadError ? <ReloadErrorBar isRetrying={isRetrying} onRetry={onRetryReload} /> : null}

      <View style={styles.statRow}>
        <StatTile label="Time" value={formatDuration(elapsedSeconds)} />
        {/* ⚠W15: unit-blind, always lb. */}
        <StatTile label="Volume" value={formatWeight(progress.liveVolume, 'lb', 0)} />
        <StatTile label="Reps" value={formatNumber(progress.actualReps, 0)} />
      </View>

      <View style={styles.main}>
        {!isViewingActive && activeExerciseIndex >= 0 ? (
          <BrowsingBar onResume={() => setViewingExerciseIndex(activeExerciseIndex)} />
        ) : null}

        {viewing ? (
          <ExerciseStage
            exercise={viewing}
            index={viewingExerciseIndex}
            total={exercises.length}
            isActiveExercise={isViewingActive}
          >
            {(viewing.sets || []).map((set) => {
              const key = SET_KEY(viewing.id, set.id);
              const isNext = key === nextSetKey;
              // ⚠W20: while rest runs every pending set is locked.
              const locked = !set.is_completed && (Boolean(restTimer) || !isNext);
              return (
                <SetRow
                  key={set.id}
                  set={set}
                  exerciseId={viewing.id}
                  draft={drafts[set.id]}
                  isNext={isNext}
                  isHighlighted={highlightedSetKey === key}
                  isPending={pendingSetId === set.id}
                  isLocked={locked}
                  lockReason={restTimer ? LOCK_REST : LOCK_ORDER}
                  validationError={validationErrors[set.id]}
                  onChangeDraft={(patch) => handleDraftChange(viewing, set.id, patch)}
                  onToggle={() => handleToggle(viewing, set)}
                />
              );
            })}
          </ExerciseStage>
        ) : null}

        {upNext ? (
          <UpNextCard
            exercise={upNext.exercise}
            setsLeft={upNext.setsLeft}
            onPress={() => setViewingExerciseIndex(exercises.indexOf(upNext.exercise))}
          />
        ) : null}

        {isLastIncomplete ? <LastExerciseNote /> : null}

        <View style={isCompleting && styles.disabled}>
          <ColorPressable
            testID="complete-workout"
            accessibilityRole="button"
            accessibilityState={{ disabled: isCompleting, busy: isCompleting }}
            disabled={isCompleting}
            onPress={() => onComplete({ elapsedSeconds })}
            colorsFor={() => ({})}
            style={({ pressed }) => [styles.complete, pressed && !isCompleting && styles.sunk]}
          >
            {(pressed) => (
              <>
                <PressedGradient pressed={pressed && !isCompleting} radius={24} />
                <Text style={styles.completeLabel}>COMPLETE WORKOUT</Text>
              </>
            )}
          </ColorPressable>
        </View>

        <Pressable
          testID="discard-workout"
          accessibilityRole="button"
          onPress={() => setShowAbandonConfirm(true)}
          style={styles.discard}
        >
          <Text style={styles.discardLabel}>{isAbandoning ? 'Exiting…' : 'Discard workout'}</Text>
        </Pressable>
      </View>

      <ExerciseSheet
        visible={showAllSheet}
        session={session}
        muscle={allSheetMuscle}
        // §19.7: the gold highlight follows the ACTIVE exercise, not the browsed one.
        activeIndex={activeExerciseIndex}
        onChangeMuscle={setAllSheetMuscle}
        onSelect={(index) => {
          setViewingExerciseIndex(index);
          setShowAllSheet(false);
        }}
        onClose={() => setShowAllSheet(false)}
      />

      <DiscardDialog
        visible={showAbandonConfirm}
        onKeepGoing={() => setShowAbandonConfirm(false)}
        onDiscard={confirmDiscard}
      />
      <ExactAlarmOfferDialog
        visible={showExactAlarmOffer}
        onNotNow={() => setShowExactAlarmOffer(false)}
        onOpenSettings={() => {
          setShowExactAlarmOffer(false);
          openExactAlarmSettings();
        }}
      />
      </View>
    </SessionShell>
  );
}

// §19.8 WorkoutExerciseNav. Pinned to the bottom by SessionShell (§19.0); this
// is only its contents.
function ExerciseNav({ exercises, viewingExerciseIndex, activeExerciseIndex, onView, onShowAll }) {
  const insets = useSafeAreaInsets();
  // §19.8: swipe up anywhere on the bar opens the sheet. Only a mostly-vertical
  // upward drag claims the touch, so taps still reach the segments.
  const onShowAllRef = useRef(onShowAll);
  onShowAllRef.current = onShowAll;
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy < -10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_event, gesture) => {
        if (isSwipeUpToSheet(gesture)) {
          onShowAllRef.current();
        }
      },
    })
  ).current;
  return (
    <View
      style={[styles.nav, { paddingBottom: Math.max(12, insets.bottom) }]}
      testID="workout-exercise-nav"
      {...swipe.panHandlers}
    >
      <View style={styles.navHead}>
        <Text style={styles.navCount}>{`Exercise ${Math.min(viewingExerciseIndex + 1, exercises.length)} of ${exercises.length}`}</Text>
        <Pressable accessibilityRole="button" onPress={onShowAll}>
          <Text style={styles.navAll}>{`All (${exercises.length})`}</Text>
        </Pressable>
      </View>
      <View style={styles.segments}>
        {exercises.map((exercise, index) => {
          const sets = exercise.sets || [];
          const ratio = sets.length ? sets.filter((set) => set.is_completed).length / sets.length : 0;
          const done = sets.filter((set) => set.is_completed).length;
          const isViewed = index === viewingExerciseIndex;
          const isActive = index === activeExerciseIndex;
          // Web parity (WorkoutExerciseNav): each segment is a 44-tall button and
          // the bar (NavSegmentBar) sits centred in it; it was a 6-10pt tap target.
          return (
            <Pressable
              key={exercise.id}
              testID={`nav-segment-${exercise.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Exercise ${index + 1}: ${done} of ${sets.length} sets done`}
              accessibilityState={{ selected: isViewed }}
              onPress={() => onView(index)}
              style={styles.segmentButton}
            >
              <NavSegmentBar id={exercise.id} ratio={ratio} isViewed={isViewed} isActive={isActive} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 20,
    paddingTop: 20,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  main: {
    gap: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  complete: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 16,
    // `to bottom`, as the web's bg-linear-to-b, so it sweeps the same way as
    // the PressedGradient layer (§19.10; never a corner keyword).
    experimental_backgroundImage: 'linear-gradient(to bottom, #f7ce4f, #f4b400)',
    boxShadow: SHADOW_BRAND,
  },
  sunk: {
    boxShadow: PRESS_SHADOW,
    transform: [{ translateY: 1 }],
  },
  completeLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0.45,
    color: colors.navy,
  },
  discard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: radii.full,
    paddingVertical: 8,
  },
  discardLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textMuted,
  },
  nav: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,231,235,0.80)',
    backgroundColor: 'rgba(255,255,255,0.80)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  navHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navCount: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.92,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  navAll: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: colors.brand600,
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
});
