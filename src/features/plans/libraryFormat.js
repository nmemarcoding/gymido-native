import { notStartedCaption, slotState, weekByDate } from './weekByDate';
import { formatCount } from '../../shared/format/counts';

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
  const days = plan?.days_per_week ? `${formatCount(plan.days_per_week, 'training day', 'training days')} / week` : 'Your active routine';
  return days + (plan?.category?.name ? ` · ${plan.category.name}` : '');
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
  return formatCount(count, 'workout day', 'workout days');
}

// §4.7: day 1 → the earliest selected weekday, and so on (⚠1).
export function buildScheduleItems(days, selected, requiredDays) {
  return days.slice(0, requiredDays).map((day, index) => ({ workout_plan_day_id: day.id, weekday_id: selected[index] }));
}

// ---- v2 Phase 4 §1 (UX H) -------------------------------------------------

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
// { today, others, open, done, notStarted, caption } or null when the week
// carries no statuses (the section is then hidden; the client never guesses
// a status).
// T-81 (PM ruling 3, RN-SPEC T-81): each slot's state is slotState() — done =
// the server's slot status "done" (that plan day done this week, any date),
// notStarted = a slot dated before enrollment.started_on, missed = a past
// slot not done, else today / upcoming. A training slot before started_on
// comes back from the server as "rest"; it gets a (quiet) Not started card.
//   today      — the one "today" training day (or null)
//   others     — missed and upcoming days, in week order
//   open       — today, missed and upcoming, in week order (M6)
//   done       — the done days (shown as ONE summary card)
//   notStarted — the slots before started_on, in week order, drawn LAST
//                (after Done): they need no action and are not missed, so
//                they never sit above Today or beside a Missed card
//   caption    — "Your plan started {Weekday}." while a notStarted card shows
export function thisWeekCards(week, exercisesByDay = {}, { startedOn = null, now = new Date() } = {}) {
  const items = Array.isArray(week) ? week : [];
  if (!items.some((item) => WEEK_STATUSES.has(item?.status))) {
    return null;
  }
  const cards = items
    .filter((item) => item?.is_workout_day !== false && item?.plan_day && WEEK_STATUSES.has(item.status))
    .map((item) => ({ item, status: slotState({ item, startedOn, now }) }))
    .filter(({ item, status }) => item.status !== 'rest' || (status === 'notStarted' && item.is_workout_day === true))
    .map(({ item, status }) => {
      const weekday = weekdayOf(item);
      const exercises = exercisesByDay[item.plan_day.id] ?? [];
      return {
        key: `${weekday?.id ?? item.date}-${item.plan_day.id}`,
        status,
        weekday,
        date: dayOfMonth(item.date),
        dayId: item.plan_day.id,
        title: item.plan_day.title || `Day ${item.plan_day.day_number ?? ''}`.trim(),
        exercises,
        meta: weekCardMeta(exercises),
      };
    });
  const done = cards.filter((card) => card.status === 'done');
  const notStarted = cards.filter((card) => card.status === 'notStarted');
  return {
    today: cards.find((card) => card.status === 'today') ?? null,
    others: cards.filter((card) => card.status === 'missed' || card.status === 'upcoming'),
    // Review M6 (web parity, spec 75e618d9): the days not done (missed,
    // today, upcoming) in the API's Monday-start order; nothing moves to the
    // front. The Done card follows them.
    open: cards.filter((card) => card.status === 'today' || card.status === 'missed' || card.status === 'upcoming'),
    done: done.length
      ? {
          titles: done.map((card) => card.title).join(' · '),
          label: `Done ${joinWithAnd(done.map((card) => card.weekday?.label).filter(Boolean))}`,
        }
      : null,
    notStarted,
    caption: notStartedCaption(notStarted.map(() => ({ kind: 'notStarted' })), startedOn),
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

// ---- Dated change (27 Oct 2026, owner T-60): the PHONE Plans page ---------
// (RN-SPEC-v2-phase4 "the Plans page redesign"; UX T60-plans-spec §2–§4).

// The device's LOCAL calendar date as "YYYY-MM-DD" (the /week `date` form).
export function localDateKey(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The local weekday as the API's id (Mon 1 … Sun 7).
function localWeekdayId(now) {
  return now.getDay() === 0 ? 7 : now.getDay();
}

// A VALID GET /my-plans/current/week: an array of the 7 days.
export function isValidWeek(week) {
  return Array.isArray(week) && week.length === 7;
}

function weekItemDayId(item, index) {
  const id = Number(item?.weekday?.id);
  return id >= 1 && id <= 7 ? id : index + 1;
}

// The enrollment schedule's training days, Monday first, one per weekday:
// [{ weekdayId, planDay }].
function scheduledDays(schedule) {
  const byId = new Map();
  for (const item of schedule ?? []) {
    const id = Number(item?.weekday?.id);
    if (id >= 1 && id <= 7 && !byId.has(id)) {
      byId.set(id, item?.plan_day ?? null);
    }
  }
  return [...byId.entries()].sort((a, b) => a[0] - b[0]).map(([weekdayId, planDay]) => ({ weekdayId, planDay }));
}

// "Your week": 7 circles Monday first or null (the week hides; never seven
// rest days). Each circle: { id, key, letter, short, kind, label, count,
// training, today, a11y } — `label` is the text under the circle, `a11y`
// the day's screen-reader label.
// - T-81 (PM ruling 4): with a valid /week AND the week's completed workouts
//   (an array), the shared DATE strip = weekByDate(): done (on the day you
//   trained, any workout, ×n when count > 1) · notStarted · missed · today ·
//   train · rest. Null when no day is a training day and none is done.
// - A valid /week without the completed workouts (that call failed) keeps the
//   pre-T-81 strip: training = is_workout_day AND status ≠ rest (a training
//   weekday before the enrollment comes back as rest); today = the entry
//   dated the device's local date. No training day → null.
// - Only a missing/failed /week falls back to the enrollment schedule (today
//   = the local weekday); no schedule day → null.
export function weekCircles({ week, schedule, completed, startedOn, now = new Date() }) {
  if (isValidWeek(week) && Array.isArray(completed)) {
    const cells = weekByDate({ week, completed, startedOn, now });
    if (!cells || !cells.some((cell) => cell.training || cell.kind === 'done')) {
      return null;
    }
    return cells.map((cell) => ({ ...cell, id: Number(cell.key), today: cell.isToday }));
  }
  const circle = (id, training, today) => {
    const weekday = WEEKDAYS[id - 1];
    const kind = today ? (training ? 'today' : 'todayRest') : training ? 'train' : 'rest';
    return {
      id,
      key: String(id),
      letter: weekday.label[0],
      short: weekday.label,
      kind,
      label: today ? 'Today' : training ? 'Train' : 'Rest',
      count: 0,
      training,
      today,
      a11y: `${weekday.label}: ${training ? 'training' : 'rest'}${today ? ', today' : ''}`,
    };
  };
  if (isValidWeek(week)) {
    const todayKey = localDateKey(now);
    const circles = week.map((item, index) =>
      circle(weekItemDayId(item, index), item?.is_workout_day === true && item?.status !== 'rest', Boolean(item?.date) && item.date === todayKey)
    );
    return circles.some((entry) => entry.training) ? circles : null;
  }
  const days = new Set(scheduledDays(schedule).map((day) => day.weekdayId));
  if (days.size === 0) {
    return null;
  }
  const todayId = localWeekdayId(now);
  return WEEKDAYS.map((weekday) => circle(weekday.id, days.has(weekday.id), weekday.id === todayId));
}

// The circle's screen-reader label: "Mon: training", "Thu: training, today"
// (pre-T-81 strip), "Wed: done, 2 workouts", "Mon: not started" (T-81).
export function weekDayLabel(circle) {
  return circle.a11y;
}

// The day title as Today shows it: the title, else "Day {n}".
export function planDayTitle(planDay) {
  return planDay?.title || `Day ${planDay?.day_number ?? ''}`.trim();
}

// §2a "Next workout": { when: 'Today' | 'Mon'…, planDay, gold } or null (the
// row and Start hide). `today` = GET /my-plans/current/today (null when it
// failed), `week` = GET /week (null when it failed), `schedule` = the
// enrollment schedule (GET /my-plans/current).
export function nextWorkout({ today, week, schedule, now = new Date() }) {
  const validWeek = isValidWeek(week) ? week : null;
  const todayKey = localDateKey(now);
  const todayId = localWeekdayId(now);
  const days = scheduledDays(schedule).filter((day) => day.planDay);
  const glass = (weekdayId, planDay) => ({ when: WEEKDAYS[weekdayId - 1].label, planDay, gold: false });
  // The schedule's NEXT training weekday after today, else (wrapping past
  // Sunday) its first.
  const nextScheduled = (list) => list.find((day) => day.weekdayId > todayId) ?? list[0] ?? null;
  const weekItems = (validWeek ?? []).map((item, index) => ({ item, weekdayId: weekItemDayId(item, index) }));
  const firstUpcoming = weekItems.find(({ item }) => item?.status === 'upcoming' && item?.plan_day);
  const action = today?.action;

  if (action === 'start_workout' && today.plan_day) {
    return { when: 'Today', planDay: today.plan_day, gold: true };
  }
  if (action === 'already_completed') {
    // The first upcoming day in /week, else wrap to the schedule's FIRST
    // training day (Monday first; also when /week is missing). Nothing → null.
    if (firstUpcoming) {
      return glass(firstUpcoming.weekdayId, firstUpcoming.item.plan_day);
    }
    return days[0] ? glass(days[0].weekdayId, days[0].planDay) : null;
  }
  if (action === 'next_workout_day' && today.plan_day) {
    const id = today.plan_day.id;
    const later = weekItems.find(({ item }) => item?.plan_day?.id === id && (item.date ? item.date > todayKey : item.status === 'upcoming'));
    if (later) {
      return glass(later.weekdayId, today.plan_day);
    }
    const next = nextScheduled(days.filter((day) => day.planDay.id === id));
    return next ? glass(next.weekdayId, today.plan_day) : null;
  }
  // /today missing or failed: /week's today item (gold), else its first upcoming.
  const todayItem = weekItems.find(({ item }) => item?.status === 'today' && item?.plan_day);
  if (todayItem) {
    return { when: 'Today', planDay: todayItem.item.plan_day, gold: true };
  }
  return firstUpcoming ? glass(firstUpcoming.weekdayId, firstUpcoming.item.plan_day) : null;
}

// The level name for a plan's difficulty_level_id (one GET
// /exercise-difficulty-levels per load); null when either is missing.
export function levelNameOf(plan, levels) {
  const id = plan?.difficulty_level_id;
  if (id == null || !Array.isArray(levels)) {
    return null;
  }
  return levels.find((level) => String(level?.id) === String(id))?.name || null;
}

function daysAWeek(plan) {
  return plan?.days_per_week ? `${formatCount(plan.days_per_week, 'day', 'days')} a week` : '';
}

// Active card meta "{category} · {n} days a week · {level}"; parts drop out.
export function activePlanMeta(plan, level) {
  return [plan?.category?.name, daysAWeek(plan), level].filter(Boolean).join(' · ');
}

// The same meta as three parts (QA T60-1): the card lays them out in one row
// so the LEVEL truncates first and "{n} days a week" never cuts.
export function activePlanMetaParts(plan, level) {
  const category = plan?.category?.name || '';
  const days = daysAWeek(plan) || '';
  return { category, days, level: level || '', label: activePlanMeta(plan, level) };
}

// Catalog card meta "{n} days a week · {level}".
export function catalogMeta(plan, level) {
  return [daysAWeek(plan), level].filter(Boolean).join(' · ');
}

// "5 exercises" / "1 exercise" (U+00A0); '' when the count is unknown.
export function exercisesCountLabel(count) {
  return typeof count === 'number' && Number.isFinite(count) ? formatCount(count, 'exercise', 'exercises') : '';
}

// The catalog without per-category sub-headings: the same plans in the same
// order as the grouped list.
export function catalogPlans(library) {
  return library.groups.flatMap(([, plans]) => plans);
}
