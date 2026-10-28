import { WEEKDAYS, isValidWeek, localDateKey } from './libraryFormat';

// T-81 (owner, 28 Oct 2026; PM "DECIDED", Option B, no backend change; UX
// T81-week-strip-states): the member's week is a calendar of what they
// actually did. ONE shared pure function for every member week display (the
// Workout hub strip, Today's strip + ring, the Plans tab's active-plan
// circles); Plan detail's per-slot cards use `slotState` below.
//
// Inputs:
//   week       GET /my-plans/current/week (7 days Mon-first, `date` in the
//              X-Timezone, `is_workout_day`, the slot `status`)
//   completed  GET /workouts?status=completed for week[0].date..week[6].date
//   startedOn  enrollment.started_on from /my-plans/current (date-only: its
//              first 10 characters, never converted to local)
//
// A workout's day = the LOCAL date of its started_at (completed_at when a
// row has no started_at).
//
// Per date, first match wins:
//   1 done        ≥ 1 completed workout that date (any workout, also on a
//                 non-training day); `count` > 1 shows "×n"
//   2 notStarted  a training day before started_on
//   3 missed      a training day before today
//   4 today       today (todayRest when it is not a training day)
//   5 train       a later training day
//   6 rest

export function startDateKey(startedOn) {
  return typeof startedOn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(startedOn) ? startedOn.slice(0, 10) : null;
}

function workoutDateKey(item) {
  const raw = item?.started_at ?? item?.completed_at;
  if (!raw) {
    return null;
  }
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : localDateKey(at);
}

// Completed workouts per local date: { 'YYYY-MM-DD': n }.
export function workoutsByDate(completed) {
  const counts = {};
  for (const item of completed ?? []) {
    const key = workoutDateKey(item);
    if (key) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function weekdayAt(item, index) {
  const id = Number(item?.weekday?.id);
  return WEEKDAYS[(id >= 1 && id <= 7 ? id : index + 1) - 1];
}

// "Monday" for a "YYYY-MM-DD" key (a calendar date, no time zone maths).
export function weekdayNameOf(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return WEEKDAYS[(date.getDay() + 6) % 7].name;
}

const LABELS = Object.freeze({ done: 'Done', notStarted: '', missed: 'Missed', today: 'Today', todayRest: 'Today', train: 'Train', rest: 'Rest' });

// The 7 cells: [{ key, date, letter, short, kind, label, count, training,
// isToday, a11y }], or null without a valid /week (the view hides; the
// client never guesses).
export function weekByDate({ week, completed = [], startedOn, now = new Date() }) {
  if (!isValidWeek(week)) {
    return null;
  }
  const todayKey = localDateKey(now);
  const start = startDateKey(startedOn);
  const counts = workoutsByDate(completed);
  return week.map((item, index) => {
    const weekday = weekdayAt(item, index);
    const date = typeof item?.date === 'string' ? item.date : '';
    const training = item?.is_workout_day === true;
    const isToday = date === todayKey;
    const count = counts[date] ?? 0;
    let kind;
    if (count > 0) {
      kind = 'done';
    } else if (training && start && date && date < start) {
      kind = 'notStarted';
    } else if (training && date && date < todayKey) {
      kind = 'missed';
    } else if (isToday) {
      kind = training ? 'today' : 'todayRest';
    } else {
      kind = training ? 'train' : 'rest';
    }
    const words = {
      done: `${isToday ? 'today, done' : 'done'}${count > 1 ? `, ${count} workouts` : ''}`,
      notStarted: 'not started',
      missed: 'missed',
      today: 'today, training',
      todayRest: 'today, rest',
      train: 'training',
      rest: 'rest',
    };
    return {
      key: String(weekday.id),
      date,
      letter: weekday.label[0],
      short: weekday.label,
      kind,
      label: LABELS[kind],
      count,
      training,
      isToday,
      a11y: `${weekday.label}: ${words[kind]}`,
    };
  });
}

// "X of Y done": X = /week slots with status "done" (distinct planned
// workouts done this week, on any day); Y = training slots on or after
// started_on, PLUS any pre-start slot that is "done" (PM rule fix, 28 Oct:
// "3 of 1 done" on web), so X ≤ Y always (clamped too). Week complete =
// Y > 0 && X == Y. null without a valid week.
export function weekProgressByDate({ week, startedOn }) {
  if (!isValidWeek(week)) {
    return null;
  }
  const start = startDateKey(startedOn);
  const isDone = (item) => item?.status === 'done';
  const total = week.filter((item) => item?.is_workout_day === true && (!start || String(item.date) >= start || isDone(item))).length;
  const done = Math.min(week.filter(isDone).length, total);
  return { done, total, complete: total > 0 && done === total };
}

// The caption under a strip that shows a Not-started day:
// "Your plan started {Weekday}." (null when no such day is in view).
export function notStartedCaption(cells, startedOn) {
  const start = startDateKey(startedOn);
  if (!start || !(cells ?? []).some((cell) => cell.kind === 'notStarted')) {
    return null;
  }
  return `Your plan started ${weekdayNameOf(start)}.`;
}

// Plan detail's per-SLOT "This week" cards (PM ruling 3; RN-SPEC T-81): done =
// the server's slot status "done" (that plan day done this week, any date);
// notStarted = a slot dated before started_on; missed = a past slot not done;
// else today / upcoming. No /workouts call: the slot status carries done.
export function slotState({ item, startedOn, now = new Date() }) {
  const start = startDateKey(startedOn);
  const date = typeof item?.date === 'string' ? item.date : '';
  const todayKey = localDateKey(now);
  if (item?.status === 'done') {
    return 'done';
  }
  if (start && date && date < start) {
    return 'notStarted';
  }
  if (item?.status === 'missed' || (date && date < todayKey)) {
    return 'missed';
  }
  return item?.status === 'today' || date === todayKey ? 'today' : 'upcoming';
}
