import {
  workoutTitle,
  dayA11y,
  doneRows,
  finishedPlan,
  newestWorkout,
  weekReference,
  dayCells,
  daySheet,
  hoursMinutes,
  lastWhenText,
  lastWorkoutCell,
  missedLine,
  planLine,
  planWeekNumber,
  primaryAction,
  ringLabel,
  sheetDayIds,
  sheetRows,
  weekStats,
} from './pageModel';

// T-140 Workout page "A-balanced" (UX T140-workout-page-BUILD-ruling, FE
// T140-data-check, PM amendments 30 Oct 2026): the pure rules.

// Friday 30 Oct 2026, 09:00 local.
const NOW = new Date(2026, 9, 30, 9, 0);
const at = (day, hour = 10, month = 9) => new Date(2026, month, day, hour).toISOString();

describe('plan line (§6)', () => {
  it('week N counts Monday weeks from started_on; the start week is week 1', () => {
    expect(planWeekNumber('2026-10-26', NOW)).toBe(1);
    expect(planWeekNumber('2026-10-25', NOW)).toBe(2); // a Sunday: the week before
    expect(planWeekNumber('2026-10-12T00:00:00Z', NOW)).toBe(3); // date-only: the first 10 characters
    expect(planWeekNumber('2026-11-02', NOW)).toBe(1); // not started yet: week 1, as web (reviewer L2)
    expect(planWeekNumber(null, NOW)).toBeNull();
  });

  it('"{plan name} · week N"; "{n}-day split" only without a name; hidden without a start', () => {
    expect(planLine({ name: 'Upper / Lower', days_per_week: 4 }, '2026-10-12', NOW)).toBe('Upper / Lower · week 3');
    expect(planLine({ name: '  ', days_per_week: 3 }, '2026-10-12', NOW)).toBe('3-day split · week 3');
    expect(planLine({ name: 'Plan' }, null, NOW)).toBeNull();
    expect(planLine(null, '2026-10-12', NOW)).toBeNull();
  });
});

describe('stats card (§7: this week\'s completed /workouts sums)', () => {
  it('time "1h 43m" / "48m" / "0m"', () => {
    expect(hoursMinutes(6180)).toBe('1h 43m');
    expect(hoursMinutes(2880)).toBe('48m');
    expect(hoursMinutes(0)).toBe('0m');
    expect(hoursMinutes(null)).toBe('0m');
  });

  it('sums duration_seconds and total_volume_kg (never the raw total_volume), in the member unit', () => {
    const items = [
      { duration_seconds: 2880, total_volume_kg: 3940, total_volume: 99999 },
      { duration_seconds: 3300, total_volume_kg: '4000' },
    ];
    expect(weekStats(items, 'kg')).toEqual({ time: '1h 43m', volume: '7,940 kg' });
    expect(weekStats(items, 'lb').volume).toBe('17,505 lb');
    expect(weekStats([], 'kg')).toEqual({ time: '0m', volume: '0 kg' });
    // Items but none with total_volume_kg → "—" (null); the raw total_volume never counts.
    expect(weekStats([{ duration_seconds: 60, total_volume: 500 }], 'kg').volume).toBeNull();
  });
});

describe('Last workout when-text (§7)', () => {
  it('Today / Yesterday / this week "Wed" / "Last Fri" / "Oct 12"', () => {
    expect(lastWhenText({ started_at: at(30, 7) }, NOW)).toBe('Today');
    expect(lastWhenText({ started_at: at(29) }, NOW)).toBe('Yesterday');
    expect(lastWhenText({ started_at: at(28) }, NOW)).toBe('Wed');
    expect(lastWhenText({ started_at: at(23) }, NOW)).toBe('Last Fri');
    expect(lastWhenText({ started_at: at(19) }, NOW)).toBe('Last Mon');
    expect(lastWhenText({ started_at: at(12) }, NOW)).toBe('Oct 12');
    expect(lastWhenText({ completed_at: at(28) }, NOW)).toBe('Wed');
  });

  it('a Sunday-to-Monday "Yesterday" wins over "Last Sun"', () => {
    const monday = new Date(2026, 10, 2, 9);
    expect(lastWhenText({ started_at: at(1, 10, 10) }, monday)).toBe('Yesterday');
  });
});

const PD = (id, title, count = 5) => ({ id, title, exercises_count: count });
const cell = (kind, extra = {}) => ({ key: '1', date: '2026-10-26', letter: 'M', kind, isToday: false, ...extra });

describe('day cells + sheets (§5)', () => {
  const week = [
    { date: '2026-10-26', plan_day: PD(1, 'Upper A') },
    { date: '2026-10-27', plan_day: PD(2, 'Lower A') },
    { date: '2026-10-28', plan_day: null },
    { date: '2026-10-29', plan_day: PD(3, 'Upper B') },
    { date: '2026-10-30', plan_day: PD(4, 'Lower B') },
    { date: '2026-10-31', plan_day: PD(5, 'Full') },
    { date: '2026-11-01', plan_day: null },
  ];
  const strip = [
    cell('done', { key: '1', date: '2026-10-26' }),
    cell('missed', { key: '2', date: '2026-10-27' }),
    cell('rest', { key: '3', date: '2026-10-28' }),
    cell('notStarted', { key: '4', date: '2026-10-29' }),
    cell('today', { key: '5', date: '2026-10-30', isToday: true }),
    cell('train', { key: '6', date: '2026-10-31' }),
    cell('rest', { key: '7', date: '2026-11-01' }),
  ];
  const completed = [
    { workout_plan_day_id: 1, started_at: at(26, 18), duration_seconds: 1500, workout_plan_day: { title: 'Upper A' } },
    { workout_plan_day_id: 4, started_at: at(26, 8), duration_seconds: 2700, workout_plan_day: { title: 'Lower B' } },
  ];
  const misses = [{ weekdayName: 'Tuesday', planDay: PD(2, 'Lower A') }];
  const cells = dayCells({ strip, week, completed, misses });

  it('types: done / missed / rest / not started → rest / today / train → future', () => {
    expect(cells.map((item) => item.type)).toEqual(['done', 'missed', 'rest', 'rest', 'today', 'future', 'rest']);
    expect(cells[1].openMiss).toBe(true);
    expect(cells[0].done.map((item) => item.workout_plan_day_id)).toEqual([4, 1]); // in order done
  });

  it('a11y: "{Weekday}[, today], {status}[, {workout}]"', () => {
    expect(dayA11y(cells[1])).toBe('Tuesday, missed, Lower A');
    expect(dayA11y(cells[4])).toBe('Friday, today, planned, Lower B');
    expect(dayA11y(cells[2])).toBe('Wednesday, rest day');
    expect(dayA11y(cells[0])).toBe('Monday, done, Upper A');
  });

  it('a day done twice: ONE sheet, summed minutes + "· 2 workouts", the planned name, the lists merged', () => {
    expect(daySheet(cells[0], { count: 9 })).toMatchObject({
      tone: 'done',
      eyebrow: 'Monday · Done',
      title: 'Upper A',
      meta: '1h 10m · 2 workouts',
      list: 'done',
      action: null,
    });
    expect(sheetDayIds(cells[0])).toEqual([4, 1]);
  });

  it('done once: "{duration} · {n} exercises"; done today: "Today · Done"', () => {
    const once = { ...cells[0], isToday: true, done: [completed[0]] };
    expect(daySheet(once, { count: 6 })).toMatchObject({ eyebrow: 'Today · Done', meta: '25m · 6 exercises' });
  });

  it('missed (open): gold Start = catch-up + "Catch up works this week only."; not open: no action', () => {
    expect(daySheet(cells[1])).toMatchObject({ eyebrow: 'Tuesday · Missed', title: 'Lower A', meta: '5 exercises', action: 'catchUp', note: 'Catch up works this week only.' });
    expect(daySheet({ ...cells[1], openMiss: false })).toMatchObject({ action: null, note: null });
  });

  it('today / future / rest', () => {
    expect(daySheet(cells[4])).toMatchObject({ eyebrow: 'Today · Friday', title: 'Lower B', action: 'start', list: 'plan' });
    expect(daySheet(cells[5])).toMatchObject({ eyebrow: 'Saturday · Planned', title: 'Full', action: 'early' });
    expect(daySheet(cells[2])).toMatchObject({ eyebrow: 'Wednesday', title: 'Rest day', meta: 'Recovery is part of the plan.', list: null, action: null });
  });

  it('rows: merged by exercise in order, at most 6 then "+N more"; undefined while loading', () => {
    const ex = (id) => ({ exercise: { id, name: `E${id}` }, target_set_summary: { set_count: 3, target_reps_min: 8, target_reps_max: 8 } });
    expect(sheetRows([1, 4], { 1: [ex(1)] })).toBeUndefined();
    const merged = sheetRows([1, 4], { 1: [ex(1), ex(2), ex(3), ex(4)], 4: [ex(4), ex(5), ex(6), ex(7), ex(8)] });
    expect(merged.count).toBe(8);
    // UX C2 (web parity): up to 6 rows, then "+N more".
    expect(merged.rows.map((row) => row.name)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6']);
    expect(merged.more).toBe(2);
    expect(merged.rows[0].meta).toBe('3×8');
    expect(sheetRows([1], { 1: [ex(1), ex(2), ex(3), ex(4), ex(5), ex(6)] })).toMatchObject({ more: 0, count: 6 });
  });

  it('Last workout this week → that day\'s cell; before this week → a read-only Done sheet "{when} · Done"', () => {
    expect(lastWorkoutCell(completed[0], cells, NOW).index).toBe(0);
    const old = { workout_plan_day_id: 2, started_at: at(12), duration_seconds: 3000, workout_plan_day: { title: 'Lower A' } };
    const past = lastWorkoutCell(old, cells, NOW);
    expect(daySheet(past, { count: 5 })).toMatchObject({ eyebrow: 'Oct 12 · Done', title: 'Lower A', meta: '50m · 5 exercises', action: null });
    const lastWeek = lastWorkoutCell({ ...old, started_at: at(23) }, cells, NOW);
    expect(daySheet(lastWeek).eyebrow).toBe('Last Fri · Done');
  });
});

describe('the one gold action (§8) + the missed line + the ring label', () => {
  const misses = [
    { weekdayName: 'Wednesday', planDay: PD(2, 'Back & Shoulders') },
    { weekdayName: 'Monday', planDay: PD(1, 'Chest') },
  ];
  it('training → today; otherwise the most recent open miss; else none', () => {
    expect(primaryAction({ state: 'training', todayDayId: 4, todayTitle: 'Legs', misses })).toEqual({ kind: 'start', dayId: 4, label: 'Start Legs' });
    expect(primaryAction({ state: 'rest', misses })).toMatchObject({ kind: 'catchUp', dayId: 2, label: 'Start Back & Shoulders' });
    expect(primaryAction({ state: 'todayDone', misses })).toMatchObject({ kind: 'catchUp', dayId: 2 });
    expect(primaryAction({ state: 'rest', misses: [] })).toBeNull();
    expect(primaryAction({ state: 'todayDone', misses: [] })).toBeNull();
    expect(primaryAction({ state: 'weekComplete', misses: [] })).toBeNull();
  });

  it('missed line: the most recent + "+N more"; none without a miss', () => {
    expect(missedLine(misses)).toMatchObject({ weekday: 'Wednesday', more: 1 });
    expect(missedLine([misses[0]]).more).toBe(0);
    expect(missedLine([])).toBeNull();
  });

  it('ring label under the ring', () => {
    expect(ringLabel('training')).toBe('workouts this week');
    expect(ringLabel('todayDone')).toBe('workouts this week');
    expect(ringLabel('rest')).toBe('Rest day today');
    expect(ringLabel('weekComplete')).toBe('Week complete');
  });
});

describe('RN-SPEC T-140 additions', () => {
  it('Done rows: exercises with ≥ 1 completed set, merged by exercise_id in session order, "{n} sets"; loading / failed', () => {
    const ex = (exerciseId, name, done, total = 3) => ({ exercise_id: exerciseId, exercise_name_snapshot: name, sets: Array.from({ length: total }, (_, i) => ({ is_completed: i < done })) });
    const a = { exercises: [ex(1, 'Squat', 3), ex(2, 'Lunge', 0), ex(3, 'Curl', 1)] };
    const b = { exercises: [ex(1, 'Squat', 2), ex(4, 'Row', 1)] };
    expect(doneRows([a, b])).toEqual({ rows: [{ key: '1', name: 'Squat', meta: '5 sets' }, { key: '3', name: 'Curl', meta: '1 set' }, { key: '4', name: 'Row', meta: '1 set' }], more: 0, count: 3 });
    expect(doneRows([a, undefined])).toBeUndefined();
    expect(doneRows([a, null])).toBeNull();
  });

  it('a Done sheet\'s planned fallback has no detail', () => {
    const ex = (id) => ({ exercise: { id, name: `E${id}` }, target_set_summary: { set_count: 3, target_reps_min: 8 } });
    expect(sheetRows([1], { 1: [ex(1)] }, { bare: true }).rows[0].meta).toBe('');
  });

  it('Last workout = the newest of this week by started_at, else the per_page=1 one', () => {
    const mon = { id: 1, started_at: at(26) };
    const wed = { id: 2, started_at: at(28) };
    expect(newestWorkout([wed, mon], { id: 9 })).toBe(wed);
    expect(newestWorkout([], { id: 9 })).toEqual({ id: 9 });
    expect(newestWorkout([], null)).toBeNull();
  });

  it('week N counts to the server week\'s first date (the device today without /week)', () => {
    const week = [{ date: '2026-11-02' }, {}, {}, {}, {}, {}, {}];
    expect(planWeekNumber('2026-10-26', weekReference(week, NOW))).toBe(2);
    expect(planWeekNumber('2026-10-26', weekReference(null, NOW))).toBe(1);
  });

  it('Plan finished: the newest enrollment (highest id) is completed', () => {
    expect(finishedPlan([{ id: 3, status: 'completed', plan: { name: 'A' } }, { id: 7, status: 'completed', plan: { name: 'B' } }])).toEqual({ name: 'B' });
    expect(finishedPlan([{ id: 3, status: 'completed', plan: { name: 'A' } }, { id: 7, status: 'cancelled', plan: { name: 'B' } }])).toBeNull();
    expect(finishedPlan([])).toBeNull();
  });
});

// Reviewer M1 (77dd372): GET /workouts LIST items carry only workout_plan_day_id
// (the workout_plan_day object is on the detail only). Web's chain: the plan
// day by id → the session name → an embedded plan day → 'Workout'.
describe('titles from the real list shape (M1)', () => {
  const planDays = [PD(1, 'Upper A'), PD(2, 'Lower A')];
  const wire = (extra) => ({ id: 70, workout_plan_day_id: 2, status: 'completed', started_at: at(23), duration_seconds: 3000, ...extra });

  it('the plan day by id, then the session name, then an embedded plan day, then "Workout"', () => {
    expect(workoutTitle(wire(), planDays)).toBe('Lower A');
    expect(workoutTitle(wire({ workout_plan_day_id: 99, name: 'Evening lift' }), planDays)).toBe('Evening lift');
    expect(workoutTitle(wire({ workout_plan_day_id: null }), planDays)).toBe('Workout');
    expect(workoutTitle({ workout_plan_day: { title: 'From detail' } }, [])).toBe('From detail');
  });

  it('a past Done sheet and a no-slot done day are titled from the plan days', () => {
    expect(daySheet(lastWorkoutCell(wire(), [], NOW, planDays)).title).toBe('Lower A');
    const strip = [cell('done', { key: '1', date: '2026-10-28' })];
    const [rest] = dayCells({ strip, week: [{ date: '2026-10-28', plan_day: null }], completed: [wire({ started_at: at(28) })], planDays });
    expect(daySheet(rest).title).toBe('Lower A');
    expect(dayA11y(rest)).toBe('Monday, done, Lower A');
  });
});
