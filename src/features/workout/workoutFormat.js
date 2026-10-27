import { formatCount } from '../../shared/format/counts';

// Derived values and copy of the Workout hub (RN-SPEC-workout Part A).
// Pure, so it can be tested.

function pad(value) {
  return String(value).padStart(2, '0');
}

function localDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// RN-SPEC-time §4.3: device-local Monday…Sunday.
export function currentWeekRange(now = new Date()) {
  const start = new Date(now);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startDate: localDate(start), endDate: localDate(end) };
}

// §3.1: from today's status only; there is no "missed" state here.
export function todayState(todayStatus) {
  if (todayStatus?.already_completed) {
    return 'completed';
  }
  if (todayStatus?.is_workout_day) {
    return 'training';
  }
  return 'rest';
}

export const TODAY_BADGE_LABELS = Object.freeze({
  completed: 'Completed',
  training: 'Training day',
  rest: 'Rest day',
});

// §3.2
export function todayDetail(todayStatus) {
  const title = todayStatus?.plan_day?.title;
  if (todayStatus?.already_completed) {
    return `${title || "Today's session"} is done — great work.`;
  }
  if (todayStatus?.is_workout_day) {
    return `${title || 'Your workout'} is ready to go.`;
  }
  return 'Nothing scheduled today — start any day below.';
}

// §3.3
export function showsHeroStart(todayStatus) {
  return Boolean(todayStatus?.is_workout_day && !todayStatus?.already_completed && todayStatus?.plan_day?.id);
}

export function trainingDaysLabel(count) {
  return formatCount(count, 'training day', 'training days');
}

// §5.3: every completed session's plan day id (duplicates kept).
export function completedDayIds(sessions) {
  return (sessions ?? []).map((session) => session.workout_plan_day_id);
}

// §5.3 / ⚠W11: plan days (not sessions) completed this week, capped by construction.
export function completedThisWeekCount(planDays, dayIds) {
  return planDays.filter((day) => dayIds.includes(day.id)).length;
}

// §7: weekdays per plan day, de-duplicated by weekday id, sorted by sort_order.
export function scheduledWeekdaysByDayId(schedule) {
  const byDay = {};
  for (const item of schedule ?? []) {
    const dayId = item.plan_day?.id;
    const weekday = item.weekday;
    if (dayId == null || !weekday) {
      continue;
    }
    byDay[dayId] = byDay[dayId] ?? [];
    if (!byDay[dayId].some((existing) => existing.id === weekday.id)) {
      byDay[dayId].push(weekday);
    }
  }
  for (const dayId of Object.keys(byDay)) {
    byDay[dayId].sort((a, b) => Number(a.sort_order ?? a.id ?? 0) - Number(b.sort_order ?? b.id ?? 0));
  }
  return byDay;
}

// RN-SPEC-plans §5.
export function needsScheduleSetup(currentPlan, planDays) {
  return Boolean(currentPlan?.enrollment?.id) && planDays.length > 0 && (currentPlan?.schedule || []).length === 0;
}

export function dayTitle(day) {
  return day.title || `Day ${day.day_number}`;
}

// §6.2: only the runtime reads it (weight prefills).
export function buildExerciseStatsMap(items) {
  const map = {};
  for (const item of items ?? []) {
    if (item.exercise?.id != null) {
      map[item.exercise.id] = { value: item.last_weight_value, unit: item.last_weight_unit || 'lb' };
    }
  }
  return map;
}
