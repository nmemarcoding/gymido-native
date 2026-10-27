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

// ---- v2 Phase 4 §1 (UX H) -------------------------------------------------

// The active card puts the category top-right (as drawn), so its days line
// is the code's text without the " · {category}" tail.
export function activePlanDaysLabel(plan) {
  return plan?.days_per_week ? `${plan.days_per_week} training days / week` : 'Your active routine';
}

// Tablet: "Strength · 4 days / week" (category first when there is one).
export function activePlanSubline(plan) {
  const parts = [];
  if (plan?.category?.name) {
    parts.push(plan.category.name);
  }
  if (plan?.days_per_week) {
    parts.push(`${plan.days_per_week} days / week`);
  }
  return parts.join(' · ');
}

// The active card's week: all 7 weekdays, each flagged when the schedule
// trains on it (with the scheduled day's title, if any). Empty when the
// schedule has no valid weekday (the card then hides "Your week").
export function weekChips(schedule) {
  const byId = new Map();
  for (const item of schedule ?? []) {
    const id = Number(item?.weekday?.id);
    if (id >= 1 && id <= 7 && !byId.has(id)) {
      byId.set(id, item?.plan_day?.title || '');
    }
  }
  if (byId.size === 0) {
    return [];
  }
  return WEEKDAYS.map((weekday) => ({ ...weekday, training: byId.has(weekday.id), title: byId.get(weekday.id) ?? '' }));
}

// "Training days: Monday, Tuesday" (the chips' group label, full names).
export function trainingDaysLabel(chips) {
  return `Training days: ${chips.filter((chip) => chip.training).map((chip) => chip.name).join(', ')}`;
}

// The compact prescription under a strip photo: "3×8-10", "3×12", "1 set",
// "Open prescription" (the short form of formatSetSummary; U+00D7).
export function compactSetSummary(item) {
  const summary = item?.target_set_summary;
  if (!summary?.set_count) {
    return 'Open prescription';
  }
  const { set_count: sets, target_reps_min: min, target_reps_max: max } = summary;
  if (min && max && min !== max) {
    return `${sets}×${min}-${max}`;
  }
  if (min) {
    return `${sets}×${min}`;
  }
  return `${sets} ${sets === 1 ? 'set' : 'sets'}`;
}

// "Mon", "Mon and Tue", "Mon, Tue and Wed".
export function joinWithAnd(labels) {
  if (labels.length <= 1) {
    return labels.join('');
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

const WEEK_STATUSES = new Set(['done', 'today', 'upcoming', 'missed', 'rest']);

function weekdayOf(item) {
  const id = Number(item?.weekday?.id);
  return WEEKDAYS.find((weekday) => weekday.id === id) ?? null;
}

// The day-of-month of a "YYYY-MM-DD" date (no time zone maths: the server's
// local date is shown as given). '' when absent or malformed.
export function dayOfMonth(date) {
  const match = /^\d{4}-\d{2}-(\d{2})/.exec(typeof date === 'string' ? date : '');
  return match ? String(Number(match[1])) : '';
}

// Approved #9 "This week" (GET /my-plans/current/week with BE's date +
// status): the training days only (rest days have no card). Returns
// { today, others, done } or null when the week carries no statuses (the
// section is then hidden; the client never guesses a status).
//   today  — the one "today" training day (or null)
//   others — missed and upcoming days, in week order
//   done   — the done days (shown as ONE summary card)
export function thisWeekCards(week, exercisesByDay = {}) {
  const items = Array.isArray(week) ? week : [];
  if (!items.some((item) => WEEK_STATUSES.has(item?.status))) {
    return null;
  }
  const cards = items
    .filter((item) => item?.is_workout_day !== false && item?.plan_day && WEEK_STATUSES.has(item.status) && item.status !== 'rest')
    .map((item) => {
      const weekday = weekdayOf(item);
      const exercises = exercisesByDay[item.plan_day.id] ?? [];
      return {
        key: `${weekday?.id ?? item.date}-${item.plan_day.id}`,
        status: item.status,
        weekday,
        date: dayOfMonth(item.date),
        dayId: item.plan_day.id,
        title: item.plan_day.title || `Day ${item.plan_day.day_number ?? ''}`.trim(),
        exercises,
        meta: weekCardMeta(exercises),
      };
    });
  const done = cards.filter((card) => card.status === 'done');
  return {
    today: cards.find((card) => card.status === 'today') ?? null,
    others: cards.filter((card) => card.status === 'missed' || card.status === 'upcoming'),
    done: done.length
      ? {
          titles: done.map((card) => card.title).join(' · '),
          label: `Done ${joinWithAnd(done.map((card) => card.weekday?.label).filter(Boolean))}`,
        }
      : null,
  };
}

// "5 exercises · Chest, Back, Shoulders" (the This week card meta).
export function weekCardMeta(exercises) {
  const focus = muscleFocus(exercises).slice(0, 3);
  return `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}` + (focus.length ? ` · ${focus.join(', ')}` : '');
}

// The Today card's photo strip: up to 4 cells; past 4 exercises the 4th is
// dimmed with "+n" (n = the exercises not shown in full).
export function stripCells(exercises) {
  if (exercises.length <= 4) {
    return exercises.map((item) => ({ item, more: 0 }));
  }
  return exercises.slice(0, 4).map((item, index) => ({ item, more: index === 3 ? exercises.length - 3 : 0 }));
}

// N3 (BE confirmed): a plan's optional `thumbnail` {url, media_type}; only
// an image is drawn (a video or an empty URL → the gradient card).
export function planPhotoUrl(plan) {
  const thumbnail = plan?.thumbnail;
  const url = typeof thumbnail?.url === 'string' ? thumbnail.url.trim() : '';
  if (!url) {
    return null;
  }
  const type = typeof thumbnail.media_type === 'string' ? thumbnail.media_type.toLowerCase() : 'image';
  return type.startsWith('image') ? url : null;
}
