import { parseDecimal } from '../../../shared/format/numbers';
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
  let volumeKg = 0;
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
        // ⚠W15: unit-blind (v1's number, kept for reference; never shown).
        liveVolume += Number(set.actual_weight_value || 0) * reps;
        volumeKg += setVolumeKg(set);
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
    volumeKg,
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
// when the session has no exercises. A completed set shows only what was
// saved, which may be no weight (T-16, 25 Oct 2026).
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
        actualWeightValue: set.is_completed
          ? set.actual_weight_value ?? ''
          : set.actual_weight_value ?? set.target_weight_value ?? stats?.value ?? '',
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

// §20.5/§21.1 (T-16): "22,5" reads as 22.5; blank or junk ("1,2,3", "1e2")
// is NaN.
export function parseWeight(value) {
  return parseDecimal(value) ?? NaN;
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

// §21.1, on "Did it" only. The weight is optional (T-16, 25 Oct 2026): a
// blank or spaces-only draft completes the set with no weight.
export function validateDraftWeight(value) {
  if (String(value ?? '').trim() === '') {
    return null;
  }
  const number = parseWeight(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 'Weight must be greater than 0.';
  }
  return null;
}

// §20.4: the PATCH body. v2 U3 (approved): "Did it" sends the REAL reps
// the member entered (`draft.actualReps`, 1–99); a blank reps field logs what
// v1 sent (⚠W14: the saved reps, else the plan's target). Undo sends v1's.
export function buildSetPatch(set, draft, now = new Date()) {
  const completing = !set.is_completed;
  const number = parseWeight(draft?.actualWeightValue);
  const weight = Number.isFinite(number) && number > 0 ? number : null;
  const typedReps = completing ? parseReps(draft?.actualReps) : null;
  return {
    actual_reps: typedReps ?? set.actual_reps ?? set.target_reps_max ?? set.target_reps_min ?? 0,
    actual_weight_value: weight,
    actual_weight_unit: weight === null ? null : draft?.actualWeightUnit || set.actual_weight_unit || set.target_weight_unit || 'lb',
    rest_seconds_actual: set.rest_seconds_actual ?? set.rest_seconds_planned ?? null,
    is_completed: completing,
    completed_at: completing ? now.toISOString() : null,
  };
}

// §20.2 (T-16): after a successful "Did it" the draft becomes the saved set,
// since a null weight on the PATCH leaves an earlier saved weight in place.
export function draftFromSavedSet(saved, sentUnit) {
  return { actualWeightValue: saved.actual_weight_value ?? '', actualWeightUnit: saved.actual_weight_unit || sentUnit };
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

// §23.1: the popup snapshot, taken before the request. VOLUME RULE (PM,
// 27 Oct): the volume is the client sum in kg, shown in the member's unit
// (`volumeUnit`), never v1's unit-blind number with "lb".
export function completionSnapshot(session, planName, elapsedSeconds, unit = 'kg') {
  const progress = sessionProgress(session);
  const volumeUnit = normalUnit(unit);
  return {
    planName: planName || 'Workout',
    durationSeconds: elapsedSeconds,
    totalVolume: volumeInUnit(progress.volumeKg, volumeUnit),
    volumeUnit,
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

// ---------------------------------------------------------------------------
// v2 Phase 3 §3 Workout (UX F1): steppers, "Last time", the volume rule and
// the session chrome's texts.

export const LB_PER_KG = 2.20462;
// ND1: one weight step per press, per unit.
export const WEIGHT_STEP = Object.freeze({ lb: 5, kg: 2.5 });
export const REPS_MIN = 1;
export const REPS_MAX = 99;

export function normalUnit(unit) {
  return unit === 'lb' ? 'lb' : 'kg';
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

// Two decimals at most, no float noise (82.5 + 2.5 → "85", 0.1 + 0.2 → "0.3").
function numberText(value) {
  return String(Math.round(value * 100) / 100);
}

export function convertWeight(value, from, to) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return NaN;
  }
  const source = from === 'kg' ? 'kg' : 'lb';
  const target = to === 'kg' ? 'kg' : 'lb';
  if (source === target) {
    return number;
  }
  return target === 'kg' ? number / LB_PER_KG : number * LB_PER_KG;
}

// "Last time" numbers in the CURRENT unit: kg to 0.5, lb to whole numbers.
export function roundForUnit(value, unit) {
  return unit === 'kg' ? roundTo(value, 0.5) : Math.round(value);
}

// VOLUME RULE: a completed set's weight × reps in kg. A weight saved with no
// unit reads as the set's planned unit, else lb (v1's default unit).
export function setVolumeKg(set) {
  const weight = Number(set?.actual_weight_value || 0);
  const reps = Number(set?.actual_reps || 0);
  if (!(weight > 0) || !(reps > 0)) {
    return 0;
  }
  return convertWeight(weight, set.actual_weight_unit || set.target_weight_unit || 'lb', 'kg') * reps;
}

export function volumeInUnit(volumeKg, unit) {
  return convertWeight(volumeKg, 'kg', normalUnit(unit));
}

// The member's unit for volumes: profile current_weight_unit, else
// goal_weight_unit; unknown → kg.
export function memberWeightUnit(profile) {
  const unit = profile?.current_weight_unit || profile?.goal_weight_unit;
  return unit === 'lb' || unit === 'kg' ? unit : 'kg';
}

// U3: the same SET NUMBER in the latest completed session that had it (BE
// `previous_sets`). NO fallback to another set number (PM/UX, 27 Oct).
export function previousSetFor(exercise, set) {
  const list = Array.isArray(exercise?.previous_sets) ? exercise.previous_sets : [];
  return list.find((item) => Number(item?.set_number) === Number(set?.set_number)) ?? null;
}

function previousReps(previous) {
  const reps = Number(previous?.reps);
  return Number.isInteger(reps) && reps > 0 ? reps : null;
}

// The previous weight converted to `unit`, rounded per unit; null when none.
export function lastTimeWeight(previous, unit) {
  const weight = Number(previous?.weight_value);
  if (!previous || !(weight > 0)) {
    return null;
  }
  const target = unit === 'kg' ? 'kg' : 'lb';
  return roundForUnit(convertWeight(weight, previous.weight_unit || target, target), target);
}

// "Last time {w} × {r}" / "Last time {r} reps"; null hides the line.
export function lastTimeLabel(previous, unit) {
  if (!previous) {
    return null;
  }
  const reps = previousReps(previous);
  const weight = lastTimeWeight(previous, unit);
  if (weight !== null && reps !== null) {
    return `Last time ${formatPlain(weight)} × ${reps}`;
  }
  if (reps !== null) {
    return `Last time ${reps} reps`;
  }
  // Review LOW (web): a weight-only previous set reads "Last time 135".
  if (weight !== null) {
    return `Last time ${formatPlain(weight)}`;
  }
  return null;
}

function formatPlain(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

// ND1 weight stepper. `direction` +1 / −1. An empty (or unreadable) field
// starts from the set's Last time weight, else 0. "−" at or below one step
// clears the field (weight is optional; it never shows 0).
export function stepWeight(value, unit, direction, startWeight = null) {
  const step = WEIGHT_STEP[unit === 'kg' ? 'kg' : 'lb'];
  const parsed = parseWeight(value);
  const base = Number.isFinite(parsed) && parsed > 0 ? parsed : startWeight > 0 ? startWeight : 0;
  if (direction < 0) {
    return base <= step ? '' : numberText(base - step);
  }
  return numberText(base + step);
}

// ND2 reps: integers 1–99 typed or stepped; anything else is stripped (no
// error copy).
export function sanitizeReps(text) {
  const digits = String(text ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits === '') {
    return '';
  }
  return String(Math.min(REPS_MAX, Number(digits.slice(0, 3))));
}

export function parseReps(value) {
  const reps = Number(String(value ?? '').trim());
  return Number.isInteger(reps) && reps >= REPS_MIN && reps <= REPS_MAX && String(value).trim() !== '' ? reps : null;
}

export function stepReps(value, direction) {
  const current = parseReps(value) ?? 0;
  const next = Math.min(REPS_MAX, Math.max(REPS_MIN, current + direction));
  return current === 0 && direction < 0 ? '' : String(next);
}

// ND2 prefill: the set's own Last time reps, else the top of the target
// range, else blank (blank → "Did it" logs the target, as v1).
export function repsPrefill(set, previous) {
  if (set?.is_completed && set.actual_reps != null) {
    return String(set.actual_reps);
  }
  const last = previousReps(previous);
  if (last !== null) {
    return String(last);
  }
  const top = Number(set?.target_reps_max || set?.target_reps_min || 0);
  return top > 0 ? String(Math.min(REPS_MAX, top)) : '';
}

// Reps drafts, seeded once per set like the weight drafts (§20.2).
export function seedRepsDrafts(session, previous) {
  const exercises = session?.exercises ?? [];
  if (exercises.length === 0) {
    return {};
  }
  const next = { ...previous };
  for (const exercise of exercises) {
    for (const set of exercise.sets ?? []) {
      if (next[set.id] === undefined) {
        next[set.id] = repsPrefill(set, previousSetFor(exercise, set));
      }
    }
  }
  return next;
}

// "8–10" / "12" / '' (EN DASH).
export function targetRange(set) {
  const min = Number(set?.target_reps_min || 0);
  const max = Number(set?.target_reps_max || 0);
  if (min && max && min !== max) {
    return `${min}–${max}`;
  }
  return min || max ? String(min || max) : '';
}

// ND2 label: "Reps · target 8–10", or "Reps" with no target.
export function repsFieldLabel(set) {
  const range = targetRange(set);
  return range ? `Reps · target ${range}` : 'Reps';
}

// A done chip: "135 × 10" / "10 reps" (weight blank).
export function doneSetLabel(set) {
  const weight = Number(set?.actual_weight_value);
  const reps = Number(set?.actual_reps || 0);
  return weight > 0 ? `${formatPlain(weight)} × ${reps}` : `${reps} reps`;
}

// The chrome timer pill: m:ss, minutes never roll into hours ("95:03").
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

// The timer's spoken name, updated at most every 30 s (F1 a11y): never
// announce each second.
export function elapsedSpokenLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const bucket = total - (total % 30);
  const minutes = Math.floor(bucket / 60);
  const rest = bucket % 60;
  const minutePart = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  return rest ? `Elapsed time ${minutePart} ${rest} seconds` : `Elapsed time ${minutePart}`;
}

// "Exercise 1: 3 of 3 sets done" (nav segments, F1 browsing).
export function segmentLabel(exercise, index) {
  const sets = exercise?.sets ?? [];
  const done = sets.filter((set) => set.is_completed).length;
  return `Exercise ${index + 1}: ${done} of ${sets.length} ${setsWord(sets.length)} done`;
}

export function exerciseDone(exercise) {
  const sets = exercise?.sets ?? [];
  return { done: sets.filter((set) => set.is_completed).length, total: sets.length };
}

// The stage eyebrow (code wins: "Current exercise" on the active one, else
// "Exercise {i} of {n}"), with the muscle and the session count as drawn.
export function stageEyebrow({ isActive, index, count, muscle, completedSets, totalSets }) {
  const parts = [isActive ? 'Current exercise' : `Exercise ${index + 1} of ${count}`];
  if (muscle) {
    parts.push(muscle);
  }
  if (totalSets > 0) {
    parts.push(`${completedSets}/${totalSets} ${setsWord(totalSets)} done`);
  }
  return parts.join(' · ');
}

// The tablet eyebrow: "Current exercise · 3 sets · 8–10 reps · rest 90s".
export function tabletEyebrow({ isActive, index, count, exercise }) {
  const sets = exercise?.sets ?? [];
  const first = sets[0];
  const parts = [isActive ? 'Current exercise' : `Exercise ${index + 1} of ${count}`, `${sets.length} ${setsWord(sets.length)}`];
  const range = targetRange(first);
  if (range) {
    parts.push(`${range} reps`);
  }
  if (first && restSecondsFor(first) > 0) {
    parts.push(`rest ${restSecondsFor(first)}s`);
  }
  return parts.join(' · ');
}

// The editor header's faint part: "of 3 · rest 90s".
export function setOfLabel(set, total) {
  const rest = Number(set?.rest_seconds_planned || 0);
  return rest > 0 ? `of ${total} · rest ${rest}s` : `of ${total}`;
}
