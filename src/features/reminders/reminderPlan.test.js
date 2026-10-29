import {
  REMINDER_KIND,
  REMINDER_MAX,
  cutWorkoutTitle,
  planReminders,
  reminderCopy,
  reminderId,
  reminderTimesLabel,
  workoutDoneOn,
} from './reminderPlan';

// Weekday ids as the API sends them (Mon 1 … Sun 7), titles as Today shows them.
const item = (weekday, title, dayNumber = 1) => ({ weekday: { id: weekday, sort_order: weekday }, plan_day: { day_number: dayNumber, title } });
const current = (schedule, enrollment = {}) => ({
  enrollment: { id: 31, status: 'active', started_on: '2026-09-21T00:00:00Z', ...enrollment },
  schedule,
});
// Thu 29 Oct 2026, 07:00 local.
const THU_7AM = new Date(2026, 9, 29, 7, 0);

const keys = (requests) => requests.map((request) => request.identifier.replace('gymido.reminder.', ''));

describe('T-103 planReminders', () => {
  test('training days only, 08:00 / 13:00 / 18:00 local, in time order', () => {
    // Mon, Thu, Sat.
    const requests = planReminders({ current: current([item(1, 'Push'), item(4, 'Pull'), item(6, 'Legs')]), now: THU_7AM, days: 7 });
    expect(keys(requests)).toEqual([
      '2026-10-29.morning',
      '2026-10-29.afternoon',
      '2026-10-29.evening',
      '2026-10-31.morning',
      '2026-10-31.afternoon',
      '2026-10-31.evening',
      '2026-11-02.morning',
      '2026-11-02.afternoon',
      '2026-11-02.evening',
    ]);
    expect(requests.map((request) => [request.fireAt.getHours(), request.fireAt.getMinutes()]).slice(0, 3)).toEqual([
      [8, 0],
      [13, 0],
      [18, 0],
    ]);
    expect(requests[0].content.data).toEqual({ kind: REMINDER_KIND, date: '2026-10-29', slot: 'morning' });
    expect(requests[3].content.title).toBe('Today: Legs');
  });

  test('only future times: opened at 14:10, today keeps only 18:00', () => {
    const requests = planReminders({ current: current([item(4, 'Pull')]), now: new Date(2026, 9, 29, 14, 10), days: 1 });
    expect(keys(requests)).toEqual(['2026-10-29.evening']);
  });

  test('a slot exactly at now is not scheduled', () => {
    const requests = planReminders({ current: current([item(4, 'Pull')]), now: new Date(2026, 9, 29, 13, 0), days: 1 });
    expect(keys(requests)).toEqual(['2026-10-29.evening']);
  });

  test('at most 4 weeks ahead: today + 27 days, nothing on day 28', () => {
    const requests = planReminders({ current: current([item(4, 'Pull')]), now: THU_7AM });
    const dates = [...new Set(requests.map((request) => request.content.data.date))];
    expect(dates).toEqual(['2026-10-29', '2026-11-05', '2026-11-12', '2026-11-19']);
    expect(dates).not.toContain('2026-11-26');
  });

  test('capped at 60, nearest first (7 training days × 3 × 28 = 84)', () => {
    const all = [1, 2, 3, 4, 5, 6, 7].map((weekday) => item(weekday, `Day ${weekday}`));
    const requests = planReminders({ current: current(all), now: THU_7AM });
    expect(requests).toHaveLength(REMINDER_MAX);
    expect(REMINDER_MAX).toBe(60);
    expect(keys(requests)[0]).toBe('2026-10-29.morning');
    // 20 full days: the 29th Oct … 17 Nov.
    expect(keys(requests)[59]).toBe('2026-11-17.evening');
    const times = requests.map((request) => request.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  test('a workout finished today drops all of today', () => {
    const completedToday = [{ id: 1, started_at: new Date(2026, 9, 29, 6, 30).toISOString() }];
    const requests = planReminders({ current: current([item(4, 'Pull')]), completedToday, now: THU_7AM, days: 8 });
    expect(keys(requests)).toEqual(['2026-11-05.morning', '2026-11-05.afternoon', '2026-11-05.evening']);
  });

  test('a workout started yesterday (finished after midnight) does not count for today', () => {
    const completedToday = [{ id: 1, started_at: new Date(2026, 9, 28, 23, 50).toISOString(), completed_at: new Date(2026, 9, 29, 0, 20).toISOString() }];
    const requests = planReminders({ current: current([item(4, 'Pull')]), completedToday, now: THU_7AM, days: 1 });
    expect(keys(requests)).toHaveLength(3);
  });

  test('nothing before the plan starts (started_on is a date, never shifted)', () => {
    const requests = planReminders({ current: current([item(4, 'Pull')], { started_on: '2026-11-01T00:00:00Z' }), now: THU_7AM, days: 8 });
    expect([...new Set(requests.map((request) => request.content.data.date))]).toEqual(['2026-11-05']);
  });

  test.each([
    ['no plan (404)', null],
    ['no schedule yet (trainer-assigned)', current([])],
    ['plan not active', current([item(4, 'Pull')], { status: 'completed' })],
    ['no enrollment', { schedule: [item(4, 'Pull')] }],
  ])('%s → nothing', (_name, plan) => {
    expect(planReminders({ current: plan, now: THU_7AM })).toEqual([]);
  });

  test('two plan days on one weekday: the first one (as Today shows it) names the day', () => {
    const requests = planReminders({ current: current([item(4, 'Pull', 1), item(4, 'Arms', 2)]), now: THU_7AM, days: 1 });
    expect(requests.map((request) => request.content.title)).toEqual(['Today: Pull', 'Pull is still on for today', 'Still time for Pull']);
  });

  test('DST end (25 Oct 2026, Europe): still 08:00 local on the day after', () => {
    // Sat 24 Oct 07:00 → Sun 25 Oct (the clocks change) and Mon 26 Oct.
    const requests = planReminders({ current: current([item(7, 'A'), item(1, 'B')]), now: new Date(2026, 9, 24, 7, 0), days: 3 });
    expect(requests.map((request) => [request.content.data.date, request.fireAt.getHours()])).toEqual([
      ['2026-10-25', 8],
      ['2026-10-25', 13],
      ['2026-10-25', 18],
      ['2026-10-26', 8],
      ['2026-10-26', 13],
      ['2026-10-26', 18],
    ]);
  });

  test('ids are stable per date + slot', () => {
    expect(reminderId('2026-10-29', 'evening')).toBe('gymido.reminder.2026-10-29.evening');
    const a = planReminders({ current: current([item(4, 'Pull')]), now: THU_7AM, days: 1 });
    const b = planReminders({ current: current([item(4, 'Pull')]), now: new Date(2026, 9, 29, 7, 30), days: 1 });
    expect(keys(a)).toEqual(keys(b));
  });
});

describe('T-103 copy (UX ruling §2)', () => {
  test.each([
    ['morning', 'Today: Push Day', 'Your workout is ready when you are.'],
    ['afternoon', 'Push Day is still on for today', 'An afternoon session fits nicely. Tap to get started.'],
    ['evening', 'Still time for Push Day', "There's still time this evening. Every session counts!"],
  ])('%s with a name', (slot, title, body) => {
    expect(reminderCopy(slot, 'Push Day')).toEqual({ title, body });
  });

  test.each([
    ['morning', "It's training day"],
    ['afternoon', "Today's workout is still waiting"],
    ['evening', "Still time for today's workout"],
  ])('%s without a name', (slot, title) => {
    expect(reminderCopy(slot, '  ').title).toBe(title);
    expect(reminderCopy(slot, null).title).toBe(title);
    expect(reminderCopy(slot, null).body).toBe(reminderCopy(slot, 'X').body);
  });

  test('the name is cut to 32 characters + "…"', () => {
    expect(cutWorkoutTitle('A'.repeat(32))).toBe('A'.repeat(32));
    expect(cutWorkoutTitle('A'.repeat(33))).toBe(`${'A'.repeat(32)}…`);
    expect(cutWorkoutTitle('Upper body strength and conditioning day')).toBe('Upper body strength and conditio…');
    // A cut that ends on a space doesn't leave "word …".
    expect(cutWorkoutTitle(`${'A'.repeat(31)} BBBB`)).toBe(`${'A'.repeat(31)}…`);
  });

  test('no guilt words, no emoji, at most one "!"', () => {
    const all = ['morning', 'afternoon', 'evening'].flatMap((slot) => Object.values(reminderCopy(slot, 'X')).concat(reminderCopy(slot, '').title));
    const text = all.join(' ');
    expect(text).not.toMatch(/missed|lazy|don't skip/i);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect((text.match(/!/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  test('the Settings value in both clock formats', () => {
    expect(reminderTimesLabel(false)).toBe('8:00, 13:00 and 18:00 on training days');
    expect(reminderTimesLabel(true)).toBe('8 AM, 1 PM and 6 PM on training days');
  });

  test('workoutDoneOn uses the local date of started_at', () => {
    expect(workoutDoneOn([{ started_at: new Date(2026, 9, 29, 9).toISOString() }], '2026-10-29')).toBe(true);
    expect(workoutDoneOn([], '2026-10-29')).toBe(false);
  });
});
