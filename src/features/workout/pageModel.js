import { memberVolume } from '../home/homeFormat';
import { WEEKDAYS, compactSetSummary, isValidWeek, localDateKey, planDayTitle } from '../plans/libraryFormat';
import { startDateKey } from '../plans/weekByDate';
import { exerciseName } from './runtime/sessionMath';

// T-140 Workout page "A-balanced" (owner approved 30 Oct 2026; UX
// T140-workout-page-BUILD-ruling, FE T140-data-check). Pure derivations for
// the plan line, the stats card, the Last workout row, the day cells, the day
// sheets and the page's one gold action. No new API: every value comes from
// the calls the page already makes (+ GET /workouts?per_page=1).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SHEET_ROWS = 6;

function dateOf(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
}

// The Monday (local midnight) of the week holding `date`.
function mondayOf(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function weeksBetween(from, to) {
  return Math.round((mondayOf(to) - mondayOf(from)) / (7 * 24 * 3600 * 1000));
}

// The week N counts to: the server week's first date (week[0].date), else the
// device's today (RN-SPEC T-140 "Plan line").
export function weekReference(week, now = new Date()) {
  const first = isValidWeek(week) ? startDateKey(week[0]?.date) : null;
  return first ? dateOf(first) : now;
}

// "week N": whole Monday weeks since started_on, its own week = 1 (a future
// start reads week 1, as web). null without a start date.
export function planWeekNumber(startedOn, now = new Date()) {
  const start = startDateKey(startedOn);
  if (!start) {
    return null;
  }
  return Math.max(1, weeksBetween(dateOf(start), now) + 1);
}

// §6: "{plan name} · week N"; "{days_per_week}-day split" only without a
// name. Hidden (null) without a plan or a week number. Plans have no length.
export function planLine(plan, startedOn, now = new Date()) {
  const week = planWeekNumber(startedOn, now);
  if (!plan || week == null) {
    return null;
  }
  const name = typeof plan.name === 'string' ? plan.name.trim() : '';
  const label = name || (plan.days_per_week ? `${plan.days_per_week}-day split` : '');
  return label ? `${label} · week ${week}` : null;
}

// "1h 43m" / "48m" / "0m" (whole minutes, rounded).
export function hoursMinutes(seconds) {
  const minutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

// §7 stats card: sums over this week's completed GET /workouts items. Volume
// = Σ total_volume_kg in the member's unit (VOLUME RULE: never the raw
// total_volume); no items → "0 {unit}"; items but none with a kg value →
// null (the card shows "—").
export function weekStats(completed, unit = 'kg') {
  const items = completed ?? [];
  const seconds = items.reduce((sum, item) => sum + (finite(item?.duration_seconds) ? Number(item.duration_seconds) : 0), 0);
  const withKg = items.filter((item) => finite(item?.total_volume_kg));
  if (items.length && !withKg.length) {
    return { time: hoursMinutes(seconds), volume: null };
  }
  const kg = withKg.reduce((sum, item) => sum + Number(item.total_volume_kg), 0);
  return { time: hoursMinutes(seconds), volume: memberVolume(kg, unit) };
}

// The Last workout: the newest of this week's completed items by
// started_at, else the per_page=1 call's (null = none ever).
export function newestWorkout(completed, fallback = null) {
  const sorted = [...(completed ?? [])].sort((a, b) => String(b?.started_at ?? b?.completed_at).localeCompare(String(a?.started_at ?? a?.completed_at)));
  return sorted[0] ?? fallback ?? null;
}

// A completed workout's local "YYYY-MM-DD" (started_at, else completed_at:
// the same day rule as the strip, plans/weekByDate).
export function workoutDateKey(item) {
  const raw = item?.started_at ?? item?.completed_at;
  if (!raw) {
    return null;
  }
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : localDateKey(at);
}

// A completed workout's title, web's chain (WorkoutPage): the plan day by
// workout_plan_day_id (GET /workouts list items carry only the id), then the
// session name, then an embedded plan day (the detail shape), then 'Workout'.
export function workoutTitle(item, planDays = []) {
  const id = item?.workout_plan_day_id;
  const listed = id == null ? null : (planDays ?? []).find((day) => day?.id === id);
  return listed?.title || item?.name || item?.plan_day?.title || item?.workout_plan_day?.title || 'Workout';
}

// §7 when-text: "Today" / "Yesterday" / "Wed" (this week) / "Last Wed" (last
// week) / "Oct 12".
export function lastWhenText(item, now = new Date()) {
  const key = workoutDateKey(item);
  if (!key) {
    return '';
  }
  const date = dateOf(key);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - date) / (24 * 3600 * 1000));
  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  const short = WEEKDAYS[(date.getDay() + 6) % 7].label;
  const weeks = weeksBetween(date, now);
  if (weeks === 0 && days > 0) {
    return short;
  }
  if (weeks === 1) {
    return `Last ${short}`;
  }
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// The strip kinds (plans/weekByDate + the hub's /week fallback) → the
// ruling's day types. Not started reads as rest (FE data check).
const TYPE_OF = Object.freeze({ done: 'done', missed: 'missed', today: 'today', todayRest: 'rest', train: 'future', rest: 'rest', notStarted: 'rest' });

// The 7 tappable days: each strip cell with its type, weekday, /week plan
// day and the completed workouts of its date (by date only with /week).
export function dayCells({ strip, week, completed = [], misses = [], planDays = [] }) {
  if (!strip) {
    return [];
  }
  return strip.map((cell, index) => {
    const item = Array.isArray(week) ? week[index] : null;
    const weekday = WEEKDAYS[index];
    const done = cell.date ? (completed ?? []).filter((workout) => workoutDateKey(workout) === cell.date) : [];
    const planDay = item?.plan_day ?? null;
    const type = TYPE_OF[cell.kind] ?? 'rest';
    done.sort((a, b) => String(a.started_at ?? a.completed_at).localeCompare(String(b.started_at ?? b.completed_at)));
    return {
      index,
      key: cell.key,
      date: cell.date ?? item?.date ?? '',
      letter: cell.letter,
      kind: cell.kind,
      type,
      isToday: cell.kind === 'today' || cell.kind === 'todayRest' || Boolean(cell.isToday),
      weekday,
      planDay,
      done,
      // A done day's title: the slot's plan day, else the latest workout's.
      doneName: planDay ? planDayTitle(planDay) : done.length ? workoutTitle(done[done.length - 1], planDays) : null,
      // An open miss (the server's /week still says missed) can be caught up.
      openMiss: type === 'missed' && misses.some((miss) => miss.planDay?.id === planDay?.id && miss.weekdayName === weekday.name),
    };
  });
}

// §11 day button label: "Wednesday, missed, Back & Shoulders".
export function dayA11y(cell) {
  const words = { done: 'done', missed: 'missed', today: 'planned', future: 'planned', rest: 'rest day' };
  const name = cell.type === 'done' ? doneTitle(cell) : cell.type === 'rest' ? '' : planDayTitle(cell.planDay);
  return [cell.weekday.name + (cell.isToday ? ', today' : ''), words[cell.type], name].filter(Boolean).join(', ');
}

// A done day's title (dayCells / pastDoneCell resolve it with the plan days).
function doneTitle(cell) {
  return cell.doneName ?? (cell.planDay ? planDayTitle(cell.planDay) : workoutTitle(cell.done[cell.done.length - 1]));
}

function exercisesLabel(count) {
  return count == null ? '' : `${count} exercise${count === 1 ? '' : 's'}`;
}

// The plan days a sheet lists: a done day merges its workouts' days (order
// done, deduped); otherwise the slot's plan day.
export function sheetDayIds(cell) {
  if (cell.type === 'done') {
    const ids = cell.done.map((item) => item?.workout_plan_day_id).filter((id) => id != null);
    return [...new Set(ids)];
  }
  return cell.planDay?.id != null ? [cell.planDay.id] : [];
}

// The sheet's rows from the loaded day lists (merged by exercise, in order),
// at most SHEET_ROWS then "+N more". undefined while any list is loading.
// `bare`: no detail (a Done sheet's planned fallback).
export function sheetRows(dayIds, exercisesByDay, { bare = false } = {}) {
  const lists = dayIds.map((id) => exercisesByDay[id]);
  if (lists.some((list) => list === undefined)) {
    return undefined;
  }
  const seen = new Set();
  const rows = [];
  for (const item of lists.flat()) {
    const id = item?.exercise_id ?? item?.exercise?.id ?? item?.id;
    if (id != null && seen.has(id)) {
      continue;
    }
    seen.add(id);
    rows.push({ key: String(id ?? rows.length), name: item?.exercise?.name ?? 'Exercise', meta: bare ? '' : compactSetSummary(item) });
  }
  return capRows(rows);
}

// A Done sheet's rows (RN-SPEC T-140): the exercises with ≥ 1 completed set
// in GET /workouts/{id}, merged by exercise_id across the day's sessions (in
// session order), detail "{n} sets". `details` = the sessions (undefined
// while loading); any failed (null) → null, so the caller falls back to the
// planned rows with ✓ and no detail.
export function doneRows(details) {
  if (details.some((detail) => detail === undefined)) {
    return undefined;
  }
  if (details.some((detail) => detail === null)) {
    return null;
  }
  const byId = new Map();
  for (const session of details) {
    for (const exercise of session?.exercises ?? []) {
      const sets = (exercise.sets ?? []).filter((set) => set?.is_completed).length;
      if (!sets) {
        continue;
      }
      const id = exercise.exercise_id ?? exercise.exercise?.id ?? exercise.id;
      const row = byId.get(id) ?? { key: String(id), name: exerciseName(exercise) || 'Exercise', sets: 0 };
      row.sets += sets;
      byId.set(id, row);
    }
  }
  return capRows([...byId.values()].map((row) => ({ key: row.key, name: row.name, meta: `${row.sets} ${row.sets === 1 ? 'set' : 'sets'}` })));
}

// Up to SHEET_ROWS rows, then "+N more" (7 → 6 + "+1 more"; web parity, UX C2).
function capRows(rows) {
  const more = Math.max(0, rows.length - SHEET_ROWS);
  return { rows: rows.slice(0, SHEET_ROWS), more, count: rows.length };
}

// §5 day sheet: { tone, eyebrow, title, meta, list ('done' | 'plan' | null),
// action ('start' | 'catchUp' | 'early' | null), note }. `count` = the
// exercises listed (null until loaded; the plan day's count is used first).
export function daySheet(cell, { count = null } = {}) {
  const dayName = cell.isToday ? `Today · ${cell.weekday.name}` : cell.weekday.name;
  const planned = cell.planDay?.exercises_count ?? count;
  switch (cell.type) {
    case 'done': {
      const seconds = cell.done.reduce((sum, item) => sum + (finite(item?.duration_seconds) ? Number(item.duration_seconds) : 0), 0);
      const tail = cell.done.length > 1 ? `${cell.done.length} workouts` : exercisesLabel(count);
      return {
        tone: 'done',
        eyebrow: `${cell.isToday ? 'Today' : cell.weekday.name} · Done`,
        title: doneTitle(cell),
        meta: [hoursMinutes(seconds), tail].filter(Boolean).join(' · '),
        list: 'done',
        action: null,
        note: null,
      };
    }
    case 'missed':
      return {
        tone: 'missed',
        eyebrow: `${cell.weekday.name} · Missed`,
        title: planDayTitle(cell.planDay),
        meta: exercisesLabel(planned),
        list: 'plan',
        action: cell.openMiss ? 'catchUp' : null,
        note: cell.openMiss ? 'Catch up works this week only.' : null,
      };
    case 'today':
      return { tone: 'today', eyebrow: dayName, title: planDayTitle(cell.planDay), meta: exercisesLabel(planned), list: 'plan', action: 'start', note: null };
    case 'future':
      return {
        tone: 'future',
        eyebrow: `${cell.weekday.name} · Planned`,
        title: planDayTitle(cell.planDay),
        meta: exercisesLabel(planned),
        list: 'plan',
        action: 'early',
        note: null,
      };
    default:
      return { tone: 'rest', eyebrow: dayName, title: 'Rest day', meta: 'Recovery is part of the plan.', list: null, action: null, note: null };
  }
}

// §7: a Last workout before this week opens a read-only Done sheet with the
// when-text as its eyebrow ("Last Fri · Done", "Oct 12 · Done").
export function pastDoneCell(item, now = new Date(), planDays = []) {
  const key = workoutDateKey(item);
  const weekday = key ? WEEKDAYS[(dateOf(key).getDay() + 6) % 7] : WEEKDAYS[0];
  return { index: -1, key: 'last', date: key ?? '', type: 'done', isToday: false, weekday: { ...weekday, name: lastWhenText(item, now) }, planDay: null, done: [item], doneName: workoutTitle(item, planDays), openMiss: false };
}

// The Last workout row's target: this week's day cell holding it, else a
// past Done cell.
export function lastWorkoutCell(item, cells, now = new Date(), planDays = []) {
  const key = workoutDateKey(item);
  return cells.find((cell) => key && cell.date === key && cell.type === 'done') ?? pastDoneCell(item, now, planDays);
}

// §4 the under-ring label.
export function ringLabel(state) {
  if (state === 'weekComplete') {
    return 'Week complete';
  }
  return state === 'rest' ? 'Rest day today' : 'workouts this week';
}

// §8 the ONE gold action: today's Start (a not-done training day); else the
// most recent open miss's catch-up; else none.
export function primaryAction({ state, todayDayId, todayTitle, misses = [] }) {
  if (state === 'training' && todayDayId != null) {
    return { kind: 'start', dayId: todayDayId, label: `Start ${todayTitle}` };
  }
  if (misses.length) {
    const miss = misses[0];
    return { kind: 'catchUp', dayId: miss.planDay?.id, miss, label: `Start ${miss.planDay?.title || 'workout'}` };
  }
  return null;
}

// §3 the missed line: "Missed {Weekday}" + " · +N more"; null without an
// open miss.
export function missedLine(misses = []) {
  if (!misses.length) {
    return null;
  }
  return { weekday: misses[0].weekdayName, more: misses.length - 1, miss: misses[0] };
}

// Plan finished (RN-SPEC T-140): no active plan and the newest enrollment
// (highest id) of GET /my-plans is `completed` → its plan; else null.
export function finishedPlan(enrollments) {
  const newest = [...(enrollments ?? [])].filter((item) => item?.id != null).sort((a, b) => Number(b.id) - Number(a.id))[0];
  return newest?.status === 'completed' ? (newest.plan ?? null) : null;
}
