// Pure rules for the Workout hub (RN-SPEC-workout Part A §3, §5, §7), ported
// from the web (WorkoutPage.jsx). ⚠W notes are reproduced on purpose.

// RN-SPEC-time §4.3: device-local Monday…Sunday as YYYY-MM-DD.
export function getCurrentWeekRange(now = new Date()) {
  const start = new Date(now.getTime());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);
  const format = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { startDate: format(start), endDate: format(end) };
}

// §7: weekdays per plan day, de-duplicated by weekday id, sorted by sort_order.
export function scheduledWeekdaysByDayId(schedule) {
  const byDay = {};
  (schedule || []).forEach((item) => {
    const dayId = item?.plan_day?.id;
    const weekday = item?.weekday;
    if (!dayId || !weekday?.id) {
      return;
    }
    const list = (byDay[dayId] = byDay[dayId] || []);
    if (!list.some((existing) => existing.id === weekday.id)) {
      list.push(weekday);
    }
  });
  Object.values(byDay).forEach((list) =>
    list.sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
  );
  return byDay;
}

// §5.3, ⚠W11: counts PLAN DAYS whose id appears in the completed list, so
// duplicates collapse and the count can't exceed the plan's day count.
export function completedThisWeekCount(planDays, completedThisWeekDayIds) {
  const completed = completedThisWeekDayIds || [];
  return (planDays || []).filter((day) => completed.includes(day.id)).length;
}

// §3.1: derived from today's status only. There is no "missed" state here.
export function todayState(todayStatus) {
  if (todayStatus?.already_completed) {
    return 'completed';
  }
  return todayStatus?.is_workout_day ? 'training' : 'rest';
}

export const TODAY_BADGE_LABELS = Object.freeze({
  completed: 'Completed',
  training: 'Training day',
  rest: 'Rest day',
});

// §3.2. ⚠W1: in the rest case plan_day is the NEXT scheduled day, and its
// title still shows even though the badge says nothing is scheduled.
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

// §3.3: the hero Start needs a workout day that isn't done and has an id.
export function showsHeroStart(todayStatus) {
  return Boolean(todayStatus?.is_workout_day && !todayStatus?.already_completed && todayStatus?.plan_day?.id);
}

// §1.2 / RN-SPEC-plans §5.
export function needsSchedule(currentPlan, planDays) {
  return Boolean(currentPlan?.enrollment?.id) && (planDays || []).length > 0 && (currentPlan?.schedule || []).length === 0;
}

export function hubPlanName(currentPlan) {
  return currentPlan?.enrollment?.plan?.name || 'Your plan';
}

// §6.2: exerciseStatsMap[exercise.id] = {value, unit}; used by the runtime.
export function buildExerciseStatsMap(items) {
  const map = {};
  (items || []).forEach((item) => {
    const id = item?.exercise?.id;
    if (id) {
      map[id] = { value: item.last_weight_value, unit: item.last_weight_unit || 'lb' };
    }
  });
  return map;
}

export function plural(count, word) {
  return `${word}${count === 1 ? '' : 's'}`;
}
