// Client validation and payloads of the trainer plans spec, exact copy.

const SLUG_PATTERN = /^[a-z0-9_-]+$/;

// §A9.3
export function validateCreatePlan({ name, slug, categoryId }) {
  const errors = {};
  if (!name.trim()) {
    errors.name = 'Name is required.';
  }
  if (!slug.trim()) {
    errors.slug = 'Slug is required.';
  } else if (!SLUG_PATTERN.test(slug.trim())) {
    errors.slug = 'Slug can only include letters, numbers, hyphens, and underscores.';
  }
  if (!categoryId) {
    errors.category_id = 'Category is required.';
  }
  return errors;
}

export function buildCreatePlanPayload({ name, slug, categoryId, daysPerWeek, difficultyLevelId, description }) {
  return {
    name: name.trim(),
    slug: slug.trim(),
    category_id: Number(categoryId),
    days_per_week: Number(daysPerWeek),
    difficulty_level_id: difficultyLevelId ? Number(difficultyLevelId) : null,
    description: description.trim(),
    is_active: true,
  };
}

// §A6. The day_number errors have no field to show under (⚠ in the spec), so
// only `title` is ever visible.
export function validateAddDay({ title, nextDayNumber, dayLimit, canAddDay }) {
  const errors = {};
  if (!canAddDay) {
    errors.day_number = dayLimit
      ? `This plan already has all ${dayLimit} days.`
      : 'This plan already has all available days.';
  }
  if (nextDayNumber < 1 || nextDayNumber > (dayLimit || 7)) {
    errors.day_number = 'Day number must be between 1 and 7.';
  }
  if (!title.trim()) {
    errors.title = 'Day title is required.';
  }
  return errors;
}

export function buildAddDayPayload({ nextDayNumber, title, description }) {
  return { day_number: nextDayNumber, title: title.trim(), description: description.trim() };
}

const isBadPositive = (value) => {
  const number = Number(value);
  return Number.isNaN(number) || number <= 0;
};

// §A8. Later checks overwrite earlier ones for the same field.
export function validateAddSet({ repsMin, repsMax, weight, unit, rest }) {
  const errors = {};
  if (!repsMin && !repsMax && !weight) {
    errors.target_reps_min = 'At least reps or weight must be specified.';
  }
  if (repsMin && isBadPositive(repsMin)) {
    errors.target_reps_min = 'Minimum reps must be a positive number.';
  }
  if (repsMax && isBadPositive(repsMax)) {
    errors.target_reps_max = 'Maximum reps must be a positive number.';
  }
  if (repsMin && repsMax && Number(repsMin) > Number(repsMax)) {
    errors.target_reps_min = 'Minimum reps cannot be greater than maximum reps.';
  }
  if (weight && isBadPositive(weight)) {
    errors.target_weight_value = 'Weight must be a positive number.';
  }
  if (weight && !unit.trim()) {
    errors.target_weight_unit = 'Weight unit is required when a weight is entered.';
  }
  if (rest && isBadPositive(rest)) {
    errors.rest_seconds = 'Rest seconds must be a positive number.';
  }
  return errors;
}

export function buildAddSetPayload({ setNumber, repsMin, repsMax, weight, unit, rest }) {
  const payload = { set_number: setNumber };
  if (repsMin) {
    payload.target_reps_min = Number(repsMin);
  }
  if (repsMax) {
    payload.target_reps_max = Number(repsMax);
  }
  if (rest) {
    payload.rest_seconds = Number(rest);
  }
  if (weight) {
    payload.target_weight_value = Number(weight);
    payload.target_weight_unit = unit.trim() || 'lb';
  }
  return payload;
}

// Part B (spec §B3): the edit-details form's starting values.
export function getEditPlanInitial(plan) {
  return {
    name: plan?.name ?? '',
    categoryId: plan?.category_id ? String(plan.category_id) : '',
    daysPerWeek: plan?.days_per_week ? String(plan.days_per_week) : '3',
    difficultyLevelId: plan?.difficulty_level_id ? String(plan.difficulty_level_id) : '',
    description: plan?.description ?? '',
  };
}

// The PATCH body: only the fields that changed. Empty means nothing to send.
export function getChangedPlanFields(initial, values) {
  const changes = {};
  if (values.name.trim() !== initial.name) {
    changes.name = values.name.trim();
  }
  if (values.categoryId !== initial.categoryId) {
    changes.category_id = Number(values.categoryId);
  }
  if (values.daysPerWeek !== initial.daysPerWeek) {
    changes.days_per_week = Number(values.daysPerWeek);
  }
  // A difficulty can be changed but never cleared: PATCH reads null as "no change".
  if (values.difficultyLevelId && values.difficultyLevelId !== initial.difficultyLevelId) {
    changes.difficulty_level_id = Number(values.difficultyLevelId);
  }
  if (values.description.trim() !== initial.description) {
    changes.description = values.description.trim();
  }
  return changes;
}

export function validateEditPlan({ name, categoryId }) {
  const errors = {};
  if (!name.trim()) {
    errors.name = 'Name is required.';
  }
  if (!categoryId) {
    errors.category_id = 'Category is required.';
  }
  return errors;
}

// A plan can't declare fewer days than it already has.
export function getDaysPerWeekOptions(dayCount) {
  const options = [];
  for (let n = Math.max(1, dayCount); n <= 7; n += 1) {
    options.push({ value: String(n), label: String(n) });
  }
  return options;
}

// §B6, ⚠B-4: compared with the day's raw values, so a null description
// starts out "changed".
export function isDayEdited(day, { title, description }) {
  return title !== day?.title || description !== day?.description;
}

export function buildEditDayPayload(day, { title, description }) {
  return { day_number: day.day_number, title: title.trim(), description: description.trim() };
}

const toField = (value) => (value === null || value === undefined ? '' : String(value));

// §B8: the edit-set form's starting values.
export function getSetPrefill(set) {
  return {
    setNumber: toField(set?.set_number),
    repsMin: toField(set?.target_reps_min),
    repsMax: toField(set?.target_reps_max),
    weight: toField(set?.target_weight_value),
    unit: set?.target_weight_unit || 'lb',
    rest: toField(set?.rest_seconds),
  };
}

export function validateEditSet(values) {
  const errors = validateAddSet(values);
  if (!values.setNumber || Number(values.setNumber) < 1) {
    errors.set_number = 'Set number is required.';
  }
  return errors;
}

// PUT is a full replace: a blank target is omitted, which clears it.
export function buildEditSetPayload(values) {
  return buildAddSetPayload({ ...values, setNumber: Number(values.setNumber) });
}
