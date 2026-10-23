import { formatNumber, formatSignedNumber, formatWeight } from '../../shared/format/numbers';
import { formatDateWithOffset, formatDuration } from '../../shared/time/format';

// Derived values of RN-SPEC-progress §PR1.2, kept apart from the screen so
// they can be tested.

const BAR_MAX = 52;
const BAR_MIN = 8;

// ⚠PR-2: the newest log's unit (logs come newest first), else "kg".
export function progressUnit(weightLogs) {
  return weightLogs?.[0]?.weight_unit || 'kg';
}

// ⚠PR-3: only losing weight counts; the gap is floored at 1; missing goal or
// current → 0.
export function goalCompletion(weightProgress) {
  const current = weightProgress?.current_weight;
  const goal = weightProgress?.goal_weight;
  if (!goal || !current) {
    return 0;
  }
  const start = Number(weightProgress.starting_weight || current);
  const ratio = ((start - Number(current)) / Math.max(1, start - Number(goal))) * 100;
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

export function weightStats(weightProgress, unit) {
  return [
    { label: 'Current', value: formatWeight(weightProgress?.current_weight, unit) },
    { label: 'Goal', value: formatWeight(weightProgress?.goal_weight, unit) },
    { label: 'To goal', value: formatSignedNumber(weightProgress?.difference_to_goal, unit), brand: true },
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
