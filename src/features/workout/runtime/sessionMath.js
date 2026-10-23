import { parseDateValue } from '../../../shared/time/timestamps';

// Pure rules of the session runtime (RN-SPEC-workout Part B, with O8 and
// O12). Every derived value reads the OVERLAID session (O12 invariant).

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function setKey(exerciseId, setId) {
  return `${exerciseId}:${setId}`;
}

// O12 §1: one read point. Each set becomes `{ ...serverSet, ...overlay }`.
// Overlay entries are `{ fields, seq }`; `seq` orders writes against reloads.
export function applyOverlay(session, confirmedSets) {
  if (!session?.exercises) {
    return session;
  }
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: (exercise.sets ?? []).map((set) => (confirmedSets[set.id] ? { ...set, ...confirmedSets[set.id].fields } : set)),
    })),
  };
}

// O12 §1 reconciliation after a successful reload. An entry written before
// the reload started (seq ≤ startSeq) is answered by it: agreement on
// is_completed drops it, disagreement drops it too (the server wins) and is
// reported. Entries written while the reload was in flight are kept.
export function reconcileOverlay(session, confirmedSets, startSeq) {
  const serverSets = {};
  for (const exercise of session?.exercises ?? []) {
    for (const set of exercise.sets ?? []) {
      serverSets[set.id] = set;
    }
  }
  const kept = {};
  let contradicted = false;
  for (const [id, entry] of Object.entries(confirmedSets)) {
    if (entry.seq > startSeq) {
      kept[id] = entry;
      continue;
    }
    const server = serverSets[id];
    if (server && Boolean(server.is_completed) !== Boolean(entry.fields.is_completed)) {
      contradicted = true;
    }
  }
  return { kept, contradicted };
}

// §26 sessionProgress.
export function sessionProgress(session) {
  const exercises = session?.exercises ?? [];
  let totalSets = 0;
  let completedSets = 0;
  let completedExercises = 0;
  let targetReps = 0;
  let actualReps = 0;
  let liveVolume = 0;
  let activeExerciseIndex = -1;
  exercises.forEach((exercise, index) => {
    const sets = exercise.sets ?? [];
    totalSets += sets.length;
    const done = sets.filter((set) => set.is_completed);
    completedSets += done.length;
    if (sets.length > 0 && done.length === sets.length) {
      completedExercises += 1;
    }
    if (activeExerciseIndex === -1 && sets.some((set) => !set.is_completed)) {
      activeExerciseIndex = index;
    }
    for (const set of sets) {
      targetReps += Number(set.target_reps_max || set.target_reps_min || 0);
      if (set.is_completed) {
        const reps = Number(set.actual_reps || 0);
        actualReps += reps;
        // ⚠W15: unit-blind.
        liveVolume += Number(set.actual_weight_value || 0) * reps;
      }
    }
  });
  return {
    totalSets,
    completedSets,
    completedExercises,
    totalExercises: exercises.length,
    targetReps,
    actualReps,
    liveVolume,
    activeExerciseIndex,
  };
}

// §26 orderedSets, the source of nextSetKey.
export function orderedSets(session) {
  const list = [];
  for (const exercise of session?.exercises ?? []) {
    for (const set of exercise.sets ?? []) {
      list.push({ exerciseId: exercise.id, setId: set.id, key: setKey(exercise.id, set.id), isCompleted: Boolean(set.is_completed) });
    }
  }
  return list;
}

// The next not-completed set across the whole session, treating `justDoneId`
// as completed; '' when none.
export function nextSetKeyAfter(ordered, justDoneId) {
  const next = ordered.find((item) => !item.isCompleted && item.setId !== justDoneId);
  return next ? next.key : '';
}

// §20.2: seed drafts, never overwriting one that exists. Cleared entirely
// when the session has no exercises.
export function seedDrafts(session, statsMap, previous) {
  const exercises = session?.exercises ?? [];
  if (exercises.length === 0) {
    return {};
  }
  const next = { ...previous };
  for (const exercise of exercises) {
    const stats = statsMap?.[exercise.exercise?.id];
    for (const set of exercise.sets ?? []) {
      next[set.id] = next[set.id] || {
        actualWeightValue: set.actual_weight_value ?? set.target_weight_value ?? stats?.value ?? '',
        actualWeightUnit: set.actual_weight_unit || set.target_weight_unit || stats?.unit || 'lb',
      };
    }
  }
  return next;
}

// §20.3 / ⚠W19: an edit on set i is written to set i and every later set of
// the same exercise.
export function propagateDraft(drafts, exercise, setId, field, value) {
  const sets = exercise.sets ?? [];
  const from = sets.findIndex((set) => set.id === setId);
  if (from === -1) {
    return drafts;
  }
  const next = { ...drafts };
  for (const set of sets.slice(from)) {
    next[set.id] = { ...(next[set.id] ?? {}), [field]: value };
  }
  return next;
}

// §20.5 "any positive number is accepted": the iOS decimal pad shows ","
// as its only decimal key in comma locales (DE, FR, ES, IT), so "22,5" reads
// as 22.5. Only the first comma is a decimal mark; "1,2,3" stays invalid.
export function parseWeight(value) {
  if (value === null || value === undefined) {
    return NaN;
  }
  const text = String(value).trim();
  return text === '' ? NaN : Number(text.replace(',', '.'));
}

// "Did it" / "Undo" in flight, per set. A second tap on a set whose PATCH is
// still pending is ignored synchronously (before any re-render disables the
// button), and finishing one set never re-enables another (M4).
export function createPendingSets() {
  const ids = new Set();
  return {
    begin(id) {
      if (ids.has(id)) {
        return false;
      }
      ids.add(id);
      return true;
    },
    end(id) {
      ids.delete(id);
    },
    snapshot: () => new Set(ids),
  };
}

// §21.1, on "Did it" only.
export function validateDraftWeight(value) {
  if (value === '' || value === null || value === undefined) {
    return 'Enter a weight before marking this set complete.';
  }
  const number = parseWeight(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 'Weight must be greater than 0.';
  }
  return null;
}

// §20.4: the PATCH body. Reps are always the plan's target (⚠W14).
export function buildSetPatch(set, draft, now = new Date()) {
  const completing = !set.is_completed;
  const number = parseWeight(draft?.actualWeightValue);
  const weight = Number.isFinite(number) && number > 0 ? number : null;
  return {
    actual_reps: set.actual_reps ?? set.target_reps_max ?? set.target_reps_min ?? 0,
    actual_weight_value: weight,
    actual_weight_unit: weight === null ? null : draft?.actualWeightUnit || set.actual_weight_unit || set.target_weight_unit || 'lb',
    rest_seconds_actual: set.rest_seconds_actual ?? set.rest_seconds_planned ?? null,
    is_completed: completing,
    completed_at: completing ? now.toISOString() : null,
  };
}

// §19.3 reps label (EN DASH; 23 Oct: equal ends read "12 reps").
export function setRepsLabel(set) {
  const min = set.target_reps_min;
  const max = set.target_reps_max;
  if (min && max && min !== max) {
    return `${min}–${max} reps`;
  }
  return `${min || set.actual_reps || 0} reps`;
}

export function setMetaLabel(set, isNext) {
  return `Rest ${set.rest_seconds_planned || 0}s${isNext ? ' · Up next' : ''}`;
}

export function restSecondsFor(set) {
  return Number(set.rest_seconds_planned || set.rest_seconds_actual || 0);
}

// Dated change (23 Oct): "set" when the count it qualifies is exactly 1.
export function setsWord(count) {
  return count === 1 ? 'set' : 'sets';
}

// §19.7 muscle chips: first-appearance order among the session's exercises.
export function muscleGroups(session) {
  const names = [];
  for (const exercise of session?.exercises ?? []) {
    const name = exercise.exercise?.primary_muscle_group?.name;
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

// [O8]: the local calendar date of started_at differs from today's.
export function staleSessionTitle(startedAt, now = new Date()) {
  const started = parseDateValue(startedAt);
  if (!started) {
    return null;
  }
  const sameDay =
    started.getFullYear() === now.getFullYear() && started.getMonth() === now.getMonth() && started.getDate() === now.getDate();
  if (sameDay) {
    return null;
  }
  return `Started ${WEEKDAYS[started.getDay()]}, ${MONTHS[started.getMonth()]} ${started.getDate()}`;
}

// §23.1: the popup snapshot, taken before the request.
export function completionSnapshot(session, planName, elapsedSeconds) {
  const progress = sessionProgress(session);
  return {
    planName: planName || 'Workout',
    durationSeconds: elapsedSeconds,
    totalVolume: progress.liveVolume,
    totalReps: progress.actualReps,
    completedSets: progress.completedSets,
    totalSets: progress.totalSets,
    completedExercises: progress.completedExercises,
    totalExercises: progress.totalExercises,
  };
}

export function exerciseName(exercise) {
  return exercise?.exercise_name_snapshot || exercise?.exercise?.name || '';
}

export function exerciseNotes(exercise) {
  return typeof exercise?.notes === 'string' ? exercise.notes.trim() : '';
}

// O12 / §19.3 "next" set (web `firstPendingSetId`): the first pending set of
// the exercise being VIEWED, not of the whole session, so browsing to a later
// exercise unlocks its first set (web parity). '' when the exercise is done.
// The rest/scroll target (`nextSetKeyAfter`) stays session-wide.
export function firstPendingSetKey(exercise) {
  const set = (exercise?.sets ?? []).find((item) => !item.is_completed);
  return set ? setKey(exercise.id, set.id) : '';
}

// §19.2 / §19.4 / §19.5 / §19 view flags, as the web derives them.
// - isActiveView: with every set done (active −1) the LAST exercise counts as
//   active, so its eyebrow still reads "Current exercise" (web maps −1 → last).
// - laterIncomplete: the first incomplete exercise after the active one (−1 none).
// - isLastIncomplete ("Last exercise — finish strong"): only while viewing the
//   active exercise, an active one exists and nothing incomplete follows it.
export function sessionViewState(exercises, viewing, activeIndex) {
  const list = exercises ?? [];
  const currentIndex = activeIndex === -1 ? list.length - 1 : activeIndex;
  const isActiveView = viewing === currentIndex;
  const laterIncomplete = list.findIndex((item, index) => index > activeIndex && (item.sets ?? []).some((set) => !set.is_completed));
  return {
    currentIndex,
    isActiveView,
    laterIncomplete,
    isLastIncomplete: isActiveView && activeIndex >= 0 && laterIncomplete === -1,
  };
}

// §22.3: the scroll offset that centres a row, clamped to
// [0, contentHeight − visibleHeight]; null while the viewport is unmeasured.
// (ported from the 28 Sep build)
export function centeredScrollOffset({ rowY, rowHeight, visibleHeight, contentHeight }) {
  if (!(visibleHeight > 0)) {
    return null;
  }
  const max = Math.max(0, (contentHeight || 0) - visibleHeight);
  const target = rowY + rowHeight / 2 - visibleHeight / 2;
  return Math.min(Math.max(0, target), max);
}
