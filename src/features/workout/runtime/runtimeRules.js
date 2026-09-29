// Pure rules for the session runtime (RN-SPEC-workout §20, §21, §26), ported
// from the web. ⚠W14/⚠W15/⚠W19 are reproduced on purpose.

export const SET_KEY = (exerciseId, setId) => `${exerciseId}:${setId}`;

// §20.2: seeded per set, never overwritten for a set that already has a draft,
// so typing survives reloads. Weight is the ONLY draft; reps are never drafted.
export function seedDrafts(session, exerciseStatsMap, currentDrafts = {}) {
  const exercises = session?.exercises || [];
  if (!exercises.length) {
    return {};
  }
  const next = { ...currentDrafts };
  exercises.forEach((exercise) => {
    const stats = exerciseStatsMap?.[exercise?.exercise?.id];
    (exercise.sets || []).forEach((set) => {
      next[set.id] = next[set.id] || {
        actualWeightValue: set.actual_weight_value ?? set.target_weight_value ?? stats?.value ?? '',
        actualWeightUnit: set.actual_weight_unit || set.target_weight_unit || stats?.unit || 'lb',
      };
    });
  });
  return next;
}

// §20.3, ⚠W19: editing set i writes the value into set i and EVERY LATER set of
// the same exercise. Earlier sets are untouched.
export function propagateDraft(drafts, exercise, setId, patch) {
  const sets = exercise?.sets || [];
  const index = sets.findIndex((set) => set.id === setId);
  if (index < 0) {
    return drafts;
  }
  const next = { ...drafts };
  sets.slice(index).forEach((set) => {
    next[set.id] = { ...(next[set.id] || { actualWeightValue: '', actualWeightUnit: 'lb' }), ...patch };
  });
  return next;
}

// §21.1: client validation runs on "Did it" only, never on undo.
export function validateWeight(rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return 'Enter a weight before marking this set complete.';
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return 'Weight must be greater than 0.';
  }
  return null;
}

// §20.4. Reps are always the plan's target (max, then min, then 0) — ⚠W14.
// completed_at comes from the DEVICE clock.
export function buildSetPayload(set, draft, now = new Date()) {
  const completing = !set.is_completed;
  const value = Number(draft?.actualWeightValue);
  const weight = Number.isFinite(value) && value > 0 ? value : null;
  return {
    actual_reps: set.actual_reps ?? set.target_reps_max ?? set.target_reps_min ?? 0,
    actual_weight_value: weight,
    actual_weight_unit:
      weight === null ? null : draft?.actualWeightUnit || set.actual_weight_unit || set.target_weight_unit || 'lb',
    rest_seconds_actual: set.rest_seconds_actual ?? set.rest_seconds_planned ?? null,
    is_completed: completing,
    completed_at: completing ? now.toISOString() : null,
  };
}

// §26 orderedSets: every set flattened in order.
export function orderedSets(session) {
  const flat = [];
  (session?.exercises || []).forEach((exercise) => {
    (exercise.sets || []).forEach((set) => {
      flat.push({
        exerciseId: exercise.id,
        setId: set.id,
        key: SET_KEY(exercise.id, set.id),
        isCompleted: Boolean(set.is_completed),
      });
    });
  });
  return flat;
}

export function nextSetKeyAfter(session, excludeSetId = null) {
  const pending = orderedSets(session).find((entry) => !entry.isCompleted && entry.setId !== excludeSetId);
  return pending?.key ?? '';
}

// §26 sessionProgress. liveVolume is unit-blind (⚠W15).
export function sessionProgress(session) {
  const exercises = session?.exercises || [];
  let totalSets = 0;
  let completedSets = 0;
  let targetReps = 0;
  let actualReps = 0;
  let liveVolume = 0;
  let completedExercises = 0;
  let activeExerciseIndex = -1;

  exercises.forEach((exercise, index) => {
    const sets = exercise.sets || [];
    totalSets += sets.length;
    let exerciseDone = sets.length > 0;
    sets.forEach((set) => {
      targetReps += set.target_reps_max || set.target_reps_min || 0;
      if (set.is_completed) {
        completedSets += 1;
        actualReps += set.actual_reps || 0;
        liveVolume += (Number(set.actual_weight_value) || 0) * (Number(set.actual_reps) || 0);
      } else {
        exerciseDone = false;
        if (activeExerciseIndex === -1) {
          activeExerciseIndex = index;
        }
      }
    });
    if (exerciseDone) {
      completedExercises += 1;
    }
  });

  return {
    totalSets,
    completedSets,
    targetReps,
    actualReps,
    liveVolume,
    totalExercises: exercises.length,
    completedExercises,
    activeExerciseIndex,
  };
}

// §23.1: the popup snapshot, taken BEFORE the request (⚠W16 — the duration is
// the device's elapsed time, not the stored value).
export function completionSnapshot({ session, currentPlan, elapsedSeconds }) {
  const progress = sessionProgress(session);
  return {
    planName: currentPlan?.enrollment?.plan?.name || 'Workout',
    durationSeconds: elapsedSeconds,
    totalVolume: progress.liveVolume,
    totalReps: progress.actualReps,
    completedSets: progress.completedSets,
    totalSets: progress.totalSets,
    completedExercises: progress.completedExercises,
    totalExercises: progress.totalExercises,
  };
}

export function elapsedSecondsSince(startedAt, now = Date.now()) {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) {
    return 0;
  }
  return Math.max(0, Math.floor((now - started) / 1000));
}

// [O8]: the session started on a different local calendar day than today.
export function isStaleSession(session, now = new Date()) {
  if (!session?.id || !session.started_at) {
    return false;
  }
  const started = new Date(session.started_at);
  if (Number.isNaN(started.getTime())) {
    return false;
  }
  return (
    started.getFullYear() !== now.getFullYear() ||
    started.getMonth() !== now.getMonth() ||
    started.getDate() !== now.getDate()
  );
}

// §19.3 reps label: EN DASH between both targets.
export function repsLabel(set) {
  if (set.target_reps_min && set.target_reps_max) {
    return `${set.target_reps_min}–${set.target_reps_max} reps`;
  }
  return `${set.target_reps_min || set.actual_reps || 0} reps`;
}

// §19.7: muscle-group filter chips, in first-seen order.
export function muscleGroups(session) {
  const seen = [];
  (session?.exercises || []).forEach((exercise) => {
    const name = exercise?.exercise?.primary_muscle_group?.name;
    if (name && !seen.includes(name)) {
      seen.push(name);
    }
  });
  return seen;
}

export function exerciseName(exercise) {
  return exercise?.exercise_name_snapshot || exercise?.exercise?.name || '';
}

// §22.2 drag geometry for the rest-timer widget.
// The web clamps to an 8px margin inside the viewport on every pointer move AND
// on every countdown tick: x = min(max(8, v), max(8, windowWidth − width − 8)),
// and the same for y. The inner max() is what pins a widget wider than the
// viewport to 8 instead of letting it go negative.
// [O2] the margin is measured from the safe-area edges, so the widget can never
// land under the notch or the home indicator. `bounds` is the overlay box, which
// spans the whole session screen, so all four insets are added here.
export const TIMER_DRAG_MARGIN = 8;
export const TIMER_DRAG_THRESHOLD = 4;
export const TIMER_DEFAULT_TOP = 12;

export function clampTimerPosition(position, { size, bounds, insets } = {}) {
  if (!position || !bounds) {
    return position || null;
  }
  const minX = TIMER_DRAG_MARGIN + (insets?.left || 0);
  const minY = TIMER_DRAG_MARGIN + (insets?.top || 0);
  const maxX = Math.max(minX, bounds.width - (insets?.right || 0) - size - TIMER_DRAG_MARGIN);
  const maxY = Math.max(minY, bounds.height - (insets?.bottom || 0) - size - TIMER_DRAG_MARGIN);
  return {
    x: Math.min(Math.max(minX, position.x), maxX),
    y: Math.min(Math.max(minY, position.y), maxY),
  };
}

// The untouched default (§22.2): horizontally centred, 12 from the top. Dragging
// starts from wherever the widget currently sits, so this is also the origin a
// first drag offsets from.
export function defaultTimerPosition({ size, bounds, insets }) {
  if (!bounds) {
    return null;
  }
  return { x: Math.max(0, (bounds.width - size) / 2), y: (insets?.top || 0) + TIMER_DEFAULT_TOP };
}

// §22.3: the auto-scroll offset that centres a set row in the visible area,
// clamped to the content. Pure so the arithmetic is testable without a layout.
export function centeredScrollOffset({ rowY, rowHeight, visibleHeight, contentHeight }) {
  if (!visibleHeight) {
    return null;
  }
  const max = Math.max(0, contentHeight - visibleHeight);
  return Math.min(Math.max(0, rowY + rowHeight / 2 - visibleHeight / 2), max);
}
