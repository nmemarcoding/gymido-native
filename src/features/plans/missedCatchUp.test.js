import { catchUpConfirmCopy, catchUpRowCopy, dashboardMisses, missTitle, missedLayout, weekMisses } from './missedCatchUp';

// T-102 (RN-SPEC-home / RN-SPEC-workout dated 29 Oct 2026; web missedCatchUp.t102.test.js).
const miss = (weekdayName, title) => ({ weekdayName, planDay: title === undefined ? { id: 1 } : { id: 1, title } });
const MON = miss('Monday', 'Upper A');
const TUE = miss('Tuesday', 'Lower A');
const WED = miss('Wednesday', 'Upper B');

describe('missedLayout (the §1 table)', () => {
  it('0 misses → nothing in any state', () => {
    for (const base of ['setup', 'training', 'completed', 'rest']) {
      expect(missedLayout(base, [])).toEqual({ hero: null, catchUp: null });
    }
  });

  it('setup (and the hub\'s week complete / none) → nothing, whatever the misses', () => {
    expect(missedLayout('setup', [MON, TUE])).toEqual({ hero: null, catchUp: null });
    expect(missedLayout(null, [MON])).toEqual({ hero: null, catchUp: null });
  });

  it('training / completed: the hero stays; the row names misses[0], more = count − 1', () => {
    expect(missedLayout('training', [MON])).toEqual({ hero: null, catchUp: { miss: MON, more: 0 } });
    expect(missedLayout('completed', [MON, TUE, WED])).toEqual({ hero: null, catchUp: { miss: MON, more: 2 } });
  });

  it('rest: the Missed hero names misses[0]; the row only with 2+, naming misses[1], more = count − 2', () => {
    expect(missedLayout('rest', [MON])).toEqual({ hero: MON, catchUp: null });
    expect(missedLayout('rest', [MON, TUE])).toEqual({ hero: MON, catchUp: { miss: TUE, more: 0 } });
    expect(missedLayout('rest', [MON, TUE, WED])).toEqual({ hero: MON, catchUp: { miss: TUE, more: 1 } });
  });
});

describe('copy', () => {
  it('row: names the day first; line 2 and the SR tail only when more > 0', () => {
    expect(catchUpRowCopy({ miss: MON, more: 0 })).toEqual({ line1: "Catch up: Monday's Upper A", line2: null, label: "Catch up on Monday's Upper A." });
    expect(catchUpRowCopy({ miss: miss('Monday'), more: 2 })).toEqual({
      line1: "Catch up: Monday's workout",
      line2: '+2 more missed this week',
      label: "Catch up on Monday's workout. 2 more missed this week.",
    });
    expect(missTitle(null)).toBe('workout');
  });

  it('confirm: title + "You missed it on {Weekday}." + the state sentence + the live line', () => {
    expect(catchUpConfirmCopy({ miss: MON, base: 'training', todayTitle: 'Upper B' })).toEqual({
      title: 'Catch up on Upper A?',
      body: 'You missed it on Monday. Today’s plan is Upper B. This starts a live workout.',
    });
    expect(catchUpConfirmCopy({ miss: MON, base: 'completed', todayTitle: 'Upper B' }).body).toBe(
      'You missed it on Monday. You’ve already done Upper B today. This starts a live workout.'
    );
    expect(catchUpConfirmCopy({ miss: MON, base: 'rest' }).body).toBe('You missed it on Monday. Today is a rest day. This starts a live workout.');
    expect(catchUpConfirmCopy({ miss: { weekdayName: 'Monday' }, base: 'rest', title: 'Day 1' }).title).toBe('Catch up on Day 1?');
  });
});

describe('sources', () => {
  it('Today: dashboard.missed_this_week in server order', () => {
    expect(dashboardMisses({ missed_this_week: [{ weekday: { name: 'Tuesday' }, plan_day: { id: 2 } }, { weekday: { name: 'Monday' }, plan_day: { id: 1 } }] })).toEqual([
      { weekdayName: 'Tuesday', planDay: { id: 2 } },
      { weekdayName: 'Monday', planDay: { id: 1 } },
    ]);
    expect(dashboardMisses(null)).toEqual([]);
  });

  it('hub: /week missed workout days before today, most recent first; done (made up), today, rest and no /week are not open', () => {
    const now = new Date(2026, 9, 29, 9, 0);
    const day = (id) => ({ id, title: `D${id}` });
    const item = (wd, date, status, planDay = null, isWorkout = Boolean(planDay)) => ({ weekday: { id: wd }, date, status, is_workout_day: isWorkout, plan_day: planDay });
    const week = [
      item(1, '2026-10-26', 'missed', day(1)),
      item(2, '2026-10-27', 'done', day(2)),
      item(3, '2026-10-28', 'missed', day(3)),
      item(4, '2026-10-29', 'missed', day(4)),
      item(5, '2026-10-30', 'missed', day(5), false),
      item(6, '2026-10-31', 'upcoming', day(6)),
      item(7, '2026-11-01', 'rest'),
    ];
    expect(weekMisses(week, now)).toEqual([
      { weekdayName: 'Wednesday', planDay: day(3) },
      { weekdayName: 'Monday', planDay: day(1) },
    ]);
    expect(weekMisses(null, now)).toEqual([]);
    expect(weekMisses(week.slice(0, 6), now)).toEqual([]);
  });
});
