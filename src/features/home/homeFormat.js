import { formatNumber, formatSignedNumber, formatWeight, parseDecimal } from '../../shared/format/numbers';
import { convertWeight } from '../../shared/format/weight';
import { formatDate, formatDuration, formatLocalDateForInput } from '../../shared/time/format';
import { formatCount } from '../../shared/format/counts';

// Rules and copy of RN-SPEC-home (dated changes of 23 Oct included). Pure.

// H1.2: first name, else the email's local part (each trimmed), else none.
// v2 parity with web (FE, 26 Oct 2026): no "there" placeholder.
export function greetingName(profile, email) {
  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : '';
  if (first) {
    return first;
  }
  const local = typeof email === 'string' ? email.trim().split('@')[0].trim() : '';
  return local;
}

// The Today h1: "Welcome back, {name}", or "Welcome back" with no name.
export function greetingLine(profile, email) {
  const name = greetingName(profile, email);
  return name ? `Welcome back, ${name}` : 'Welcome back';
}

// H1.3 + Batch B #3/#6. `setupDayCount` is set when the plan needs its
// training days picked (days > 0 and no schedule); it wins first. T-63:
// `sessionOpen` (GET /workouts/current gave a session) relabels the primary
// "Resume workout" in every state; the pill and headline stay.
// T-63 (web parity): GET /workouts/current's session counts as open only
// while in progress; a missing status counts as in progress.
export function isSessionOpen(session) {
  return Boolean(session) && (session.status ?? 'in_progress') === 'in_progress';
}

export function todayCard(dashboard, setupDayCount = null, sessionOpen = false) {
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
      sub: `Choose the ${formatCount(setupDayCount, 'day', 'days')} you'll train each week.`,
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
  const primary = sessionOpen ? 'Resume workout' : card.primary;
  return { ...card, primary, moreMissed: more > 0 ? `+${more} more missed this week` : null };
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

// VOLUME RULE (RN-SPEC-v2-phase3 §1, PM 27 Oct): only `total_volume_kg`,
// converted to the member's unit (profile current unit, else goal unit,
// else kg); absent → null (the volume is hidden). The raw `total_volume`
// is never shown.
export function memberVolume(totalVolumeKg, unit = 'kg') {
  if (totalVolumeKg === null || totalVolumeKg === undefined || totalVolumeKg === '' || !Number.isFinite(Number(totalVolumeKg))) {
    return null;
  }
  return `${formatNumber(convertWeight(Number(totalVolumeKg), 'kg', unit), 0)} ${unit}`;
}

// H1.6 meta line (⚠H-6: "—" duration; "vol 0" kept, only a missing volume
// omitted). v2 VOLUME RULE: "vol {n} {unit}" from total_volume_kg only.
export function recentWorkoutMeta(workout, unit = 'kg') {
  const parts = `${formatDate(workout.completed_at || workout.started_at)} · ${formatDuration(workout.duration_seconds)}`;
  const volume = memberVolume(workout.total_volume_kg, unit);
  return volume ? `${parts} · vol ${volume}` : parts;
}

// ND6 / ND-7: the neutral initials tile of a recent workout: the first
// letters of the first two words of its name (one word → its first two
// letters), upper case. No name → "".
export function workoutInitials(title) {
  const words = String(title ?? '')
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const letters = words.length > 1 ? `${[...words[0]][0]}${[...words[1]][0]}` : [...words[0]].slice(0, 2).join('');
  return letters.toUpperCase();
}

// ND4 (UX E 27 Oct): the hero sub-line's " · {n} exercises" ("1 exercise");
// 0 / none / junk → null (the plan name alone).
export function exerciseCountText(count) {
  const n = Number(count);
  if (count === null || count === undefined || !Number.isInteger(n) || n <= 0) {
    return null;
  }
  return ` · ${n} ${n === 1 ? 'exercise' : 'exercises'}`;
}

// ND4 data (pm-web-facts "ND4"): `exercises_count` of today's plan day in
// GET /plans/{planId}/days, matched by today_status.plan_day.id; a finite
// number only, else null (the plan name alone).
export function todayExerciseCount(days, dashboard) {
  const dayId = dashboard?.today_status?.plan_day?.id;
  if (!Array.isArray(days) || dayId === null || dayId === undefined) {
    return null;
  }
  const count = days.find((day) => day?.id === dayId)?.exercises_count;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

// Today hero photo (RN-SPEC-v2-phase3 §1 data facts): today_status.image.url,
// omitted when none.
export function heroImageUrl(dashboard) {
  const url = dashboard?.today_status?.image?.url;
  return typeof url === 'string' && url.trim() ? url : null;
}

// Batch 2 item 4: the name of the tablet hero's initials tile = the plan day
// TITLE (the latest miss's when missed; none in setup).
export function heroDayTitle(dashboard, card) {
  if (!card || card.state === 'setup') {
    return null;
  }
  const title = card.state === 'missed' ? dashboard?.missed_this_week?.[0]?.plan_day?.title : dashboard?.today_status?.plan_day?.title;
  return typeof title === 'string' && title.trim() ? title : null;
}

const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CELL_LABELS = { done: 'Done', today: 'Today', upcoming: 'Workout day', missed: 'Missed', rest: 'Rest day' };

function localIsoDate(now) {
  return formatLocalDateForInput(now);
}

// U1 "Your week" (ND1, PM approved): GET /my-plans/current/week `week[]`
// (Monday first) with BE #9 `date` + `status` (done | today | upcoming |
// missed | rest). Without status (older server) a workout day is
// "upcoming" (today's: "today") and any other day "rest". `isToday` drives
// the gold day letter. Labels: "{weekday}, {status}" (UX E a11y).
export function weekStrip(week, now = new Date()) {
  if (!Array.isArray(week) || week.length === 0) {
    return null;
  }
  const todayIso = localIsoDate(now);
  const todayIndex = (now.getDay() + 6) % 7;
  const cells = week.slice(0, 7).map((day, index) => {
    const name = day?.weekday?.name || WEEKDAY_LONG[index] || '';
    const isToday = day?.date ? day.date === todayIso : index === todayIndex;
    let status = CELL_LABELS[day?.status] ? day.status : null;
    if (!status) {
      status = day?.is_workout_day ? (isToday ? 'today' : 'upcoming') : 'rest';
    }
    return {
      key: day?.date || String(index),
      name,
      short: name.slice(0, 3),
      letter: name.slice(0, 1),
      status,
      isToday,
      workout: Boolean(day?.is_workout_day) || (status !== 'rest' && status !== null),
      label: `${name}, ${CELL_LABELS[status]}`,
    };
  });
  const training = cells.filter((cell) => cell.workout);
  const todayCell = cells.find((cell) => cell.isToday);
  const position = todayCell?.workout ? training.indexOf(todayCell) + 1 : 0;
  return {
    cells,
    // The phone header's "Mon, Tue, Thu, Fri".
    trainingDays: training.map((cell) => cell.short).join(', '),
    // ND3 (tablet): "Day n of N" when today is a training day.
    dayOfWeek: position > 0 ? `Day ${position} of ${training.length}` : null,
  };
}

// ND8: the This-week ring tile: "{done} done · {planned} planned" and the ring label.
export function weekRing(dashboard) {
  const stats = todayEmptyStats(dashboard);
  return {
    ...stats,
    caption: `${stats.thisWeekText} done · ${formatNumber(stats.planned, 0)} planned`,
    ringLabel: `${stats.thisWeekText} of ${formatNumber(stats.planned, 0)} planned workouts done`,
  };
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
// The device's local date above the greeting, e.g. "Thursday, Oct 29"
// (web parity: "Today" is the nav item, never a heading here).
export function todayDateLabel(now = new Date()) {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// The header avatar (decorative): first + last initial, else the first
// letter of the greeting name (none → no initials).
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
