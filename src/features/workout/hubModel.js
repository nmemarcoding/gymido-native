import { formatCount, keepUnitsTogether } from '../../shared/format/counts';
import { WEEKDAYS, isValidWeek, joinWithAnd, localDateKey, muscleFocus, planDayTitle } from '../plans/libraryFormat';
import { notStartedCaption, weekByDate, weekProgressByDate } from '../plans/weekByDate';
import { needsScheduleSetup, scheduledWeekdaysByDayId } from './workoutFormat';

// T-76 Workout hub redesign (owner brief + UX check + PM rulings, 28 Oct
// 2026). Pure derivations, so web and native can be held to the same rules.
// T-81 (PM "DECIDED" + RN-SPEC T-81, 28 Oct): with a valid GET
// /my-plans/current/week the strip is a calendar of what the member did
// (plans/weekByDate: this week's completed workouts by the local date of
// started_at, enrollment.started_on) and "X of Y" / week complete are
// weekProgressByDate. Without /week the schedule + history fallback stays
// exactly as before T-81 (weekStrip / weekProgress on effectiveWeek). Up next
// still reads the /week slot status; the ✓ Done rows stay "a plan day done
// this week".

// The page's one state (RN-SPEC-workout T-76 "Hub state", shared with web).
// Loading and failed are the screen's own; a live session never reaches the
// hub (the runtime replaces it). `week` is the effective week (effectiveWeek);
// `byDate` = it is the server's /week (T-81 rule), false for the fallback.
export function hubState({ currentPlan, todayStatus, planDays = [], week, byDate = true }) {
  if (!currentPlan?.enrollment?.plan) {
    return 'noPlan';
  }
  if (needsScheduleSetup(currentPlan, planDays)) {
    return 'noSchedule';
  }
  if (todayStatus?.is_workout_day && !todayStatus?.already_completed && todayStatus?.plan_day?.id) {
    return 'training';
  }
  if (weekIsComplete({ week, byDate, startedOn: currentPlan.enrollment.started_on })) {
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

// Week complete: T-81 Y > 0 && X == Y (Y from started_on) on the server's
// /week; the pre-T-81 rule (every non-rest slot done) on the fallback.
function weekIsComplete({ week, byDate, startedOn }) {
  if (byDate) {
    return Boolean(weekProgressByDate({ week, startedOn })?.complete);
  }
  const progress = weekProgress(week);
  return Boolean(progress && progress.total > 0 && progress.done >= progress.total);
}

// The hub's "This week" card: { week, byDate, progress, strip, caption }.
// With a valid /week: weekByDate + weekProgressByDate + the Not-started
// caption. Without it: the fallback week through weekStrip / weekProgress (no
// Not started, no ×n, no caption). `week` is effectiveWeek's result (up next
// and the state read it); strip / progress are null when there is none.
export function hubWeek({ week, schedule, doneIds = [], completed = [], startedOn, now = new Date() }) {
  const weekNow = effectiveWeek({ week, schedule, doneIds, now });
  if (isValidWeek(week)) {
    const strip = weekByDate({ week, completed, startedOn, now });
    return { week: weekNow, byDate: true, progress: weekProgressByDate({ week, startedOn }), strip, caption: notStartedCaption(strip, startedOn) };
  }
  return { week: weekNow, byDate: false, progress: weekProgress(weekNow), strip: weekStrip(weekNow, now), caption: null };
}

function weekdayAt(item, index) {
  const id = Number(item?.weekday?.id);
  return WEEKDAYS[(id >= 1 && id <= 7 ? id : index + 1) - 1];
}

// The /week-failed FALLBACK's "X of Y done" (T-81 keeps it as is): Y = the
// slots whose status is not rest, X = the done ones (missed = not done).
// null without a week (the card hides).
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

// The /week-failed FALLBACK's Mon–Sun strip (T-81 keeps it as is; the
// server's /week goes through weekByDate): [{ key, letter, label, kind, a11y }]
// or null. Kinds:
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
    // Next week's first training day: "Tomorrow" when that is the next
    // calendar day (Sunday → Monday), else its weekday.
    const first = scheduleDays(schedule)[0];
    if (!first) {
      return null;
    }
    const monday = addDays(now, 7 - ((now.getDay() + 6) % 7));
    const date = localDateKey(addDays(monday, first.weekday.id - 1));
    return nextRow(first.planDay, date === tomorrowKey ? 'Tomorrow' : first.weekday.name, planDays);
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
  // UX T-81 LOW: "1 workout done." for one; "All N workouts done." for N ≥ 2.
  const count = formatCount(total, 'workout', 'workouts');
  const done = total === 1 ? `${count} done.` : `All ${count} done.`;
  return first ? `${done} Next week starts ${first.weekday.name} with ${planDayTitle(first.planDay)}.` : done;
}

// Today done: the duration of today's completed workout for today's day, in
// whole minutes (at least 1); null when there is none or it has no duration.
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
  const raw = latest?.duration_seconds;
  const seconds = raw == null ? NaN : Number(raw);
  // A stored duration, even 0 s, shows at least "1 min" (shared rule).
  return Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, Math.round(seconds / 60)) : null;
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

// One row per plan day: not done first, then done (each in plan order; in
// "today done" today's day comes last). Today's day is left out while it is a not-done training
// day (ruling (b)).
// Done comes from this week's completed workouts (workout_plan_day_id).
// T-73 D2 (RN-SPEC-workout, 28 Oct): a day on several weekdays shows only its
// NEXT scheduled weekday from today (today included), else its first one next
// week (Tue + Thu: Mon/Tue → Tuesday, Wed/Thu → Thursday, Fri–Sun → Tuesday);
// the same schedule source as Up next. Unscheduled → "Any day".
function nextScheduledWeekdayName(weekdays, now) {
  const todayId = now.getDay() === 0 ? 7 : now.getDay();
  const ids = weekdays.map((weekday) => Number(weekday.id)).filter((id) => WEEKDAYS[id - 1]).sort((a, b) => a - b);
  if (!ids.length) {
    return null;
  }
  const id = ids.find((value) => value >= todayId) ?? ids[0];
  return WEEKDAYS[id - 1].name;
}

// T-102 (rest only): this week's open-miss plan days sort FIRST, most recent
// miss first, then the usual order; their meta reads "Missed {Weekday} · n
// exercises" and the row's name "Start {title}, missed {Weekday}". `misses`
// = weekMisses(); a day missed twice takes its most recent miss.
export function dayRows({ planDays = [], schedule, doneIds = [], state, todayDayId, misses = [], week = null, completed = [], now = new Date() }) {
  // T-116: a rest day's "Train anyway?" is this week's slots (restWeekRows).
  if (state === 'rest' && isValidWeek(week)) {
    return restWeekRows({ week, planDays, completed, now });
  }
  const weekdays = scheduledWeekdaysByDayId(schedule);
  const rows = planDays
    .filter((day) => !(state === 'training' && day.id === todayDayId && !doneIds.includes(day.id)))
    .map((day) => {
      const when = nextScheduledWeekdayName(weekdays[day.id] ?? [], now) ?? 'Any day';
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
  // "Today done": today's day is the LAST of the done rows (shared rule);
  // every other state keeps plan order inside each group.
  const done = rows.filter((row) => row.done);
  const isToday = (row) => state === 'todayDone' && row.dayId === todayDayId;
  const lastDone = [...done.filter((row) => !isToday(row)), ...done.filter(isToday)];
  const ordered = [...rows.filter((row) => !row.done), ...lastDone];
  if (state !== 'rest' || !misses.length) {
    return ordered;
  }
  const missedRows = [];
  for (const miss of misses) {
    const row = ordered.find((item) => item.dayId === miss.planDay?.id);
    if (row && !missedRows.some((item) => item.dayId === row.dayId)) {
      const count = planDays.find((day) => day.id === row.dayId)?.exercises_count ?? 0;
      missedRows.push({
        ...row,
        done: false,
        missedWeekday: miss.weekdayName,
        meta: `Missed ${miss.weekdayName} · ${formatCount(count, 'exercise', 'exercises')}`,
        action: `Start ${row.title}, missed ${miss.weekdayName}`,
      });
    }
  }
  return [...missedRows, ...ordered.filter((row) => !missedRows.some((item) => item.dayId === row.dayId))];
}

// T-116 (owner; UX T116 ruling; RN-SPEC-workout dated 29 Oct, web 2.1.8): on a
// rest day "Train anyway?" = this week's training slots (the strip's week),
// Mon → Sun, today's slot left out; one row per slot. done → "✓ Done ·
// {Weekday} · n" (Repeat); before today + missed → "Missed · {Weekday} · n"
// (muted, the catch-up confirm); after today → "Tomorrow" / "Upcoming". A past
// slot that is neither isn't listed. Keyed by the slot's date.
// T-118 (UX): a done slot was made up when a workout of that day STARTED on a
// LATER local date and none on the slot's own date: "✓ Made up · {Weekday} ·
// n" (teal). Done EARLY ("Start … early", reviewer M1) or on the day = "✓ Done".
// No completed workouts loaded → "Done" (never a guess).
// T-116 N1: `testKey` = the day id, plus the date for a plan day's 2nd slot.
export function restWeekRows({ week, planDays = [], completed = [], now = new Date() }) {
  const todayKey = localDateKey(now);
  const tomorrowKey = localDateKey(addDays(now, 1));
  // The local start dates of this week's completed workouts of a plan day.
  const startDates = (dayId) =>
    completed.flatMap((workout) => {
      const at = workout?.started_at ? new Date(workout.started_at) : null;
      return workout?.workout_plan_day_id === dayId && at && !Number.isNaN(at.getTime()) ? [localDateKey(at)] : [];
    });
  const seen = new Set();
  const rows = week.flatMap((item, index) => {
    const planDay = item?.plan_day;
    if (!item?.is_workout_day || !planDay || typeof item.date !== 'string' || item.date === todayKey) {
      return [];
    }
    const weekday = weekdayAt(item, index).name;
    const count = formatCount(exercisesCount(planDay, planDays) ?? 0, 'exercise', 'exercises');
    const title = planDayTitle(planDay);
    const row = { key: item.date, dayId: planDay.id, title, done: false };
    if (item.status === 'done') {
      const dates = startDates(planDay.id);
      const madeUp = !dates.includes(item.date) && dates.some((date) => date > item.date);
      return [{ ...row, done: true, madeUp, meta: `${weekday} · ${count}`, action: `Repeat ${title}` }];
    }
    if (item.date < todayKey) {
      return item.status === 'missed'
        ? [{ ...row, missedWeekday: weekday, mutedMeta: true, meta: `Missed · ${weekday} · ${count}`, action: `Start ${title}, missed ${weekday}` }]
        : [];
    }
    const tomorrow = item.date === tomorrowKey;
    return [
      {
        ...row,
        meta: `${tomorrow ? 'Tomorrow' : 'Upcoming'} · ${weekday} · ${count}`,
        // Web 2.1.9 (PM 29 Oct 2026): a comma before the weekday, like "tomorrow, {Wd}".
        action: tomorrow ? `Start ${title}, tomorrow, ${weekday}` : `Start ${title}, upcoming, ${weekday}`,
      },
    ];
  });
  return rows.map((row) => {
    const testKey = seen.has(row.dayId) ? `${row.dayId}-${row.key}` : String(row.dayId);
    seen.add(row.dayId);
    return { ...row, testKey };
  });
}

// T-102: the hub state as the §1 rule table's base (missedCatchUp): no
// schedule → setup, today done → completed; week complete / no plan → none.
export function missedBase(state) {
  return { noSchedule: 'setup', training: 'training', todayDone: 'completed', rest: 'rest' }[state] ?? null;
}

// T-80 (owner; RN-SPEC-workout T-80 block, web 2b58551c): starting any day
// other than today's planned, not-done workout asks first. Title + body per
// context; Repeat (a day done this week) says so, then the context sentence;
// repeating TODAY's own done day says only that it was done today.
const LIVE = 'This starts a live workout.';

function contextSentence(state, todayTitle) {
  switch (state) {
    case 'training':
      return `Today’s plan is ${todayTitle}.`;
    case 'rest':
      return 'Today is a rest day.';
    case 'todayDone':
      return `You’ve already done ${todayTitle} today.`;
    case 'weekComplete':
      return 'Your week is complete, so this is an extra session.';
    default:
      return '';
  }
}

export function startConfirmCopy({ state, title, done = false, isToday = false, todayTitle = '' }) {
  const context = contextSentence(state, todayTitle);
  if (done && isToday) {
    return { title: `Do ${title} again?`, body: `You’ve already done ${title} today. ${LIVE}` };
  }
  if (done) {
    return { title: `Do ${title} again?`, body: [`You already did ${title} this week.`, context, LIVE].filter(Boolean).join(' ') };
  }
  const titles = {
    training: `Start ${title} instead?`,
    rest: `Start ${title} today?`,
    todayDone: `Start ${title} now?`,
    weekComplete: `Do ${title} again?`,
  };
  return { title: titles[state] ?? `Start ${title} now?`, body: [context, LIVE].filter(Boolean).join(' ') };
}
