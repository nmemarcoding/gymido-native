import {
  activePlanMeta,
  catalogMeta,
  catalogPlans,
  deriveLibrary,
  exercisesCountLabel,
  levelNameOf,
  localDateKey,
  nextWorkout,
  planDayTitle,
  weekCircles,
  weekDayLabel,
} from './libraryFormat';

// Dated change (27 Oct 2026, owner T-60): the phone Plans page helpers.
// "Today" in these tests is Thursday 29 Oct 2026 (local); the week runs
// Mon 26 Oct → Sun 1 Nov.
const THU = new Date(2026, 9, 29, 10, 0, 0);
const wd = (id) => ({ id, code: `D${id}`, name: `Day${id}`, sort_order: id });
const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const pd = (id, title) => ({ id, title, day_number: id });
// A /week with training on Mon (done), Thu (today) and Sat (upcoming).
function week(overrides = {}) {
  return DATES.map((date, index) => {
    const id = index + 1;
    const base = { weekday: wd(id), is_workout_day: false, date, status: 'rest' };
    const training = { 1: { plan_day: pd(11, 'Upper A'), status: 'done' }, 4: { plan_day: pd(12, 'Lower A'), status: 'today' }, 6: { plan_day: pd(13, 'Upper B'), status: 'upcoming' } }[id];
    return { ...base, ...(training ? { is_workout_day: true, ...training } : {}), ...(overrides[id] ?? {}) };
  });
}
const SCHEDULE = [
  { weekday: wd(1), plan_day: pd(11, 'Upper A') },
  { weekday: wd(4), plan_day: pd(12, 'Lower A') },
  { weekday: wd(6), plan_day: pd(13, 'Upper B') },
];

describe('localDateKey', () => {
  it('is the device-local YYYY-MM-DD', () => {
    expect(localDateKey(THU)).toBe('2026-10-29');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('weekCircles (Your week)', () => {
  it('a valid /week as is: training = is_workout_day AND status ≠ rest; today = the local date', () => {
    const circles = weekCircles({ week: week(), schedule: SCHEDULE, now: THU });
    expect(circles.map((c) => c.letter).join('')).toBe('MTWTFSS');
    expect(circles.map((c) => c.training)).toEqual([true, false, false, true, false, true, false]);
    expect(circles.map((c) => c.today)).toEqual([false, false, false, true, false, false, false]);
    expect(circles.map(weekDayLabel)).toEqual(['Mon: training', 'Tue: rest', 'Wed: rest', 'Thu: training, today', 'Fri: rest', 'Sat: training', 'Sun: rest']);
  });

  it('a training weekday dated before the enrollment (status rest) is a rest circle', () => {
    const circles = weekCircles({ week: week({ 1: { status: 'rest' } }), schedule: SCHEDULE, now: THU });
    expect(circles[0].training).toBe(false);
    expect(weekDayLabel(circles[0])).toBe('Mon: rest');
  });

  it('today on a rest day: "Sat: rest, today"', () => {
    const sat = new Date(2026, 9, 31, 9);
    const circles = weekCircles({ week: week({ 6: { is_workout_day: false, plan_day: undefined, status: 'rest' } }), schedule: SCHEDULE, now: sat });
    expect(weekDayLabel(circles[5])).toBe('Sat: rest, today');
  });

  it('a valid /week with no training day → null (the week hides; never seven rest days), even with a schedule', () => {
    const rest = DATES.map((date, index) => ({ weekday: wd(index + 1), is_workout_day: false, date, status: 'rest' }));
    expect(weekCircles({ week: rest, schedule: SCHEDULE, now: THU })).toBeNull();
    const preEnrollment = week({ 1: { status: 'rest' }, 4: { status: 'rest' }, 6: { status: 'rest' } });
    expect(weekCircles({ week: preEnrollment, schedule: SCHEDULE, now: THU })).toBeNull();
  });

  it('/week missing, failed or not 7 entries → the enrollment schedule; today = the local weekday', () => {
    for (const missing of [null, undefined, [], week().slice(0, 3)]) {
      const circles = weekCircles({ week: missing, schedule: SCHEDULE, now: THU });
      expect(circles.map((c) => c.training)).toEqual([true, false, false, true, false, true, false]);
      expect(circles[3].today).toBe(true);
    }
  });

  it('a valid /week wins over a disagreeing schedule (used as is)', () => {
    const tueOnly = DATES.map((date, index) => ({ weekday: wd(index + 1), is_workout_day: index === 1, date, status: index === 1 ? 'upcoming' : 'rest', plan_day: index === 1 ? pd(14, 'Arms') : undefined }));
    const circles = weekCircles({ week: tueOnly, schedule: SCHEDULE, now: THU });
    expect(circles.map((c) => c.training)).toEqual([false, true, false, false, false, false, false]);
  });

  it('"today" is the entry dated the LOCAL date, not the server status', () => {
    const fri = new Date(2026, 9, 30, 0, 5);
    const circles = weekCircles({ week: week(), schedule: SCHEDULE, now: fri });
    expect(circles.map((c) => c.today)).toEqual([false, false, false, false, true, false, false]);
    expect(weekDayLabel(circles[3])).toBe('Thu: training');
    expect(weekDayLabel(circles[4])).toBe('Fri: rest, today');
  });

  it('no /week and no schedule day → null', () => {
    expect(weekCircles({ week: null, schedule: [], now: THU })).toBeNull();
  });
});

describe('weekCircles, T-81 date strip (PM ruling 4: weekByDate with the completed workouts)', () => {
  // started_at at local noon, so the local date is the given one.
  const did = (date, extra = {}) => ({ status: 'completed', started_at: new Date(`${date}T12:00:00`).toISOString(), ...extra });

  it('done = the day you trained (any day, also a non-training day); missed = a past training day with none; train / rest / today', () => {
    // Mon's plan day was done on Tue (a rest day): the tick goes on TUESDAY.
    const circles = weekCircles({ week: week(), schedule: SCHEDULE, completed: [did('2026-10-27')], now: THU });
    expect(circles.map((c) => c.kind)).toEqual(['missed', 'done', 'rest', 'today', 'rest', 'train', 'rest']);
    expect(circles.map((c) => c.label)).toEqual(['Missed', 'Done', 'Rest', 'Today', 'Rest', 'Train', 'Rest']);
    expect(circles.map(weekDayLabel)).toEqual(['Mon: missed', 'Tue: done', 'Wed: rest', 'Thu: today, training', 'Fri: rest', 'Sat: training', 'Sun: rest']);
    expect(circles.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(circles.map((c) => c.today)).toEqual([false, false, false, true, false, false, false]);
  });

  it('×n: two workouts on one date → count 2, SR "Wed: done, 2 workouts"; today done → "Thu: today, done"', () => {
    const circles = weekCircles({ week: week(), schedule: SCHEDULE, completed: [did('2026-10-28'), did('2026-10-28'), did('2026-10-29')], now: THU });
    expect([circles[2].kind, circles[2].count, circles[2].label]).toEqual(['done', 2, 'Done']);
    expect(weekDayLabel(circles[2])).toBe('Wed: done, 2 workouts');
    expect(weekDayLabel(circles[3])).toBe('Thu: today, done');
    expect(circles[3].today).toBe(true);
  });

  it('notStarted: a training day before started_on (date-only), no label, SR "Mon: not started"', () => {
    const circles = weekCircles({ week: week({ 1: { status: 'rest' } }), schedule: SCHEDULE, completed: [], startedOn: '2026-10-28T00:00:00Z', now: THU });
    expect([circles[0].kind, circles[0].label, weekDayLabel(circles[0])]).toEqual(['notStarted', '', 'Mon: not started']);
  });

  it('null when no day trains and none is done; a done day alone keeps the week', () => {
    const rest = DATES.map((date, index) => ({ weekday: wd(index + 1), is_workout_day: false, date, status: 'rest' }));
    expect(weekCircles({ week: rest, schedule: SCHEDULE, completed: [], now: THU })).toBeNull();
    expect(weekCircles({ week: rest, schedule: SCHEDULE, completed: [did('2026-10-27')], now: THU }).map((c) => c.kind)[1]).toBe('done');
  });

  it('completed failed (null / undefined) → the pre-T-81 strip (no done / missed); /week missing → the schedule', () => {
    for (const completed of [null, undefined]) {
      const circles = weekCircles({ week: week(), schedule: SCHEDULE, completed, now: THU });
      expect(circles.map((c) => c.kind)).toEqual(['train', 'rest', 'rest', 'today', 'rest', 'train', 'rest']);
      expect(circles.map((c) => c.count)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    }
    expect(weekCircles({ week: null, schedule: SCHEDULE, completed: [did('2026-10-27')], now: THU }).map((c) => c.kind)).toEqual(['train', 'rest', 'rest', 'today', 'rest', 'train', 'rest']);
  });
});

describe('nextWorkout (§2a)', () => {
  const todayDay = pd(12, 'Lower A');

  it('start_workout + plan_day → Today, gold', () => {
    expect(nextWorkout({ today: { action: 'start_workout', is_workout_day: true, plan_day: todayDay }, week: week(), schedule: SCHEDULE, now: THU })).toEqual({
      when: 'Today',
      planDay: todayDay,
      gold: true,
    });
  });

  it('already_completed → the first upcoming day in /week, glass', () => {
    const next = nextWorkout({ today: { action: 'already_completed', already_completed: true, plan_day: todayDay }, week: week({ 4: { status: 'done' } }), schedule: SCHEDULE, now: THU });
    expect(next).toEqual({ when: 'Sat', planDay: pd(13, 'Upper B'), gold: false });
  });

  it('already_completed after the week’s last training day → wraps to the schedule’s first training day (Monday first)', () => {
    const sat = new Date(2026, 9, 31, 9);
    const done = week({ 4: { status: 'done' }, 6: { status: 'done' } });
    expect(nextWorkout({ today: { action: 'already_completed', plan_day: pd(13, 'Upper B') }, week: done, schedule: [...SCHEDULE].reverse(), now: sat })).toEqual({
      when: 'Mon',
      planDay: pd(11, 'Upper A'),
      gold: false,
    });
  });

  it('next_workout_day + plan_day → the weekday of that plan day later this week, glass', () => {
    const tue = new Date(2026, 9, 27, 9);
    const w = week({ 4: { status: 'upcoming' } });
    expect(nextWorkout({ today: { action: 'next_workout_day', plan_day: todayDay }, week: w, schedule: SCHEDULE, now: tue })).toEqual({ when: 'Thu', planDay: todayDay, gold: false });
  });

  it('next_workout_day with /week failed and the plan day repeated (Mon + Thu) → the NEXT weekday, not the first', () => {
    const tue = new Date(2026, 9, 27, 9);
    const repeated = [
      { weekday: wd(1), plan_day: pd(12, 'Lower A') },
      { weekday: wd(4), plan_day: pd(12, 'Lower A') },
    ];
    expect(nextWorkout({ today: { action: 'next_workout_day', plan_day: todayDay }, week: null, schedule: repeated, now: tue }).when).toBe('Thu');
    // Past the last one this week it wraps past Sunday to next week's first.
    const fri = new Date(2026, 9, 30, 9);
    expect(nextWorkout({ today: { action: 'next_workout_day', plan_day: todayDay }, week: null, schedule: repeated, now: fri }).when).toBe('Mon');
    const sun = new Date(2026, 10, 1, 9);
    expect(nextWorkout({ today: { action: 'next_workout_day', plan_day: todayDay }, week: null, schedule: repeated, now: sun }).when).toBe('Mon');
  });

  it('already_completed with /week failed → the schedule’s FIRST training day, Monday first (not the next after today)', () => {
    const mon = new Date(2026, 9, 26, 9);
    expect(nextWorkout({ today: { action: 'already_completed', plan_day: pd(11, 'Upper A') }, week: null, schedule: [...SCHEDULE].reverse(), now: mon })).toEqual({ when: 'Mon', planDay: pd(11, 'Upper A'), gold: false });
    const thu = new Date(2026, 9, 29, 9);
    expect(nextWorkout({ today: { action: 'already_completed', plan_day: pd(12, 'Lower A') }, week: null, schedule: SCHEDULE, now: thu }).when).toBe('Mon');
  });

  it('already_completed, no upcoming in /week and no schedule day → null (nothing found; no /week-based fallback)', () => {
    const done = week({ 4: { status: 'done' }, 6: { status: 'done' } });
    expect(nextWorkout({ today: { action: 'already_completed', plan_day: pd(13, 'Upper B') }, week: done, schedule: [], now: THU })).toBeNull();
    expect(nextWorkout({ today: { action: 'already_completed' }, week: null, schedule: [], now: THU })).toBeNull();
  });

  it('next_workout_day on Sunday with a valid /week (next week’s day) → the schedule wraps to Monday', () => {
    const sun = new Date(2026, 10, 1, 9);
    const done = week({ 4: { status: 'done' }, 6: { status: 'done' } });
    expect(nextWorkout({ today: { action: 'next_workout_day', plan_day: pd(11, 'Upper A') }, week: done, schedule: SCHEDULE, now: sun })).toEqual({ when: 'Mon', planDay: pd(11, 'Upper A'), gold: false });
  });

  it('a pre-enrollment week: /today missing and no today/upcoming item → null', () => {
    const pre = week({ 1: { status: 'rest' }, 4: { status: 'rest' }, 6: { status: 'rest' } });
    expect(nextWorkout({ today: null, week: pre, schedule: SCHEDULE, now: THU })).toBeNull();
  });

  it('/today missing or failed → /week’s today item (gold), else its first upcoming (glass)', () => {
    expect(nextWorkout({ today: null, week: week(), schedule: SCHEDULE, now: THU })).toEqual({ when: 'Today', planDay: pd(12, 'Lower A'), gold: true });
    expect(nextWorkout({ today: null, week: week({ 4: { status: 'done' } }), schedule: SCHEDULE, now: THU })).toEqual({ when: 'Sat', planDay: pd(13, 'Upper B'), gold: false });
  });

  it('nothing found → null (row and Start hidden)', () => {
    expect(nextWorkout({ today: null, week: null, schedule: SCHEDULE, now: THU })).toBeNull();
    const done = week({ 4: { status: 'done' }, 6: { status: 'done' } });
    expect(nextWorkout({ today: null, week: done, schedule: SCHEDULE, now: THU })).toBeNull();
    expect(nextWorkout({ today: { action: 'start_workout' }, week: null, schedule: [], now: THU })).toBeNull();
  });
});

describe('copy', () => {
  const levels = [{ id: 2, name: 'Intermediate' }];

  it('active meta "{category} · {n} days a week · {level}"; parts drop out; NBSP; singular', () => {
    expect(activePlanMeta({ category: { name: 'Strength' }, days_per_week: 4 }, 'Intermediate')).toBe('Strength · 4 days a week · Intermediate');
    expect(activePlanMeta({ days_per_week: 1 }, null)).toBe('1 day a week');
    expect(activePlanMeta({ category: { name: 'Strength' } }, null)).toBe('Strength');
  });

  it('catalog meta "{n} days a week · {level}"', () => {
    expect(catalogMeta({ days_per_week: 3 }, 'Intermediate')).toBe('3 days a week · Intermediate');
    expect(catalogMeta({ days_per_week: 3 }, null)).toBe('3 days a week');
    expect(catalogMeta({}, 'Beginner')).toBe('Beginner');
  });

  it('level by difficulty_level_id; missing → null', () => {
    expect(levelNameOf({ difficulty_level_id: 2 }, levels)).toBe('Intermediate');
    expect(levelNameOf({ difficulty_level_id: 9 }, levels)).toBeNull();
    expect(levelNameOf({}, levels)).toBeNull();
    expect(levelNameOf({ difficulty_level_id: 2 }, null)).toBeNull();
  });

  it('" · n exercises" with NBSP, "1 exercise"', () => {
    expect(exercisesCountLabel(5)).toBe('5 exercises');
    expect(exercisesCountLabel(1)).toBe('1 exercise');
    expect(exercisesCountLabel(undefined)).toBe('');
    expect(exercisesCountLabel(null)).toBe('');
  });

  it('planDayTitle: the title, else "Day n"', () => {
    expect(planDayTitle(pd(1, 'Upper A'))).toBe('Upper A');
    expect(planDayTitle({ day_number: 2, title: '' })).toBe('Day 2');
  });

  it('catalogPlans: the same plans in the same order as the old grouped list, no headings', () => {
    const plans = [
      { id: 1, is_active: true, category: { name: 'Strength' } },
      { id: 2, is_active: true, category: { name: 'Hypertrophy' } },
      { id: 3, is_active: true, category: { name: 'Strength' } },
      { id: 4, is_active: false, category: { name: 'Strength' } },
    ];
    expect(catalogPlans(deriveLibrary(plans, null)).map((p) => p.id)).toEqual([1, 3, 2]);
  });
});
