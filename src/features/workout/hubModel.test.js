import { NBSP } from '../../shared/format/counts';
import {
  OTHER_DAYS_COPY,
  dayRows,
  effectiveWeek,
  hubState,
  hubWeek,
  muscleLine,
  startConfirmCopy,
  todayDoneDetail,
  todayDurationMinutes,
  todayMeta,
  upNext,
  weekCompleteDetail,
  weekProgress,
  weekStrip,
} from './hubModel';

// Counts keep the number and its word together with U+00A0.
const s = (text) => text.replace(/(\d) /g, `$1${NBSP}`);
// Thursday 29 Oct 2026 (local); the week runs Mon 26 … Sun 1 Nov.
const NOW = new Date(2026, 9, 29, 9, 0);
const DAYS = [
  { id: 1, title: 'Upper A', exercises_count: 5 },
  { id: 2, title: 'Lower A', exercises_count: 5 },
  { id: 3, title: 'Upper B', exercises_count: 6 },
  { id: 4, title: 'Lower B', exercises_count: 5 },
];
const wd = (id) => ({ id });
const SCHEDULE = [
  { weekday: wd(1), plan_day: DAYS[0] },
  { weekday: wd(2), plan_day: DAYS[1] },
  { weekday: wd(4), plan_day: DAYS[2] },
  { weekday: wd(6), plan_day: DAYS[3] },
];
const item = (day, date, status, planDay = null) => ({ weekday: wd(day), date, status, is_workout_day: Boolean(planDay), plan_day: planDay });
// The main board: Mon/Tue done, Wed rest, Thu today (Upper B), Fri rest, Sat Lower B, Sun rest.
const WEEK = [
  item(1, '2026-10-26', 'done', DAYS[0]),
  item(2, '2026-10-27', 'done', DAYS[1]),
  item(3, '2026-10-28', 'rest'),
  item(4, '2026-10-29', 'today', DAYS[2]),
  item(5, '2026-10-30', 'rest'),
  item(6, '2026-10-31', 'upcoming', DAYS[3]),
  item(7, '2026-11-01', 'rest'),
];
const PLAN = { enrollment: { id: 31, plan: { id: 3, name: 'Upper / Lower Split' } }, schedule: SCHEDULE };

describe('hubState: one state, in priority order', () => {
  const training = { is_workout_day: true, already_completed: false, plan_day: DAYS[2] };
  it('training / rest / today done from the today status', () => {
    expect(hubState({ currentPlan: PLAN, todayStatus: training, planDays: DAYS, week: WEEK })).toBe('training');
    expect(hubState({ currentPlan: PLAN, todayStatus: { is_workout_day: false }, planDays: DAYS, week: WEEK })).toBe('rest');
    expect(hubState({ currentPlan: PLAN, todayStatus: { ...training, already_completed: true }, planDays: DAYS, week: WEEK })).toBe('todayDone');
  });

  it('no plan, then no schedule, then week complete win over the today status', () => {
    expect(hubState({ currentPlan: null, todayStatus: training })).toBe('noPlan');
    expect(hubState({ currentPlan: { ...PLAN, schedule: [] }, todayStatus: training, planDays: DAYS, week: WEEK })).toBe('noSchedule');
    const allDone = WEEK.map((entry) => (entry.plan_day ? { ...entry, status: 'done' } : entry));
    expect(hubState({ currentPlan: PLAN, todayStatus: { ...training, already_completed: true }, planDays: DAYS, week: allDone })).toBe('weekComplete');
  });

  it('a missing week never makes "week complete"', () => {
    expect(hubState({ currentPlan: PLAN, todayStatus: { is_workout_day: false }, planDays: DAYS, week: null })).toBe('rest');
  });

  it('RN-SPEC T-76 order: a not-done training today wins over week complete', () => {
    const allDone = WEEK.map((entry) => (entry.plan_day ? { ...entry, status: 'done' } : entry));
    expect(hubState({ currentPlan: PLAN, todayStatus: training, planDays: DAYS, week: allDone })).toBe('training');
    expect(hubState({ currentPlan: PLAN, todayStatus: { is_workout_day: false }, planDays: DAYS, week: allDone })).toBe('weekComplete');
  });
});

describe('weekProgress: "X of Y done" from /week', () => {
  it('Y = the slots whose status is not rest; X = the done ones (rest and pre-enrolment rest excluded)', () => {
    expect(weekProgress(WEEK)).toEqual({ done: 2, total: 4 });
    const preEnrolment = WEEK.map((entry, index) => (index === 0 ? { ...entry, status: 'rest' } : entry));
    expect(weekProgress(preEnrolment)).toEqual({ done: 1, total: 3 });
  });

  it('missed counts as not done; no valid week → null', () => {
    const missed = WEEK.map((entry, index) => (index === 1 ? { ...entry, status: 'missed' } : entry));
    expect(weekProgress(missed)).toEqual({ done: 1, total: 4 });
    expect(weekProgress(null)).toBeNull();
    expect(weekProgress(WEEK.slice(0, 6))).toBeNull();
  });
});

describe('effectiveWeek: /week, else rebuilt from the schedule + history by device date', () => {
  it('a valid /week is used as is', () => {
    expect(effectiveWeek({ week: WEEK, schedule: SCHEDULE, doneIds: [], now: NOW })).toBe(WEEK);
  });

  it('no /week: done if the slot\'s day was completed, else today / missed (past) / upcoming (later); no slot = rest', () => {
    const built = effectiveWeek({ week: null, schedule: SCHEDULE, doneIds: [1], now: NOW });
    expect(built.map((entry) => entry.status)).toEqual(['done', 'missed', 'rest', 'today', 'rest', 'upcoming', 'rest']);
    expect(built.map((entry) => entry.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(built[3]).toMatchObject({ weekday: { id: 4 }, is_workout_day: true, plan_day: DAYS[2] });
    expect(weekProgress(built)).toEqual({ done: 1, total: 4 });
    expect(weekStrip(built, NOW).map((cell) => cell.kind)).toEqual(['done', 'missed', 'rest', 'today', 'rest', 'train', 'rest']);
  });

  it('no /week and no schedule → null', () => {
    expect(effectiveWeek({ week: undefined, schedule: [], doneIds: [], now: NOW })).toBeNull();
  });
});

describe('weekStrip: Mon–Sun cells (C3 missed, SR labels)', () => {
  it('the main board: Done, Done, Rest, Today, Rest, Train, Rest', () => {
    const strip = weekStrip(WEEK, NOW);
    expect(strip.map((cell) => cell.kind)).toEqual(['done', 'done', 'rest', 'today', 'rest', 'train', 'rest']);
    expect(strip.map((cell) => cell.label)).toEqual(['Done', 'Done', 'Rest', 'Today', 'Rest', 'Train', 'Rest']);
    expect(strip.map((cell) => cell.letter).join('')).toBe('MTWTFSS');
    expect(strip[0].a11y).toBe('Mon: done');
    expect(strip[3].a11y).toBe('Thu: today, training');
    expect(strip[5].a11y).toBe('Sat: training');
    expect(strip[6].a11y).toBe('Sun: rest');
  });

  it('a rest-day today is the gold outline "Today"; today done is Done', () => {
    const restToday = weekStrip(WEEK, new Date(2026, 9, 28, 9));
    expect(restToday[2]).toMatchObject({ kind: 'todayRest', label: 'Today', a11y: 'Wed: today, rest' });
    const doneToday = WEEK.map((entry, index) => (index === 3 ? { ...entry, status: 'done' } : entry));
    expect(weekStrip(doneToday, NOW)[3]).toMatchObject({ kind: 'done', label: 'Done', a11y: 'Thu: today, done' });
  });

  it('missed: its own kind, label "Missed", SR "Tue: missed"', () => {
    const missed = WEEK.map((entry, index) => (index === 1 ? { ...entry, status: 'missed' } : entry));
    expect(weekStrip(missed, NOW)[1]).toEqual({ key: '2', letter: 'T', label: 'Missed', kind: 'missed', a11y: 'Tue: missed' });
  });

  it('no valid week → null (the week card hides)', () => {
    expect(weekStrip(undefined, NOW)).toBeNull();
  });
});

// T-81 (PM "DECIDED" + RN-SPEC T-81): the server's /week goes by date; the
// /week-failed fallback stays exactly as before.
describe('T-81 hubWeek + hubState by date', () => {
  const at = (d, h = 10) => new Date(2026, 9, d, h).toISOString();
  // The plan started Wednesday 28 Oct; /week says Mon/Tue were not slots yet.
  const preStart = WEEK.map((entry, index) => (index < 2 ? { ...entry, status: 'rest' } : entry));
  const STARTED = '2026-10-28';

  it('Not started: training days before started_on, empty label, SR "Mon: not started", the caption; X of Y from started_on', () => {
    const view = hubWeek({ week: preStart, schedule: SCHEDULE, completed: [], startedOn: STARTED, now: NOW });
    expect(view.byDate).toBe(true);
    expect(view.week).toBe(preStart);
    expect(view.strip.map((cell) => cell.kind)).toEqual(['notStarted', 'notStarted', 'rest', 'today', 'rest', 'train', 'rest']);
    expect(view.strip[0]).toMatchObject({ label: '', a11y: 'Mon: not started', letter: 'M' });
    expect(view.caption).toBe('Your plan started Wednesday.');
    expect(view.progress).toEqual({ done: 0, total: 2, complete: false });
  });

  it('×n and Done on a non-training day: the workouts by the LOCAL date of started_at', () => {
    const completed = [
      { workout_plan_day_id: 1, started_at: at(26) },
      { workout_plan_day_id: 2, started_at: at(28, 8) },
      { workout_plan_day_id: 3, started_at: at(28, 18) },
    ];
    const view = hubWeek({ week: WEEK, schedule: SCHEDULE, completed, startedOn: '2026-10-01', now: NOW });
    expect(view.strip[2]).toMatchObject({ kind: 'done', label: 'Done', count: 2, training: false, a11y: 'Wed: done, 2 workouts' });
    expect(view.strip[0]).toMatchObject({ kind: 'done', count: 1, a11y: 'Mon: done' });
    // Tue's slot is "done" on /week but nothing was STARTED on Tue: Missed by date.
    expect(view.strip[1]).toMatchObject({ kind: 'missed', a11y: 'Tue: missed' });
    expect(view.caption).toBeNull();
    // X = the /week slots done (any day): Mon + Tue.
    expect(view.progress).toEqual({ done: 2, total: 4, complete: false });
  });

  it('no /week: the fallback week through weekStrip / weekProgress, no Not started, no ×n, no caption', () => {
    const completed = [{ workout_plan_day_id: 1, started_at: at(28, 8) }, { workout_plan_day_id: 3, started_at: at(28, 18) }];
    const view = hubWeek({ week: null, schedule: SCHEDULE, doneIds: [1], completed, startedOn: STARTED, now: NOW });
    const built = effectiveWeek({ week: null, schedule: SCHEDULE, doneIds: [1], now: NOW });
    expect(view.byDate).toBe(false);
    expect(view.week).toEqual(built);
    expect(view.strip).toEqual(weekStrip(built, NOW));
    expect(view.strip.map((cell) => cell.kind)).toEqual(['done', 'missed', 'rest', 'today', 'rest', 'train', 'rest']);
    expect(view.progress).toEqual({ done: 1, total: 4 });
    expect(view.caption).toBeNull();
    expect(hubWeek({ week: null, schedule: [], now: NOW })).toMatchObject({ week: null, strip: null, progress: null, caption: null });
  });

  it('week complete = Y > 0 && X == Y, Y counted from started_on (the plan days, on any days)', () => {
    const plan = { ...PLAN, enrollment: { ...PLAN.enrollment, started_on: `${STARTED}T00:00:00Z` } };
    const rest = { is_workout_day: false };
    const doneAfterStart = preStart.map((entry, index) => (index === 3 || index === 5 ? { ...entry, status: 'done' } : entry));
    expect(hubState({ currentPlan: plan, todayStatus: rest, planDays: DAYS, week: doneAfterStart })).toBe('weekComplete');
    // Without started_on, Mon/Tue still count: 2 of 4, not complete.
    expect(hubState({ currentPlan: PLAN, todayStatus: rest, planDays: DAYS, week: doneAfterStart })).toBe('rest');
    // DECLARED (PM Y-rule fix, 28 Oct): pre-start slots that are DONE now count in Y ("3 of 1" on web).
    // Was: a late start with Thu + Sat done → 'rest' (Y = 0). Now 2 of 2 → 'weekComplete'.
    const late = { ...PLAN, enrollment: { ...PLAN.enrollment, started_on: '2026-11-02' } };
    expect(hubState({ currentPlan: late, todayStatus: rest, planDays: DAYS, week: doneAfterStart })).toBe('weekComplete');
    // Y = 0 (every training day before the start, none done) is never complete.
    expect(hubState({ currentPlan: late, todayStatus: rest, planDays: DAYS, week: preStart })).toBe('rest');
  });

  it('the fallback (byDate false) keeps the pre-T-81 week-complete rule', () => {
    const allDone = WEEK.map((entry) => (entry.plan_day ? { ...entry, status: 'done' } : entry));
    const plan = { ...PLAN, enrollment: { ...PLAN.enrollment, started_on: '2026-11-02' } };
    expect(hubState({ currentPlan: plan, todayStatus: { is_workout_day: false }, planDays: DAYS, week: allDone, byDate: false })).toBe('weekComplete');
    // DECLARED (PM Y-rule fix): was 'rest' by date (Y = 0 before the start); the done pre-start slots now
    // count in Y, so by date it is complete too.
    expect(hubState({ currentPlan: plan, todayStatus: { is_workout_day: false }, planDays: DAYS, week: allDone })).toBe('weekComplete');
  });
});

describe('upNext: the first upcoming after today, else next week from the schedule', () => {
  it('the first upcoming /week item; "Tomorrow" when it is tomorrow, else the weekday', () => {
    expect(upNext({ week: WEEK, schedule: SCHEDULE, planDays: DAYS, now: NOW })).toEqual({
      dayId: 4,
      title: 'Lower B',
      when: 'Saturday',
      meta: s('Saturday · 5 exercises'),
    });
    const wednesday = new Date(2026, 9, 28, 9);
    const fromWed = WEEK.map((entry, index) => (index === 3 ? { ...entry, status: 'upcoming' } : entry));
    expect(upNext({ week: fromWed, schedule: SCHEDULE, planDays: DAYS, now: wednesday })).toMatchObject({ title: 'Upper B', when: 'Tomorrow', meta: s('Tomorrow · 6 exercises') });
  });

  it('nothing upcoming → next week\'s first training day (Monday first) from the schedule', () => {
    const noneLeft = WEEK.map((entry) => (entry.status === 'upcoming' || entry.status === 'today' ? { ...entry, status: 'done' } : entry));
    expect(upNext({ week: noneLeft, schedule: SCHEDULE, planDays: DAYS, now: NOW })).toMatchObject({ dayId: 1, title: 'Upper A', when: 'Monday' });
  });

  it('next week\'s first day that is tomorrow (Sunday → Monday) says "Tomorrow" (review M2)', () => {
    const noneLeft = WEEK.map((entry) => (entry.status === 'upcoming' || entry.status === 'today' ? { ...entry, status: 'done' } : entry));
    const sunday = new Date(2026, 10, 1, 9);
    expect(upNext({ week: noneLeft, schedule: SCHEDULE, planDays: DAYS, now: sunday })).toEqual({
      dayId: 1,
      title: 'Upper A',
      when: 'Tomorrow',
      meta: s('Tomorrow · 5 exercises'),
    });
  });

  it('no /week: the schedule\'s next weekday after today, wrapping; no schedule → null', () => {
    expect(upNext({ week: null, schedule: SCHEDULE, planDays: DAYS, now: NOW })).toMatchObject({ title: 'Lower B', when: 'Saturday' });
    expect(upNext({ week: null, schedule: SCHEDULE, planDays: DAYS, now: new Date(2026, 9, 31, 9) })).toMatchObject({ title: 'Upper A', when: 'Monday' });
    expect(upNext({ week: null, schedule: SCHEDULE, planDays: DAYS, now: new Date(2026, 9, 28, 9) })).toMatchObject({ title: 'Upper B', when: 'Tomorrow' });
    expect(upNext({ week: null, schedule: [], planDays: DAYS, now: NOW })).toBeNull();
  });
});

describe('copy helpers', () => {
  it('week complete names the total and next week\'s first day', () => {
    expect(weekCompleteDetail({ done: 4, total: 4 }, SCHEDULE)).toBe(s('All 4 workouts done. Next week starts Monday with Upper A.'));
    // DECLARED (UX T-81 LOW): was s('All 1 workout done.'); one workout reads "1 workout done.".
    expect(weekCompleteDetail({ done: 1, total: 1 }, [])).toBe(s('1 workout done.'));
    expect(weekCompleteDetail({ done: 1, total: 1 }, SCHEDULE)).toBe(s('1 workout done. Next week starts Monday with Upper A.'));
    expect(weekCompleteDetail({ done: 2, total: 2 }, [])).toBe(s('All 2 workouts done.'));
  });

  it('today done: exercises and whole minutes; no duration → no minutes', () => {
    expect(todayDoneDetail(6, 52)).toBe(s('Nice work. 6 exercises · 52 min.'));
    expect(todayDoneDetail(6, null)).toBe(s('Nice work. 6 exercises.'));
  });

  it('muscles: primary groups in order, first capitalised, joined with "and"', () => {
    const ex = (name) => ({ exercise: { primary_muscle_group: { name } } });
    expect(muscleLine([ex('Chest'), ex('Back'), ex('Chest'), ex('Arms')])).toBe('Chest, back and arms');
    expect(todayMeta(6, [ex('Chest'), ex('Back')])).toBe(s('6 exercises · Chest and back'));
    expect(todayMeta(6, [])).toBe(s('6 exercises'));
    expect(muscleLine(['Chest', 'Back', 'Arms', 'Legs', 'Core'].map(ex))).toBe('Chest, back, arms and legs');
  });
});

describe('todayDurationMinutes: today\'s completed workout for today\'s day', () => {
  const at = (hour) => new Date(2026, 9, 29, hour).toISOString();
  it('rounds the latest match to whole minutes (at least 1)', () => {
    const completed = [
      { workout_plan_day_id: 3, duration_seconds: 1800, completed_at: at(7) },
      { workout_plan_day_id: 3, duration_seconds: 3120, completed_at: at(8) },
      { workout_plan_day_id: 4, duration_seconds: 600, completed_at: at(8) },
    ];
    expect(todayDurationMinutes(completed, 3, NOW)).toBe(52);
    expect(todayDurationMinutes([{ workout_plan_day_id: 3, duration_seconds: 20, completed_at: at(8) }], 3, NOW)).toBe(1);
    // A stored 0 s still shows "1 min" (shared rule, review carry 1).
    expect(todayDurationMinutes([{ workout_plan_day_id: 3, duration_seconds: 0, completed_at: at(8) }], 3, NOW)).toBe(1);
  });

  it('another day, another date or no duration → null', () => {
    expect(todayDurationMinutes([{ workout_plan_day_id: 3, duration_seconds: 600, completed_at: new Date(2026, 9, 27, 8).toISOString() }], 3, NOW)).toBeNull();
    expect(todayDurationMinutes([{ workout_plan_day_id: 3, completed_at: at(8) }], 3, NOW)).toBeNull();
    expect(todayDurationMinutes(null, 3, NOW)).toBeNull();
  });
});

describe('dayRows: Other days', () => {
  it('training: today left out (b); not done first, done last as Repeat; weekday or "Any day"', () => {
    const rows = dayRows({ planDays: DAYS, schedule: SCHEDULE.filter((entry) => entry.plan_day.id !== 2), doneIds: [1, 2], state: 'training', todayDayId: 3 });
    expect(rows.map((row) => row.action)).toEqual(['Start Lower B', 'Repeat Upper A', 'Repeat Lower A']);
    expect(rows.map((row) => row.meta)).toEqual([s('Saturday · 5 exercises'), s('Monday · 5 exercises'), s('Any day · 5 exercises')]);
    expect(rows.map((row) => row.done)).toEqual([false, true, true]);
  });

  it('today done: today is listed LAST of the done rows, even when it comes earlier in plan order (review M1)', () => {
    const rows = dayRows({ planDays: DAYS, schedule: SCHEDULE, doneIds: [1, 2, 4], state: 'todayDone', todayDayId: 1 });
    expect(rows.map((row) => row.action)).toEqual(['Start Upper B', 'Repeat Lower A', 'Repeat Lower B', 'Repeat Upper A']);
  });

  it('other states keep plan order inside the done group (today not moved)', () => {
    const rows = dayRows({ planDays: DAYS, schedule: SCHEDULE, doneIds: [1, 2, 3, 4], state: 'weekComplete', todayDayId: 1 });
    expect(rows.map((row) => row.action)).toEqual(['Repeat Upper A', 'Repeat Lower A', 'Repeat Upper B', 'Repeat Lower B']);
  });

  it('rest / no schedule list every day; a day on two weekdays names only its next one (T-73 D2)', () => {
    expect(dayRows({ planDays: DAYS, schedule: SCHEDULE, doneIds: [], state: 'rest', todayDayId: 3 })).toHaveLength(4);
    expect(dayRows({ planDays: DAYS, schedule: [], doneIds: [], state: 'noSchedule' }).map((row) => row.meta)[2]).toBe(s('Any day · 6 exercises'));
    const twice = [...SCHEDULE, { weekday: wd(3), plan_day: DAYS[0] }];
    // NOW is Thursday: Monday and Wednesday are both past → next week's first, Monday.
    expect(dayRows({ planDays: DAYS, schedule: twice, doneIds: [], state: 'rest', now: NOW })[0].meta).toBe(s('Monday · 5 exercises'));
    // Tuesday: Wednesday is next.
    expect(dayRows({ planDays: DAYS, schedule: twice, doneIds: [], state: 'rest', now: new Date(2026, 9, 27, 9) })[0].meta).toBe(s('Wednesday · 5 exercises'));
  });

  describe('T-73 D2: Tue + Thu shows the next scheduled weekday from today (today included)', () => {
    const tueThu = [
      { weekday: wd(4), plan_day: DAYS[0] },
      { weekday: wd(2), plan_day: DAYS[0] },
    ];
    const whenOn = (date) => dayRows({ planDays: [DAYS[0]], schedule: tueThu, doneIds: [], state: 'rest', now: date })[0].meta.split(' · ')[0];
    // 26 Oct 2026 is a Monday.
    it.each([
      ['Monday', 26, 'Tuesday'],
      ['Tuesday', 27, 'Tuesday'],
      ['Wednesday', 28, 'Thursday'],
      ['Thursday', 29, 'Thursday'],
      ['Friday', 30, 'Tuesday'],
      ['Saturday', 31, 'Tuesday'],
    ])('%s (Oct %i) → %s', (_label, date, expected) => {
      expect(whenOn(new Date(2026, 9, date, 9))).toBe(expected);
    });
    it('Sunday → Tuesday (next week)', () => {
      expect(whenOn(new Date(2026, 10, 1, 9))).toBe('Tuesday');
    });
    it('never joins names with "and"', () => {
      expect(whenOn(new Date(2026, 9, 26, 9))).not.toMatch(/ and /);
    });
  });

  it('the block copy per state', () => {
    expect(OTHER_DAYS_COPY.training).toEqual({ title: 'Other days', help: "Not feeling today's? Tap any day to start it instead." });
    expect(OTHER_DAYS_COPY.rest.title).toBe('Train anyway?');
    expect(OTHER_DAYS_COPY.todayDone.help).toBe('Want more? Tap a day to start it.');
    expect(OTHER_DAYS_COPY.weekComplete).toEqual({ title: 'Extra session', help: 'Tap a day to do it again.' });
    expect(OTHER_DAYS_COPY.noSchedule).toEqual({ title: 'Or start now', help: 'Tap any day to start it.' });
  });
});

describe('T-80 startConfirmCopy: per context (UX T80 table)', () => {
  const LIVE = 'This starts a live workout.';
  it('a not-done day in each state', () => {
    expect(startConfirmCopy({ state: 'training', title: 'Lower B', todayTitle: 'Upper B' })).toEqual({ title: 'Start Lower B instead?', body: `Today’s plan is Upper B. ${LIVE}` });
    expect(startConfirmCopy({ state: 'rest', title: 'Lower B' })).toEqual({ title: 'Start Lower B today?', body: `Today is a rest day. ${LIVE}` });
    expect(startConfirmCopy({ state: 'todayDone', title: 'Lower B', todayTitle: 'Upper B' })).toEqual({ title: 'Start Lower B now?', body: `You’ve already done Upper B today. ${LIVE}` });
    expect(startConfirmCopy({ state: 'weekComplete', title: 'Lower B' })).toEqual({ title: 'Do Lower B again?', body: `Your week is complete, so this is an extra session. ${LIVE}` });
    expect(startConfirmCopy({ state: 'noSchedule', title: 'Lower B' })).toEqual({ title: 'Start Lower B now?', body: LIVE });
  });

  it('Repeat a done day: "Do {Day} again?", then the context sentence when it applies', () => {
    expect(startConfirmCopy({ state: 'rest', title: 'Upper A', done: true })).toEqual({ title: 'Do Upper A again?', body: `You already did Upper A this week. Today is a rest day. ${LIVE}` });
    expect(startConfirmCopy({ state: 'training', title: 'Upper A', done: true, todayTitle: 'Upper B' }).body).toBe(`You already did Upper A this week. Today’s plan is Upper B. ${LIVE}`);
    expect(startConfirmCopy({ state: 'noSchedule', title: 'Upper A', done: true }).body).toBe(`You already did Upper A this week. ${LIVE}`);
  });

  it('repeating TODAY\'s own done day: only "You’ve already done {Day} today."', () => {
    expect(startConfirmCopy({ state: 'todayDone', title: 'Upper B', done: true, isToday: true, todayTitle: 'Upper B' })).toEqual({
      title: 'Do Upper B again?',
      body: `You’ve already done Upper B today. ${LIVE}`,
    });
  });
});
