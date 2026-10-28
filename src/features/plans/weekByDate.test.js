import { notStartedCaption, slotState, startDateKey, weekByDate, weekProgressByDate, weekdayNameOf, workoutsByDate } from './weekByDate';

// T-81 precedence tests (PM "DECIDED" + UX T81). Thursday 29 Oct 2026, local.
const NOW = new Date(2026, 9, 29, 9, 0);
const day = (id, title) => ({ id, title });
const item = (weekday, date, status, training, planDay = null) => ({ weekday: { id: weekday }, date, status, is_workout_day: training, plan_day: planDay });
// Training Mon, Tue, Thu, Sat; the plan STARTED Wednesday 28 Oct.
const WEEK = [
  item(1, '2026-10-26', 'rest', true, day(1, 'Power Circuit')),
  item(2, '2026-10-27', 'rest', true, day(2, 'Lower A')),
  item(3, '2026-10-28', 'rest', false),
  item(4, '2026-10-29', 'today', true, day(3, 'Upper B')),
  item(5, '2026-10-30', 'rest', false),
  item(6, '2026-10-31', 'upcoming', true, day(4, 'Lower B')),
  item(7, '2026-11-01', 'rest', false),
];
const STARTED = '2026-10-28T00:00:00Z';
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();

describe('weekByDate: per date, first match wins', () => {
  it('the owner case: Monday\'s workout done on Wednesday ticks WEDNESDAY; Mon/Tue before the start are "not started"', () => {
    const cells = weekByDate({ week: WEEK, completed: [{ workout_plan_day_id: 1, started_at: at(2026, 10, 28) }], startedOn: STARTED, now: NOW });
    expect(cells.map((cell) => cell.kind)).toEqual(['notStarted', 'notStarted', 'done', 'today', 'rest', 'train', 'rest']);
    expect(cells.map((cell) => cell.label)).toEqual(['', '', 'Done', 'Today', 'Rest', 'Train', 'Rest']);
    expect(cells[0].a11y).toBe('Mon: not started');
    expect(cells[2].a11y).toBe('Wed: done');
  });

  it('a past training day after the start with no workout that date is Missed', () => {
    const cells = weekByDate({ week: WEEK, completed: [], startedOn: '2026-10-25', now: NOW });
    expect(cells.slice(0, 4).map((cell) => cell.kind)).toEqual(['missed', 'missed', 'rest', 'today']);
    expect(cells[1].a11y).toBe('Tue: missed');
  });

  it('Done wins over everything, also on a non-training day; ×n with "n workouts" in the SR label', () => {
    const completed = [
      { started_at: at(2026, 10, 26, 8) },
      { started_at: at(2026, 10, 30, 7) },
      { started_at: at(2026, 10, 30, 18) },
    ];
    const cells = weekByDate({ week: WEEK, completed, startedOn: STARTED, now: NOW });
    // Monday is before the start but a workout happened that date: Done.
    expect(cells[0]).toMatchObject({ kind: 'done', count: 1, a11y: 'Mon: done' });
    expect(cells[4]).toMatchObject({ kind: 'done', count: 2, training: false, a11y: 'Fri: done, 2 workouts' });
  });

  it('today: training → today; done today → "today, done"; a rest-day today → todayRest', () => {
    expect(weekByDate({ week: WEEK, startedOn: STARTED, now: NOW })[3]).toMatchObject({ kind: 'today', a11y: 'Thu: today, training' });
    const done = weekByDate({ week: WEEK, completed: [{ started_at: at(2026, 10, 29, 7) }], startedOn: STARTED, now: NOW });
    expect(done[3]).toMatchObject({ kind: 'done', isToday: true, a11y: 'Thu: today, done' });
    const wed = weekByDate({ week: WEEK, startedOn: STARTED, now: new Date(2026, 9, 28, 9) });
    expect(wed[2]).toMatchObject({ kind: 'todayRest', a11y: 'Wed: today, rest' });
  });

  it('the workout day is the LOCAL date of started_at (completed_at only when started_at is missing)', () => {
    const lateNight = { started_at: new Date(2026, 9, 27, 23, 50).toISOString(), completed_at: new Date(2026, 9, 28, 0, 40).toISOString() };
    expect(workoutsByDate([lateNight])).toEqual({ '2026-10-27': 1 });
    expect(workoutsByDate([{ completed_at: at(2026, 10, 30) }, { started_at: 'nonsense' }, null])).toEqual({ '2026-10-30': 1 });
  });

  it('a week entry without a date (an older server) is never Missed or Not started by an empty date', () => {
    const undated = WEEK.map((entry) => ({ ...entry, date: undefined }));
    const cells = weekByDate({ week: undated, startedOn: STARTED, now: NOW });
    expect(cells.map((cell) => cell.kind)).toEqual(['train', 'train', 'rest', 'train', 'rest', 'train', 'rest']);
  });

  it('no valid /week → null (the view hides)', () => {
    expect(weekByDate({ week: null, now: NOW })).toBeNull();
    expect(weekByDate({ week: WEEK.slice(0, 6), now: NOW })).toBeNull();
  });
});

describe('weekProgressByDate: X of Y, week complete', () => {
  it('X = /week "done" slots (any day); Y = training days on or after started_on', () => {
    const week = WEEK.map((entry, index) => (index === 3 ? { ...entry, status: 'done' } : entry));
    expect(weekProgressByDate({ week, startedOn: STARTED })).toEqual({ done: 1, total: 2, complete: false });
    expect(weekProgressByDate({ week, startedOn: null })).toEqual({ done: 1, total: 4, complete: false });
  });

  it('week complete = Y > 0 && X == Y; a week with no training days is never complete', () => {
    const week = WEEK.map((entry, index) => (index === 3 || index === 5 ? { ...entry, status: 'done' } : entry));
    expect(weekProgressByDate({ week, startedOn: STARTED })).toEqual({ done: 2, total: 2, complete: true });
    const none = WEEK.map((entry) => ({ ...entry, is_workout_day: false }));
    expect(weekProgressByDate({ week: none, startedOn: STARTED }).complete).toBe(false);
  });
});

describe('PM rule fix: pre-start slots that are done count in Y (never "3 of 1")', () => {
  it('started Wednesday; Mon/Tue/Wed plan days all done ON Wednesday → Mon/Tue Not started, Wed Done ×3; 3 of 3, complete', () => {
    const week = [
      item(1, '2026-10-26', 'done', true, day(1, 'A')),
      item(2, '2026-10-27', 'done', true, day(2, 'B')),
      item(3, '2026-10-28', 'done', true, day(3, 'C')),
      item(4, '2026-10-29', 'rest', false),
      item(5, '2026-10-30', 'rest', false),
      item(6, '2026-10-31', 'rest', false),
      item(7, '2026-11-01', 'rest', false),
    ];
    const completed = [1, 2, 3].map((hour) => ({ started_at: at(2026, 10, 28, 8 + hour) }));
    const cells = weekByDate({ week, completed, startedOn: STARTED, now: NOW });
    expect(cells.slice(0, 3).map((cell) => [cell.kind, cell.count])).toEqual([
      ['notStarted', 0],
      ['notStarted', 0],
      ['done', 3],
    ]);
    expect(cells[2].a11y).toBe('Wed: done, 3 workouts');
    expect(weekProgressByDate({ week, startedOn: STARTED })).toEqual({ done: 3, total: 3, complete: true });
  });

  it('X is clamped to Y', () => {
    const odd = WEEK.map((entry, index) => (index === 2 ? { ...entry, status: 'done', is_workout_day: false } : entry));
    const progress = weekProgressByDate({ week: odd, startedOn: STARTED });
    expect(progress.done).toBeLessThanOrEqual(progress.total);
  });
});

describe('caption + helpers', () => {
  it('"Your plan started {Weekday}." only while a Not-started day is in view', () => {
    const cells = weekByDate({ week: WEEK, startedOn: STARTED, now: NOW });
    expect(notStartedCaption(cells, STARTED)).toBe('Your plan started Wednesday.');
    const later = weekByDate({ week: WEEK, startedOn: '2026-10-20', now: NOW });
    expect(notStartedCaption(later, '2026-10-20')).toBeNull();
  });

  it('started_on is date-only: the first 10 characters, never converted', () => {
    expect(startDateKey('2026-10-28T23:30:00-08:00')).toBe('2026-10-28');
    expect(startDateKey(undefined)).toBeNull();
    expect(weekdayNameOf('2026-10-28')).toBe('Wednesday');
  });
});

describe('slotState: Plan detail per-slot cards (PM ruling 3; RN-SPEC T-81: the slot status, no /workouts)', () => {
  it('done = the server\'s slot status; notStarted before the start; missed = a past slot not done; else today / upcoming', () => {
    expect(slotState({ item: { ...WEEK[0], status: 'done' }, startedOn: STARTED, now: NOW })).toBe('done');
    expect(slotState({ item: WEEK[1], startedOn: STARTED, now: NOW })).toBe('notStarted');
    expect(slotState({ item: WEEK[1], startedOn: '2026-10-20', now: NOW })).toBe('missed');
    expect(slotState({ item: WEEK[3], startedOn: STARTED, now: NOW })).toBe('today');
    expect(slotState({ item: WEEK[5], startedOn: STARTED, now: NOW })).toBe('upcoming');
  });
});
