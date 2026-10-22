// Text and derived values of the trainer plans spec, kept exact (bugs included).

const DOT = ' · ';

// §A5.7 set summary. A 0 counts as absent for reps and rest.
export function formatSetSummary({ target_reps_min: min, target_reps_max: max, target_weight_value: weight, target_weight_unit: unit, rest_seconds: rest } = {}) {
  let reps = 'Open reps';
  if (min && max) {
    reps = `${min}-${max} reps`;
  } else if (min) {
    reps = `${min} reps`;
  } else if (max) {
    reps = `${max} reps`;
  }
  const weightText = weight !== null && weight !== undefined ? `${weight} ${unit ?? ''}`.trim() : 'Open weight';
  const restText = rest ? `${rest}s rest` : 'Open rest';
  return [reps, weightText, restText].join(DOT);
}

// §A5.7 exercise summary.
export function formatExerciseSummary(exercise) {
  const summary = exercise?.target_set_summary ?? {};
  const setCount = summary.set_count || exercise?.target_sets?.length || 0;
  if (!setCount) {
    return 'No sets configured';
  }
  return `${setCount} ${setCount === 1 ? 'set' : 'sets'}${DOT}${formatSetSummary(summary)}`;
}

// PlanCard line. ⚠T1-4: never singular.
export function formatDaysPerWeek(plan) {
  return plan?.days_per_week ? `${plan.days_per_week} days / week` : 'Training plan';
}

// ⚠T3-4: never singular, and 0 when the count is missing.
export function formatExerciseCount(day) {
  return `${day?.exercises_count || 0} exercises`;
}

export function formatDayTitle(day) {
  return `Day ${day.day_number}: ${day.title || 'Untitled day'}`;
}

export function exerciseName(planDayExercise) {
  return planDayExercise.exercise?.name || `Exercise #${planDayExercise.exercise_id}`;
}

// §A9.3
export function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

// §A6 inputs from the plan screen.
export function getAddDayContext(plan, days) {
  const nextDayNumber = Math.max(0, ...days.map((day) => Number(day.day_number) || 0)) + 1;
  const dayLimit = plan?.days_per_week ?? null;
  const canAddDay = !plan?.days_per_week || days.length < plan.days_per_week;
  return { nextDayNumber, dayLimit, canAddDay };
}

// §A7.4: the next order_index base for "Add Selected".
export function getOrderIndexBase(dayExercises) {
  return Math.max(0, ...dayExercises.map((exercise) => Number(exercise.order_index) || 0));
}

// §A7.3: catalog ids already on the selected day.
export function getAddedExerciseIds(dayExercises) {
  return new Set(dayExercises.map((exercise) => exercise.exercise?.id ?? exercise.exercise_id));
}

export const ALL_MUSCLE_GROUPS = 'All muscle groups';
export const ALL_EQUIPMENT = 'All equipment';

// §A7.2 live filtering; all three must match. Keeps catalog order.
export function filterCatalog(catalog, { search, muscle, equipment }) {
  const term = search.trim().toLowerCase();
  return catalog.filter((exercise) => {
    const matchesTerm =
      !term ||
      String(exercise.name ?? '').toLowerCase().includes(term) ||
      String(exercise.slug ?? '').toLowerCase().includes(term);
    const matchesMuscle = muscle === ALL_MUSCLE_GROUPS || exercise.primary_muscle_group?.name === muscle;
    const matchesEquipment =
      equipment === ALL_EQUIPMENT || String(exercise.equipment_type_id || '') === equipment;
    return matchesTerm && matchesMuscle && matchesEquipment;
  });
}

export function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Part B (spec §B1) count copy.
export function formatClientsOnPlan(count) {
  return count === 1 ? `${count} client is on this plan` : `${count} clients are on this plan`;
}

export function formatAffectsNotice(count) {
  return `This affects ${count} ${count === 1 ? 'client' : 'clients'}. Changes apply from their next workout; past and in-progress workouts stay as they are.`;
}

// Moves one item to another index and returns a new array.
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// C5: the next set number is the highest existing set_number + 1.
export function getNextSetNumber(sets) {
  return Math.max(0, ...sets.map((set) => Number(set.set_number) || 0)) + 1;
}
