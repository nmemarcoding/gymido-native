import { formatNumber, formatSignedNumber, formatWeight, parseDecimal } from '../../shared/format/numbers';
import { formatDate, formatDuration, formatLocalDateForInput } from '../../shared/time/format';

// Rules and copy of RN-SPEC-home (dated changes of 23 Oct included). Pure.

// H1.2: first name, else the email's local part, else "there" (each trimmed).
export function greetingName(profile, email) {
  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : '';
  if (first) {
    return first;
  }
  const local = typeof email === 'string' ? email.trim().split('@')[0].trim() : '';
  return local || 'there';
}

// H1.3 + Batch B #3/#6. `setupDayCount` is set when the plan needs its
// training days picked (days > 0 and no schedule); it wins first.
export function todayCard(dashboard, setupDayCount = null) {
  const today = dashboard?.today_status;
  const missed = dashboard?.missed_this_week ?? [];
  const miss = missed[0];
  let card;
  if (setupDayCount) {
    card = {
      state: 'setup',
      tone: 'brand',
      pill: 'Set up',
      headline: 'Pick your training days',
      sub: `Choose the ${setupDayCount} days you'll train each week.`,
      primary: 'Choose days',
    };
  } else if (today?.already_completed) {
    card = { state: 'completed', tone: 'success', pill: 'Completed', headline: today.plan_day?.title || 'Workout done', primary: 'Go to workout' };
  } else if (today?.is_workout_day) {
    card = { state: 'training', tone: 'brand', pill: "Today's workout", headline: today.plan_day?.title || 'Workout ready', primary: 'Start workout' };
  } else if (miss) {
    card = {
      state: 'missed',
      tone: 'warning',
      pill: 'Missed',
      headline: `You missed ${miss.weekday?.name}'s ${miss.plan_day?.title || 'workout'}`,
      primary: 'Do it now',
    };
  } else {
    // ⚠H-2: a rest day can still carry a day title.
    card = { state: 'rest', tone: 'muted', pill: 'Rest day', headline: today?.plan_day?.title || 'Recovery day', primary: 'Go to workout' };
  }
  // ⚠H-4: shown in every state.
  const more = missed.length - 1;
  return { ...card, moreMissed: more > 0 ? `+${more} more missed this week` : null };
}

// H1.4
export function quickStats(dashboard) {
  const stats = dashboard?.quick_stats ?? {};
  return {
    items: [
      { label: 'Done total', value: formatNumber(stats.completed_workouts_total ?? 0, 0) },
      { label: 'This week', value: formatNumber(stats.completed_workouts_this_week ?? 0, 0) },
      { label: 'Planned', value: formatNumber(stats.planned_workouts_this_week ?? 0, 0) },
    ],
    lastWorkout: stats.last_workout_at ? `Last workout ${formatDate(stats.last_workout_at)}` : null,
  };
}

export function defaultWeightUnit(profile) {
  return profile?.current_weight_unit || profile?.goal_weight_unit || 'kg';
}

// H1.5. ⚠H-5: "Current" uses the profile's unit.
export function weightCard(dashboard, profile) {
  const goal = dashboard?.goal_progress;
  const goalUnit = profile?.goal_weight_unit || 'kg';
  return {
    hasData: Boolean(goal || dashboard?.current_weight),
    current: formatWeight(dashboard?.current_weight, defaultWeightUnit(profile)),
    goal: formatWeight(goal?.goal_weight, goalUnit),
    toGoal: formatSignedNumber(goal?.difference_to_goal, goalUnit),
  };
}

// H1.6 meta line (⚠H-6: "—" duration; "vol 0" kept, only a missing volume omitted).
export function recentWorkoutMeta(workout) {
  const parts = `${formatDate(workout.completed_at || workout.started_at)} · ${formatDuration(workout.duration_seconds)}`;
  const volume = workout.total_volume;
  return volume !== null && volume !== undefined ? `${parts} · vol ${formatNumber(volume, 0)}` : parts;
}

// H2 step 2, in order; the first failure only.
export function validateWeightLog(value, unit) {
  if (String(value).trim() === '') {
    return { field: 'weight_value', message: 'Weight is required' };
  }
  const number = parseDecimal(value);
  if (!Number.isFinite(number) || number <= 0) {
    return { field: 'weight_value', message: 'Weight must be a positive number' };
  }
  if (String(unit ?? '').trim() === '') {
    return { field: 'weight_unit', message: 'Weight unit is required' };
  }
  return null;
}

// H2 step 5 (23 Oct: the device's LOCAL date, no probe). "83,5" sends 83.5 (T-16).
export function weightLogBody(value, unit, now = new Date()) {
  return { weight_value: parseDecimal(value), weight_unit: unit, recorded_on: formatLocalDateForInput(now), note: null };
}

// v2 Phase 2 B3: the Today header (main Today board): "Today · Thursday, Oct 29".
export function todayDateLabel(now = new Date()) {
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return `Today · ${date}`;
}

// The header avatar (decorative): first + last initial, else the first
// letter of the greeting name ("there" → none).
export function avatarInitials(profile, email) {
  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : '';
  const last = typeof profile?.last_name === 'string' ? profile.last_name.trim() : '';
  if (first) {
    return `${first[0]}${last ? last[0] : ''}`.toUpperCase();
  }
  const local = typeof email === 'string' ? email.trim().split('@')[0].trim() : '';
  return local ? local[0].toUpperCase() : '';
}

// Today-empty stat tiles (UX B §Today, empty; ND4 ring on tablet): the H1.4
// numbers, regrouped ("This week" n / planned, "Done total").
export function todayEmptyStats(dashboard) {
  const stats = dashboard?.quick_stats ?? {};
  const thisWeek = Number(stats.completed_workouts_this_week ?? 0) || 0;
  const planned = Number(stats.planned_workouts_this_week ?? 0) || 0;
  const doneTotal = Number(stats.completed_workouts_total ?? 0) || 0;
  return {
    thisWeek,
    planned,
    doneTotal,
    thisWeekText: formatNumber(thisWeek, 0),
    plannedText: `/${formatNumber(planned, 0)}`,
    doneTotalText: formatNumber(doneTotal, 0),
    ringLabel: `${formatNumber(thisWeek, 0)} of ${formatNumber(planned, 0)} workouts this week`,
    lastWorkout: stats.last_workout_at ? `Last workout ${formatDate(stats.last_workout_at)}` : null,
  };
}
