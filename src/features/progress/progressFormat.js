import { formatNumber, formatToGoal, formatWeight } from '../../shared/format/numbers';
import { convertWeight } from '../../shared/format/weight';
import { formatDate, formatDateWithOffset, formatDuration } from '../../shared/time/format';
import { formatCount } from '../../shared/format/counts';
import { isValidWeek, localDateKey } from '../plans/libraryFormat';
import { weekdayNameOf } from '../plans/weekByDate';

// Derived values of RN-SPEC-progress §PR1.2, kept apart from the screen so
// they can be tested.

const BAR_MAX = 52;
const BAR_MIN = 8;

// The newest log's unit (logs come newest first), else "kg". Since T-38
// (25 Oct 2026) only the weight modal's default uses it.
export function progressUnit(weightLogs) {
  return weightLogs?.[0]?.weight_unit || 'kg';
}

// T-34 (dated change 25 Oct 2026, retires ⚠PR-2): each value's unit, as the
// server sends it. current_weight is in the profile's current unit when the
// profile has a current weight (else the newest log's); goal_weight and
// difference_to_goal are in the goal unit.
export function weightUnits(profile, weightLogs) {
  const hasCurrent = profile?.current_weight_value != null && Boolean(profile?.current_weight_unit);
  const current = hasCurrent ? profile.current_weight_unit : progressUnit(weightLogs);
  return { current, goal: profile?.goal_weight_unit || current };
}

export { convertWeight };

// ⚠PR-3: only losing weight counts; the gap is floored at 1; missing goal or
// current → 0. T-34: all in the current unit. total_change is in that unit;
// starting_weight (the earliest log's unit) is only a fallback without it.
export function goalCompletion(weightProgress, units = {}) {
  const current = weightProgress?.current_weight;
  const goalWeight = weightProgress?.goal_weight;
  if (!goalWeight || !current) {
    return 0;
  }
  const totalChange = weightProgress.total_change;
  const start = totalChange != null
    ? Number(current) - Number(totalChange)
    : Number(weightProgress.starting_weight || current);
  const goal = convertWeight(goalWeight, units.goal, units.current);
  const ratio = ((start - Number(current)) / Math.max(1, start - goal)) * 100;
  return Math.min(100, Math.max(0, ratio));
}

// "—" (null) only when the total is missing or 0; a missing completed count is 0.
export function completionRate(history) {
  const total = Number(history?.total_workouts);
  if (!Number.isFinite(total) || total === 0) {
    return null;
  }
  const completed = Number(history?.completed_workouts);
  return ((Number.isFinite(completed) ? completed : 0) / total) * 100;
}

// ⚠PR-4: divided by completed workouts, not total.
export function averageWorkoutDuration(history) {
  return history?.completed_workouts ? Math.round(history.total_duration_seconds / history.completed_workouts) : null;
}

export function maxFrequency(items) {
  return (items ?? []).reduce((max, item) => Math.max(max, Number(item.workout_count) || 0), 0);
}

export function barHeight(count, max) {
  if (!max) {
    return BAR_MIN;
  }
  return Math.max(BAR_MIN, Math.round((Number(count) / max) * BAR_MAX));
}

// T-34: Current in the current unit; Goal and To goal in the goal's unit.
// T-64: To goal = −difference_to_goal (goal − current), formatToGoal.
export function weightStats(weightProgress, units) {
  return [
    { label: 'Current', value: formatWeight(weightProgress?.current_weight, units.current) },
    { label: 'Goal', value: formatWeight(weightProgress?.goal_weight, units.goal) },
    { label: 'To goal', value: formatToGoal(weightProgress?.difference_to_goal, units.goal), brand: true },
  ];
}

export function activityStats(overview, history) {
  const rate = completionRate(history);
  const average = averageWorkoutDuration(history);
  return [
    { label: 'Streak', value: formatNumber(overview?.current_streak, 0) },
    { label: 'Workouts', value: formatNumber(overview?.workouts_completed, 0) },
    { label: 'Completion', value: rate === null ? '—' : `${formatNumber(rate, 0)}%` },
    { label: 'Avg time', value: average === null ? '—' : formatDuration(average) },
  ];
}

// ⚠PR-5: n is the loaded logs only (at most 20).
export function logCountLabel(count) {
  return `${count} ${count === 1 ? 'log' : 'logs'}`;
}

// The chart wants oldest → newest.
export function chartLogs(weightLogs) {
  return [...(weightLogs ?? [])].reverse();
}

// PR1.4 item 4: the newest 5; dates shifted a day (⚠PR-8).
export function recentLogRows(weightLogs) {
  return (weightLogs ?? []).slice(0, 5).map((log, index) => ({
    key: String(log.id ?? index),
    weight: formatWeight(log.weight_value, log.weight_unit),
    date: formatDateWithOffset(log.recorded_on, 1),
    unit: log.weight_unit || 'kg',
    note: log.note || null,
  }));
}

// Splits items into rows of `size`, padding the last row with nulls so every
// column keeps the same width (⚠PR-6: more than 12 items wrap).
export function gridRows(items, size) {
  const rows = [];
  for (let start = 0; start < items.length; start += size) {
    const row = items.slice(start, start + size);
    while (row.length < size) {
      row.push(null);
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// v2 Phase 3 §5 Progress (UX G) + the approved §1 items (N1, U8, U9, #23).

// N1: the phone's ranges, as drawn. 3M is drawn selected (the default).
export const PHONE_RANGES = Object.freeze([
  Object.freeze({ key: '7D', days: 7 }),
  Object.freeze({ key: '1M', days: 30 }),
  Object.freeze({ key: '3M', days: 90 }),
  Object.freeze({ key: '1Y', days: 365 }),
]);
export const DEFAULT_RANGE = '3M';

function isoDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The device-local start/end dates of a range (end = today, inclusive).
export function rangeDates(key, now = new Date()) {
  const range = PHONE_RANGES.find((item) => item.key === key) ?? PHONE_RANGES[2];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - range.days);
  return { start_date: isoDate(start), end_date: isoDate(now) };
}

// "↓ 2.4 kg in this range" / "↑ …" / null under 2 logs (logs oldest first),
// in the chart's (current) unit.
export function rangeDelta(logs, unit) {
  if (!Array.isArray(logs) || logs.length < 2) {
    return null;
  }
  const first = convertWeight(logs[0].weight_value, logs[0].weight_unit, unit);
  const last = convertWeight(logs[logs.length - 1].weight_value, logs[logs.length - 1].weight_unit, unit);
  const change = last - first;
  const arrow = change < 0 ? '↓' : '↑';
  return `${arrow} ${formatNumber(Math.abs(change))} ${unit} in this range`;
}

// "−4.1 kg to goal (78 kg)": T-64 −difference_to_goal with a real minus
// (T-34: goal unit); null without a goal.
export function toGoalLine(weightProgress, units) {
  if (weightProgress?.goal_weight == null || weightProgress?.difference_to_goal == null) {
    return null;
  }
  return `${formatToGoal(weightProgress.difference_to_goal, units.goal)} to goal (${formatWeight(weightProgress.goal_weight, units.goal)})`;
}

// U9: the goal weight in the chart's unit (null without a goal).
export function goalInUnit(weightProgress, units) {
  const goal = weightProgress?.goal_weight;
  if (goal === null || goal === undefined || goal === '' || !Number.isFinite(Number(goal))) {
    return null;
  }
  return convertWeight(Number(goal), units.goal, units.current);
}

// The chart's data-based label (UX G a11y).
export function chartLabel(logs, unit) {
  if (!Array.isArray(logs) || logs.length < 2) {
    return 'Weight history';
  }
  const a = convertWeight(logs[0].weight_value, logs[0].weight_unit, unit);
  const b = convertWeight(logs[logs.length - 1].weight_value, logs[logs.length - 1].weight_unit, unit);
  const trend = b < a ? 'down' : b > a ? 'up' : 'flat';
  return `Weight history, ${trend} from ${formatNumber(a)} to ${formatNumber(b)} ${unit}`;
}

// #23 bars: the last 8 of /progress/frequency (oldest → newest); the last
// one is the current week. `average` = their mean, 1 decimal.
export function weeklyBars(frequency) {
  const items = (frequency ?? []).slice(-8);
  const counts = items.map((item) => Number(item.workout_count) || 0);
  const max = Math.max(0, ...counts);
  const total = counts.reduce((sum, value) => sum + value, 0);
  return {
    empty: total === 0,
    average: counts.length ? formatNumber(total / counts.length, 1) : '0',
    bars: counts.map((count, index) => ({
      key: items[index].period_start ?? String(index),
      count,
      current: index === counts.length - 1,
      ratio: max ? count / max : 0,
    })),
    label: `Workouts per week, last ${counts.length} weeks: ${counts.join(', ')}`,
  };
}

// #23 "Consistency": (planned_count − count) / planned_count from
// /my-plans/current/missed?weeks=12; missing (404) or planned 0 → null.
export function consistencyPercent(missed) {
  const planned = Number(missed?.planned_count);
  if (!missed || !Number.isFinite(planned) || planned <= 0) {
    return null;
  }
  const count = Number(missed.count) || 0;
  return Math.max(0, Math.min(100, ((planned - count) / planned) * 100));
}

// ND-6 completion grid: one cell per scheduled training day of the last 4
// weeks (BE days[]: done | missed; rest → no cell) + this week's training
// days from /my-plans/current/week (done → done, missed → missed, others
// not yet due). No days[] → null (the grid is hidden, never composed).
export function completionCells(missed, week, now = new Date()) {
  const days = missed?.days;
  if (!Array.isArray(days)) {
    return null;
  }
  const cutoff = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28));
  const past = days
    .filter((day) => (day.status === 'done' || day.status === 'missed') && String(day.date) >= cutoff)
    .map((day) => ({ key: day.date, status: day.status }));
  const current = (Array.isArray(week) ? week : [])
    .filter((day) => day?.is_workout_day && day?.status !== 'rest')
    .map((day, index) => ({
      key: day.date ?? `w${index}`,
      status: day.status === 'done' ? 'done' : day.status === 'missed' ? 'missed' : 'due',
    }));
  const cells = past.concat(current);
  const done = cells.filter((cell) => cell.status === 'done').length;
  const planned = cells.filter((cell) => cell.status !== 'due').length;
  return { cells, label: `${done} of ${formatCount(planned, 'planned day', 'planned days')} done in the last 4 weeks` };
}

// U8 Recent workouts: /dashboard recent_workouts (completed) + the Missed
// days of /my-plans/current/missed items, newest first, max 8; with 5+
// completed rows, Missed days older than the oldest one are dropped (web).
// Volume = VOLUME RULE.
export const RECENT_COMPLETED_LIMIT = 5;
export function recentWorkoutRows(recent, missedItems, unit, memberVolume) {
  const done = (recent ?? []).map((workout, index) => ({
    key: `w${workout.id ?? index}`,
    kind: 'done',
    // T-82: the delete action needs the id and the started_at (its week).
    workoutId: workout.id ?? null,
    startedAt: workout.started_at ?? null,
    // Web review: only a finished (completed) workout gets the ⋯.
    completed: workout.status ? workout.status === 'completed' : Boolean(workout.completed_at),
    title: workout.workout_plan_day?.title || 'Workout session',
    sortKey: String(workout.completed_at || workout.started_at || ''),
    when: instantMs(workout.completed_at || workout.started_at),
    meta: `${formatDate(workout.completed_at || workout.started_at)} · ${formatDuration(workout.duration_seconds)}`,
    volume: memberVolume(workout.total_volume_kg, unit),
  }));
  // M2 (web mergeRecentWorkouts): the cut applies only once the completed
  // list is full (≥ RECENT_COMPLETED_LIMIT rows); otherwise every Missed day stays.
  const oldest =
    done.length >= RECENT_COMPLETED_LIMIT ? done.reduce((min, row) => (row.sortKey && (!min || row.sortKey < min) ? row.sortKey : min), '') : '';
  const missed = (missedItems ?? [])
    .filter((item) => item?.date && (!oldest || String(item.date) >= oldest.slice(0, 10)))
    .map((item, index) => ({
      key: `m${item.date}-${index}`,
      kind: 'missed',
      title: item.plan_day?.title || item.plan_day?.name || 'Workout session',
      sortKey: String(item.date),
      when: localMidnightMs(item.date),
      meta: `${formatDate(`${item.date}T12:00:00`)} · —`,
      volume: null,
    }));
  return done
    .concat(missed)
    .sort((a, b) => b.when - a.when || 0)
    .slice(0, 8);
}

// Batch 3 (d), web parity: sort by timestamp (epoch ms), newest first.
// Completed rows = the absolute instant; Missed rows = LOCAL midnight of
// their YYYY-MM-DD. Unreadable → oldest.
function instantMs(value) {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

function localMidnightMs(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date ?? ''));
  if (!match) {
    return -Infinity;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

// ---- T-82 (owner, 28 Oct 2026; UX T82-delete-workout-ux): delete a finished
// workout from Recent workouts. Only THIS WEEK's rows can be deleted: the
// row's LOCAL started_at date within /my-plans/current/week's
// week[0].date..week[6].date. No valid /week, no id or no readable started_at
// → not deletable (never guessed). Abandoned (any status but "completed";
// no status → needs a completed_at) → not deletable either.

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startedLocalDate(startedAt) {
  if (typeof startedAt !== 'string' || !startedAt) {
    return null;
  }
  const at = new Date(startedAt);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function isThisWeekRow(row, week) {
  if (row?.kind !== 'done' || row.completed !== true || row.workoutId === null || row.workoutId === undefined || !isValidWeek(week)) {
    return false;
  }
  const first = week[0]?.date;
  const last = week[6]?.date;
  const at = startedLocalDate(row.startedAt);
  if (typeof first !== 'string' || typeof last !== 'string' || !at) {
    return false;
  }
  const key = localDateKey(at);
  return key >= first.slice(0, 10) && key <= last.slice(0, 10);
}

// "Monday" / "Monday, Oct 27" for the row's local started_at date.
export function workoutWeekday(startedAt) {
  const at = startedLocalDate(startedAt);
  return at ? weekdayNameOf(localDateKey(at)) : '';
}

export function workoutWeekdayDate(startedAt) {
  const at = startedLocalDate(startedAt);
  return at ? `${weekdayNameOf(localDateKey(at))}, ${SHORT_MONTHS[at.getMonth()]} ${at.getDate()}` : '';
}

export const DELETE_COPY = Object.freeze({
  menuTitle: 'Workout actions',
  menuItem: 'Delete workout',
  title: 'Delete this workout?',
  confirm: 'Delete workout',
  sending: 'Deleting\u2026',
  success: 'Workout deleted.',
  locked: "Only this week's workouts can be deleted.",
  failed: "Couldn't delete the workout. Please try again.",
});

export function workoutActionsLabel(row) {
  return `${DELETE_COPY.menuTitle}, ${row.title}, ${workoutWeekday(row.startedAt)}`;
}

export function deleteWorkoutBody(row) {
  return `${row.title} on ${workoutWeekdayDate(row.startedAt)} will be removed from your history, this week's progress and your exercise records. Personal records are recalculated. This can't be undone.`;
}

// DELETE /workouts/{id} failures: 409 WORKOUT_DELETE_WEEK_LOCKED → 'locked';
// 404 (not yours / already deleted) → 'gone'; anything else → 'failed'.
export function deleteWorkoutOutcome(error) {
  const status = error?.response?.status;
  const reasons = error?.response?.data?.errors?.reason;
  const reason = Array.isArray(reasons) ? reasons[0] : reasons;
  if (status === 409 && reason === 'WORKOUT_DELETE_WEEK_LOCKED') {
    return 'locked';
  }
  if (status === 404) {
    return 'gone';
  }
  return 'failed';
}
