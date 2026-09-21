// API payloads shaped exactly like RN-SPEC-plans §6 (the `data` inside the
// envelope). Keys are exact; values are illustrative.

const TS = '2026-05-11T20:40:12Z';

export function category(id, name, code = name.toUpperCase().replace(/ /g, '_')) {
  return { id, code, name, created_at: TS };
}

export const BUILD_MUSCLE = category(1, 'Build Muscle');
export const LOSE_FAT = category(2, 'Lose Fat');

// §6.2 list item. `description` and `difficulty_level_id` are omitted when
// empty; list items never carry `difficulty_level`.
export function planItem(overrides = {}) {
  const plan = {
    id: 1,
    name: 'Beginner Full Body Foundation',
    slug: 'beginner-full-body-foundation',
    category_id: 1,
    days_per_week: 3,
    description: 'Simple full-body gym plan for new lifters building consistency, technique, and basic strength.',
    difficulty_level_id: 1,
    is_active: true,
    created_at: TS,
    updated_at: TS,
    category: BUILD_MUSCLE,
    ...overrides,
  };
  Object.keys(plan).forEach((key) => plan[key] === undefined && delete plan[key]);
  return plan;
}

export function plansList(items) {
  return { items, pagination: { page: 1, per_page: 20, total: items.length, total_pages: 1 } };
}

// §6.3 detail adds difficulty_level.
export function planDetail(overrides = {}) {
  return {
    plan: planItem({
      difficulty_level: { id: 1, code: 'BEGINNER', name: 'Beginner', created_at: TS },
      ...overrides,
    }),
  };
}

export function day(id, dayNumber, title, planId = 1) {
  const value = { id, workout_plan_id: planId, day_number: dayNumber, title, created_at: TS };
  if (title === undefined) {
    delete value.title;
  }
  return value;
}

export function daysList(days) {
  return { items: days };
}

export function exercise(id, { name, code, group, summary } = {}) {
  const item = {
    id,
    workout_plan_day_id: 1,
    order_index: id,
    exercise: {
      id: id + 100,
      name: name ?? `Exercise ${id}`,
      slug: `exercise-${id}`,
      primary_muscle_group_id: 5,
      is_active: true,
      created_at: TS,
      updated_at: TS,
    },
    target_sets: [],
    created_at: TS,
  };
  if (code || group) {
    item.exercise.primary_muscle_group = { id: 5, code, name: group };
  }
  if (summary !== undefined) {
    item.target_set_summary = summary;
  }
  return item;
}

export function exercisesList(items) {
  return { items };
}

export const WEEKDAYS = {
  1: { id: 1, code: 'MON', name: 'Monday', sort_order: 1, created_at: TS },
  2: { id: 2, code: 'TUE', name: 'Tuesday', sort_order: 2, created_at: TS },
  3: { id: 3, code: 'WED', name: 'Wednesday', sort_order: 3, created_at: TS },
  4: { id: 4, code: 'THU', name: 'Thursday', sort_order: 4, created_at: TS },
  5: { id: 5, code: 'FRI', name: 'Friday', sort_order: 5, created_at: TS },
  6: { id: 6, code: 'SAT', name: 'Saturday', sort_order: 6, created_at: TS },
  7: { id: 7, code: 'SUN', name: 'Sunday', sort_order: 7, created_at: TS },
};

// §6.6: data sits directly in `data`.
export function currentPlan({ enrollmentId = 31, plan, weekdayIds = [], planDays = [] } = {}) {
  return {
    enrollment: {
      id: enrollmentId,
      user_id: 7,
      workout_plan_id: plan.id,
      status: 'active',
      started_on: '2026-09-21T00:00:00Z',
      created_at: TS,
      updated_at: TS,
      plan,
    },
    schedule: weekdayIds.map((weekdayId, index) => ({
      id: 90 + index,
      weekday: WEEKDAYS[weekdayId],
      plan_day: planDays[index] ?? day(index + 1, index + 1, `Day ${index + 1}`, plan.id),
      created_at: TS,
    })),
  };
}

export function enrollmentCreated(id = 32, planId = 3) {
  return {
    enrollment: {
      id,
      user_id: 7,
      workout_plan_id: planId,
      status: 'active',
      started_on: '2026-09-21T00:00:00Z',
      created_at: TS,
      updated_at: TS,
    },
  };
}

export function scheduleSaved(enrollmentId = 32) {
  return { enrollment_id: enrollmentId, schedule: [] };
}

export const NOT_FOUND_CURRENT = { success: false, message: 'Current active plan not found' };
export const TRAINER_LOCK = { success: false, message: 'This plan is managed by your trainer and cannot be changed' };
