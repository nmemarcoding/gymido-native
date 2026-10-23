// Derived data and copy for S1 (plans list) and S2 (plan detail),
// RN-SPEC-plans §3.2, §4 and §10. Pure, so it can be tested.

export const WEEKDAYS = Object.freeze([
  { id: 1, label: 'Mon', name: 'Monday' },
  { id: 2, label: 'Tue', name: 'Tuesday' },
  { id: 3, label: 'Wed', name: 'Wednesday' },
  { id: 4, label: 'Thu', name: 'Thursday' },
  { id: 5, label: 'Fri', name: 'Friday' },
  { id: 6, label: 'Sat', name: 'Saturday' },
  { id: 7, label: 'Sun', name: 'Sunday' },
]);

// §3.2, exactly. Groups use a plain object read back with Object.entries,
// so numeric category names come first in ascending order, then the rest
// in first-appearance order.
export function deriveLibrary(plans, currentPlan) {
  const activePlanId = currentPlan?.enrollment?.plan?.id;
  const hasActivePlan = Boolean(currentPlan?.enrollment?.plan);
  const activePlanDetail = plans.find((plan) => plan.id === activePlanId) ?? currentPlan?.enrollment?.plan ?? null;

  const seen = new Set();
  const activeWeekdays = (currentPlan?.schedule ?? [])
    .map((item) => item.weekday)
    .filter((weekday) => {
      if (!weekday?.name || seen.has(weekday.id)) {
        return false;
      }
      seen.add(weekday.id);
      return true;
    })
    .sort((a, b) => Number(a.sort_order ?? a.id ?? 0) - Number(b.sort_order ?? b.id ?? 0));

  const browsable = plans.filter((plan) => plan.is_active && plan.id !== activePlanId);
  const grouped = browsable.reduce((acc, plan) => {
    const key = plan.category?.name || 'Plans';
    acc[key] = acc[key] ?? [];
    acc[key].push(plan);
    return acc;
  }, {});
  const groups = Object.entries(grouped);

  return {
    activePlanId,
    hasActivePlan,
    activePlanDetail,
    activeWeekdays,
    groups,
    browseCount: browsable.length,
    showCategoryHeaders: groups.length > 1,
    noPlansAtAll: plans.length === 0,
  };
}

// §3.4: still days_per_week after W1b (W1c).
export function activePlanSummary(plan) {
  const days = plan?.days_per_week ? `${plan.days_per_week} training days / week` : 'Your active routine';
  return days + (plan?.category?.name ? ` · ${plan.category.name}` : '');
}

// §3.6: a missing value keeps the leading space.
export function planCardDaysLabel(plan) {
  return `${plan?.days_per_week ?? ''} days / week`;
}

export function planCountLabel(count) {
  return `${count} plan${count === 1 ? '' : 's'}`;
}

// §4.4. "×" is U+00D7. Dated changes (23 Oct): equal ends read "12 reps",
// and one set reads "1 set" (⚠15 retired).
export function formatSetSummary(item) {
  const summary = item?.target_set_summary;
  if (!summary?.set_count) {
    return 'Open prescription';
  }
  let reps;
  if (summary.target_reps_min && summary.target_reps_max && summary.target_reps_min !== summary.target_reps_max) {
    reps = `${summary.target_reps_min}-${summary.target_reps_max} reps`;
  } else if (summary.target_reps_min) {
    reps = `${summary.target_reps_min} reps`;
  } else {
    reps = 'Reps open';
  }
  return `${summary.set_count} ${summary.set_count === 1 ? 'set' : 'sets'} × ${reps}`;
}

export function estimateMinutes(exercises) {
  if (!exercises.length) {
    return null;
  }
  const sets = exercises.reduce((sum, item) => sum + (Number(item.target_set_summary?.set_count) || 3), 0);
  return Math.max(10, Math.round((sets * 3.5) / 5) * 5);
}

// Distinct primary muscle names in first-appearance order.
export function muscleFocus(exercises) {
  const names = [];
  for (const item of exercises) {
    const name = item.exercise?.primary_muscle_group?.name;
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export function dayMetaLabel(count, minutes) {
  return `${count} exercise${count === 1 ? '' : 's'}` + (minutes ? ` · ~${minutes} min` : '');
}

// §4.4 dated change (23 Oct): the plan exercise's notes, trimmed; blank → ''.
export function exerciseNotes(item) {
  return typeof item?.notes === 'string' ? item.notes.trim() : '';
}

export function exerciseDetailId(item) {
  return item?.exercise_id ?? item?.exercise?.id;
}

// §4.2 weekday pre-selection.
export function initialWeekdays({ currentPlan, plan, requiredDays }) {
  const isCurrent = currentPlan?.enrollment?.plan?.id === plan?.id;
  if (isCurrent) {
    const ids = [];
    for (const item of currentPlan?.schedule ?? []) {
      const id = item.weekday?.id;
      if (id >= 1 && id <= 7 && !ids.includes(id)) {
        ids.push(id);
      }
    }
    ids.sort((a, b) => a - b);
    const saved = ids.slice(0, requiredDays);
    if (saved.length) {
      return saved;
    }
  }
  return WEEKDAYS.slice(0, requiredDays).map((weekday) => weekday.id);
}

// §4.6 toggle rules: a tap past the limit does nothing (⚠14).
export function toggleWeekday(selected, id, requiredDays) {
  if (selected.includes(id)) {
    return selected.filter((value) => value !== id);
  }
  if (selected.length >= requiredDays) {
    return selected;
  }
  return [...selected, id].sort((a, b) => a - b);
}

// S2 lists short labels; S3 lists full day names (`fullNames`, block 3 G1).
export function selectedWeekdaysLabel(selected, fullNames = false) {
  const labels = WEEKDAYS.filter((weekday) => selected.includes(weekday.id)).map((weekday) =>
    fullNames ? weekday.name : weekday.label
  );
  return `Selected: ${labels.join(', ') || 'None yet'}`;
}

export function workoutDaysLabel(count) {
  return `${count} workout day${count === 1 ? '' : 's'}`;
}

// §4.7: day 1 → the earliest selected weekday, and so on (⚠1).
export function buildScheduleItems(days, selected, requiredDays) {
  return days.slice(0, requiredDays).map((day, index) => ({ workout_plan_day_id: day.id, weekday_id: selected[index] }));
}

// ⚠7: the UTC calendar date of the device clock, not the local date.
export function todayUTC(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
