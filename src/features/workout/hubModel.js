import { formatCount, keepUnitsTogether } from '../../shared/format/counts';
import { WEEKDAYS, isValidWeek, joinWithAnd, localDateKey, muscleFocus, planDayTitle } from '../plans/libraryFormat';
import { needsScheduleSetup, scheduledWeekdaysByDayId } from './workoutFormat';

// T-76 Workout hub redesign (owner brief + UX check + PM rulings, 28 Oct
// 2026). Pure derivations, so web and native can be held to the same rules:
// the week strip, "X of Y done" and Up next come from GET
// /my-plans/current/week (never re-derived from history); /workouts
// (completed, this week) gives only the ✓ Done rows and today's duration.

// The page's one state (RN-SPEC-workout T-76 "Hub state", shared with web).
// Loading and failed are the screen's own; a live session never reaches the
// hub (the runtime replaces it). `week` is the effective week (effectiveWeek).
export function hubState({ currentPlan, todayStatus, planDays = [], week }) {
  if (!currentPlan?.enrollment?.plan) {
    return 'noPlan';
  }
  if (needsScheduleSetup(currentPlan, planDays)) {
    return 'noSchedule';
  }
  if (todayStatus?.is_workout_day && !todayStatus?.already_completed && todayStatus?.plan_day?.id) {
    return 'training';
  }
  const progress = weekProgress(week);
  if (progress && progress.total > 0 && progress.done >= progress.total) {
    return 'weekComplete';
  }
  if (todayStatus?.already_completed) {
    return 'todayDone';
  }
  return 'rest';
}

// The week the hub draws: GET /my-plans/current/week as is; when that call
// failed, built from the schedule and this week's completed plan day ids by
// the device's date (done if the slot's day was completed, else today /
// missed (past) / upcoming (later); no slot = rest). No schedule → null.
export function effectiveWeek({ week, schedule, doneIds = [], now = new Date() }) {
  if (isValidWeek(week)) {
    return week;
  }
  const slots = scheduleDays(schedule);
  if (!slots.length) {
    return null;
  }
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const todayKey = localDateKey(now);
  return WEEKDAYS.map((weekday, index) => {
    const date = localDateKey(addDays(monday, index));
    const planDay = slots.find((slot) => slot.weekday.id === weekday.id)?.planDay ?? null;
    let status = 'rest';
    if (planDay) {
      status = doneIds.includes(planDay.id) ? 'done' : date === todayKey ? 'today' : date < todayKey ? 'missed' : 'upcoming';
    }
    return { weekday: { id: weekday.id }, date, status, is_workout_day: Boolean(planDay), plan_day: planDay };
  });
}

function weekdayAt(item, index) {
  const id = Number(item?.weekday?.id);
  return WEEKDAYS[(id >= 1 && id <= 7 ? id : index + 1) - 1];
}

// "X of Y done": Y = this week's slots whose status is not rest, X = the done
// ones (missed counts as not done). null without a week (the card hides).
export function weekProgress(week) {
  if (!isValidWeek(week)) {
    return null;
  }
  const slots = week.filter((item) => item?.status && item.status !== 'rest');
  return { done: slots.filter((item) => item.status === 'done').length, total: slots.length };
}

const STRIP_LABELS = Object.freeze({
  done: 'Done',
  today: 'Today',
  todayRest: 'Today',
  missed: 'Missed',
  train: 'Train',
  rest: 'Rest',
});

// The Mon–Sun strip: [{ key, letter, label, kind, a11y }] or null. Kinds:
// done (teal tick), today (gold), todayRest (gold outline), missed (dashed),
// train (outlined), rest (grey letter).
export function weekStrip(week, now = new Date()) {
  if (!isValidWeek(week)) {
    return null;
  }
  const todayKey = localDateKey(now);
  return week.map((item, index) => {
    const weekday = weekdayAt(item, index);
    const isToday = item?.date ? item.date === todayKey : item?.status === 'today';
    const kind =
      item?.status === 'done'
        ? 'done'
        : item?.status === 'missed'
          ? 'missed'
          : item?.status === 'today' || (isToday && item?.status === 'upcoming')
            ? 'today'
            : item?.status === 'upcoming'
              ? 'train'
              : isToday
                ? 'todayRest'
                : 'rest';
    const words = {
      done: isToday ? 'today, done' : 'done',
      today: 'today, training',
      todayRest: 'today, rest',
      missed: 'missed',
      train: 'training',
      rest: 'rest',
    };
    return { key: String(weekday.id), letter: weekday.label[0], label: STRIP_LABELS[kind], kind, a11y: `${weekday.label}: ${words[kind]}` };
  });
}

function addDays(now, days) {
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  return next;
}

// The schedule's training days, Monday first: [{ weekday, planDay }].
function scheduleDays(schedule) {
  const byId = new Map();
  for (const item of schedule ?? []) {
    const id = Number(item?.weekday?.id);
    if (id >= 1 && id <= 7 && item?.plan_day && !byId.has(id)) {
      byId.set(id, item.plan_day);
    }
  }
  return [...byId.entries()].sort((a, b) => a[0] - b[0]).map(([id, planDay]) => ({ weekday: WEEKDAYS[id - 1], planDay }));
}

function exercisesCount(planDay, planDays) {
  const listed = planDays.find((day) => day.id === planDay?.id);
  return listed?.exercises_count ?? planDay?.exercises_count ?? null;
}

function nextRow(planDay, when, planDays) {
  const count = exercisesCount(planDay, planDays);
  return {
    dayId: planDay.id,
    title: planDayTitle(planDay),
    when,
    meta: count == null ? when : `${when} · ${formatCount(count, 'exercise', 'exercises')}`,
  };
}

// Up next: the first /week item after today with status "upcoming"; none
// left this week → next week's first training day from the schedule. When
// /week is missing, the schedule's next weekday after today (wrapping).
export function upNext({ week, schedule, planDays = [], now = new Date() }) {
  const tomorrowKey = localDateKey(addDays(now, 1));
  if (isValidWeek(week)) {
    const index = week.findIndex((item) => item?.status === 'upcoming' && item?.plan_day);
    if (index >= 0) {
      const item = week[index];
      return nextRow(item.plan_day, item.date === tomorrowKey ? 'Tomorrow' : weekdayAt(item, index).name, planDays);
    }
    const first = scheduleDays(schedule)[0];
    return first ? nextRow(first.planDay, first.weekday.name, planDays) : null;
  }
  const days = scheduleDays(schedule);
  const todayId = now.getDay() === 0 ? 7 : now.getDay();
  const next = days.find((day) => day.weekday.id > todayId) ?? days[0];
  if (!next) {
    return null;
  }
  return nextRow(next.planDay, next.weekday.id === (todayId % 7) + 1 ? 'Tomorrow' : next.weekday.name, planDays);
}

// Week complete: "All X workouts done. Next week starts {weekday} with {day}."
export function weekCompleteDetail(progress, schedule) {
  const total = progress?.total ?? 0;
  const first = scheduleDays(schedule)[0];
  const done = `All ${formatCount(total, 'workout', 'workouts')} done.`;
  return first ? `${done} Next week starts ${first.weekday.name} with ${planDayTitle(first.planDay)}.` : done;
}

// Today done: the duration of today's completed workout for today's day, in
// whole minutes; null when there is none or it carries no duration.
export function todayDurationMinutes(completed, dayId, now = new Date()) {
  const todayKey = localDateKey(now);
  const matches = (completed ?? []).filter((item) => {
    if (item?.workout_plan_day_id !== dayId || !item?.completed_at) {
      return false;
    }
    const at = new Date(item.completed_at);
    return !Number.isNaN(at.getTime()) && localDateKey(at) === todayKey;
  });
  const latest = matches.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
  const seconds = Number(latest?.duration_seconds);
  return latest && Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
}

// "Nice work. 6 exercises · 52 min." (no duration → no minutes).
export function todayDoneDetail(count, minutes) {
  const exercises = formatCount(count ?? 0, 'exercise', 'exercises');
  return keepUnitsTogether(`Nice work. ${exercises}${minutes ? ` · ${minutes} min` : ''}.`);
}

// "Chest, back and arms": the distinct primary muscle groups in plan order,
// at most 4, the first capitalised and the rest lower case.
export function muscleLine(exercises) {
  const names = muscleFocus(exercises ?? []).slice(0, 4).map((name, index) => (index === 0 ? name : name.toLowerCase()));
  return joinWithAnd(names);
}

// "6 exercises · Chest, back and arms" (the muscles once the day's exercises
// have loaded).
export function todayMeta(count, exercises) {
  const label = formatCount(count ?? exercises?.length ?? 0, 'exercise', 'exercises');
  const muscles = muscleLine(exercises);
  return muscles ? `${label} · ${muscles}` : label;
}

// The Other days block per state: title, help line and screen-reader list name.
export const OTHER_DAYS_COPY = Object.freeze({
  training: { title: 'Other days', help: "Not feeling today's? Tap any day to start it instead." },
  rest: { title: 'Train anyway?', help: 'Tap a day to start it now.' },
  todayDone: { title: 'Other days', help: 'Want more? Tap a day to start it.' },
  weekComplete: { title: 'Extra session', help: 'Tap a day to do it again.' },
  noSchedule: { title: 'Or start now', help: 'Tap any day to start it.' },
});

// One row per plan day: not done first, then done (each in plan order).
// Today's day is left out while it is a not-done training day (ruling (b)).
// Done comes from this week's completed workouts (workout_plan_day_id).
export function dayRows({ planDays = [], schedule, doneIds = [], state, todayDayId }) {
  const weekdays = scheduledWeekdaysByDayId(schedule);
  const rows = planDays
    .filter((day) => !(state === 'training' && day.id === todayDayId && !doneIds.includes(day.id)))
    .map((day) => {
      const names = (weekdays[day.id] ?? []).map((weekday) => WEEKDAYS[Number(weekday.id) - 1]?.name).filter(Boolean);
      const when = names.length ? joinWithAnd(names) : 'Any day';
      const title = planDayTitle(day);
      const done = doneIds.includes(day.id);
      return {
        dayId: day.id,
        title,
        done,
        meta: `${when} · ${formatCount(day.exercises_count ?? 0, 'exercise', 'exercises')}`,
        action: `${done ? 'Repeat' : 'Start'} ${title}`,
      };
    });
  return [...rows.filter((row) => !row.done), ...rows.filter((row) => row.done)];
}
