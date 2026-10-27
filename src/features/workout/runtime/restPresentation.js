import { formatNumber, formatWeight, parseDecimal } from '../../../shared/format/numbers';
import { formatDuration } from '../../../shared/time/format';
import { exerciseName, setRepsLabel, setsWord } from './sessionMath';
import { formatClock } from './restEngine';

// v2 Phase 3 §4 (UX F2): pure presentation rules for Rest and Workout
// complete. No behaviour lives here: the rest engine and alerts are frozen
// (RN-SPEC-time §7.2, O4); these only shape data the session already has.

// F2 shared rest rules: the ring is the motion-free cue. r136 in a 300
// viewBox, stroke 14 (circumference 854.5); the minimised disc ring is r40,
// stroke 6 in a 92 viewBox (251.3); tablet disc r58, stroke 7 in 132 (364.4).
export const REST_RING = Object.freeze({ viewBox: 300, radius: 136, stroke: 14 });
export const MINI_RING = Object.freeze({ viewBox: 92, radius: 40, stroke: 6 });
export const MINI_RING_TABLET = Object.freeze({ viewBox: 132, radius: 58, stroke: 7 });

export function ringCircumference(radius) {
  return 2 * Math.PI * radius;
}

// The arc is the time REMAINING: dashoffset = C × (1 − secondsLeft/total).
// `totalSeconds` only grows (+5 s), so the ratio never passes 1; clamped
// anyway so a bad total can never draw past a full ring.
export function remainingRatio(secondsLeft, totalSeconds) {
  if (!(totalSeconds > 0)) {
    return 0;
  }
  return Math.min(1, Math.max(0, secondsLeft / totalSeconds));
}

export function ringDashOffset(secondsLeft, totalSeconds, radius) {
  return ringCircumference(radius) * (1 - remainingRatio(secondsLeft, totalSeconds));
}

// Last 10 s: 0 < secondsLeft ≤ 10 (digits turn danger text and pulse).
export function isFinalTen(secondsLeft) {
  return secondsLeft > 0 && secondsLeft <= 10;
}

// "of m:ss" (U4) = the rest's total.
export function restTotalLabel(totalSeconds) {
  return `of ${formatClock(Math.max(0, Math.round(totalSeconds || 0)))}`;
}

// The session exercise and set behind a "exerciseId:setId" key.
function findSet(session, key) {
  if (!key) {
    return null;
  }
  for (const exercise of session?.exercises ?? []) {
    const sets = exercise.sets ?? [];
    for (let index = 0; index < sets.length; index += 1) {
      if (`${exercise.id}:${sets[index].id}` === key) {
        return { exercise, set: sets[index], index };
      }
    }
  }
  return null;
}

// The weight the next set will log: its draft (what the member typed or the
// seeded value), else nothing. Blank, junk or ≤ 0 → no weight part.
function nextWeight(set, draft) {
  const raw = draft?.actualWeightValue ?? '';
  const value = parseDecimal(String(raw));
  // M3 (web nextSetLabel): the weight part only when > 0.
  if (value === null || Number.isNaN(value) || !(value > 0)) {
    return '';
  }
  const unit = draft?.actualWeightUnit || set.actual_weight_unit || set.target_weight_unit || 'lb';
  return formatWeight(value, unit);
}

// U4 Next card / "Next: set…" line (F2 N1: as drawn, from data the session
// already has). null when there is no next set (`nextSetKey` '' = the last
// set of the session): the card is hidden.
//   { exerciseName, exercise (the library exercise, for the photo), line }
//   line = "Set 3 · 8–10 reps · 135 lb" (the weight part only when known).
export function restNextPreview(session, nextSetKey, drafts) {
  const found = findSet(session, nextSetKey);
  if (!found) {
    return null;
  }
  const { exercise, set, index } = found;
  const number = Number(set.set_number) > 0 ? Number(set.set_number) : index + 1;
  const parts = [`Set ${number}`, setRepsLabel(set)];
  const weight = nextWeight(set, drafts?.[set.id]);
  if (weight) {
    parts.push(weight);
  }
  return {
    exerciseName: exerciseName(exercise),
    exercise: exercise.exercise ?? null,
    line: parts.join(' · '),
  };
}

// The VoiceOver / TalkBack reading of a PB line: "145 lb × 8" → "145 pounds
// times 8".
const UNIT_WORDS = { lb: 'pounds', kg: 'kilograms' };

export function spokenRecordLine(line) {
  return line
    .replace(/ · /g, ', ')
    .replace(/ × /g, ' times ')
    .replace(/(\d) (lb|kg)\b/g, (_, digit, unit) => `${digit} ${UNIT_WORDS[unit]}`);
}

function isNumber(value) {
  return value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value));
}

// #15 "New personal best" (PM-confirmed 26 Oct, phase 3 spec §4):
// - only entries with previous_value != null (a beaten best; first-ever
//   records never show);
// - one line per exercise; a weight record wins over a reps one:
//   "{exercise} · {w} {unit} × {r}", else "{exercise} · {r} reps";
// - at most 3 lines, weight records first; none → [] (no card).
// The BE shape (backend-plan #15): { exercise_id, exercise_name,
// record_type "weight" | "reps", value, unit, previous_value }. Web parity
// (PersonalBestCard.jsx:11-33, PM 27 Oct): the "× {r}" part is the same
// exercise's beaten reps record in this list; without one the line ends at
// the weight.
export function personalBestLines(records) {
  if (!Array.isArray(records)) {
    return [];
  }
  const byExercise = new Map();
  const beatenReps = new Map();
  for (const record of records) {
    if (!record || record.previous_value === null || record.previous_value === undefined) {
      continue;
    }
    if (record.record_type !== 'weight' && record.record_type !== 'reps') {
      continue;
    }
    if (!isNumber(record.value)) {
      continue;
    }
    const key = record.exercise_id ?? record.exercise_name;
    if (record.record_type === 'reps') {
      beatenReps.set(key, record.value);
    }
    const current = byExercise.get(key);
    if (!current || (current.record_type !== 'weight' && record.record_type === 'weight')) {
      byExercise.set(key, record);
    }
  }
  const lines = [...byExercise.values()].map((record) => {
    const name = record.exercise_name || 'Exercise';
    if (record.record_type === 'weight') {
      const weight = `${formatNumber(record.value)} ${record.unit || 'lb'}`.trim();
      const repsValue = beatenReps.get(record.exercise_id ?? record.exercise_name);
      const reps = isNumber(repsValue) ? ` × ${formatNumber(repsValue, 0)}` : '';
      return { exerciseId: record.exercise_id ?? null, type: 'weight', text: `${name} · ${weight}${reps}` };
    }
    return { exerciseId: record.exercise_id ?? null, type: 'reps', text: `${name} · ${formatNumber(record.value, 0)} reps` };
  });
  const weights = lines.filter((line) => line.type === 'weight');
  const reps = lines.filter((line) => line.type === 'reps');
  return [...weights, ...reps].slice(0, 3);
}

// The completion popup's volume, in the unit the snapshot carries (the
// member's unit once SessionRuntime sends `volumeUnit`; v1 said "lb").
export function completionVolume(popup) {
  return formatWeight(popup?.totalVolume ?? 0, popup?.volumeUnit || 'lb', 0);
}

// U6 Share summary (phase 3 spec §4, UX §10): text only, one fact a line.
export function shareSummaryText(popup, lines = []) {
  const rows = [
    `Workout complete: ${popup.planName || 'Workout'}`,
    `Time: ${formatDuration(popup.durationSeconds)}`,
    `Volume: ${completionVolume(popup)}`,
    `Reps: ${formatNumber(popup.totalReps, 0)}`,
    `Sets: ${popup.completedSets}/${popup.totalSets}`,
    ...lines.map((line) => `New personal best: ${line.text}`),
  ];
  return rows.join('\n');
}

export function completionSetsLine(popup) {
  return `${popup.completedSets}/${popup.totalSets} ${setsWord(popup.totalSets)} done. Consistency wins.`;
}

export const SHARE_ERROR = 'Could not open sharing. Please try again.';
