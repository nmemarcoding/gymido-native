import {
  buildExerciseStatsMap,
  completedThisWeekCount,
  getCurrentWeekRange,
  hubPlanName,
  needsSchedule,
  scheduledWeekdaysByDayId,
  showsHeroStart,
  todayDetail,
  todayState,
} from '../workoutRules';

describe('getCurrentWeekRange (RN-SPEC-time §4.3)', () => {
  test.each([
    ['2026-09-24T15:00:00', '2026-09-21', '2026-09-27'], // Thursday
    ['2026-09-21T00:30:00', '2026-09-21', '2026-09-27'], // Monday
    ['2026-09-27T23:59:00', '2026-09-21', '2026-09-27'], // Sunday
  ])('%s → %s..%s (device-local Monday…Sunday)', (now, startDate, endDate) => {
    expect(getCurrentWeekRange(new Date(now))).toEqual({ startDate, endDate });
  });

  test('crosses a month boundary', () => {
    expect(getCurrentWeekRange(new Date('2026-10-01T09:00:00'))).toEqual({
      startDate: '2026-09-28',
      endDate: '2026-10-04',
    });
  });
});

describe('scheduledWeekdaysByDayId (§7)', () => {
  const weekday = (id, name, sortOrder) => ({ id, name, sort_order: sortOrder });

  test('groups by plan day, de-duplicates and sorts by sort_order', () => {
    const schedule = [
      { weekday: weekday(5, 'Friday', 5), plan_day: { id: 11 } },
      { weekday: weekday(1, 'Monday', 1), plan_day: { id: 11 } },
      { weekday: weekday(1, 'Monday', 1), plan_day: { id: 11 } },
      { weekday: weekday(3, 'Wednesday', 3), plan_day: { id: 12 } },
    ];
    const result = scheduledWeekdaysByDayId(schedule);
    expect(result[11].map((item) => item.name)).toEqual(['Monday', 'Friday']);
    expect(result[12].map((item) => item.name)).toEqual(['Wednesday']);
  });

  test('empty or malformed rows are ignored', () => {
    expect(scheduledWeekdaysByDayId(null)).toEqual({});
    expect(scheduledWeekdaysByDayId([{ plan_day: { id: 1 } }, { weekday: weekday(1, 'Monday', 1) }])).toEqual({});
  });
});

describe('completedThisWeekCount (§5.3, ⚠W11)', () => {
  const planDays = [{ id: 11 }, { id: 12 }, { id: 13 }];

  test('counts plan days, so duplicates collapse and unknown ids count zero', () => {
    expect(completedThisWeekCount(planDays, [11, 11, 999, 12])).toBe(2);
  });

  test('cannot exceed the plan day count', () => {
    expect(completedThisWeekCount(planDays, [11, 12, 13, 13, 11])).toBe(3);
    expect(completedThisWeekCount([], [11])).toBe(0);
  });
});

describe('today state, badge and detail (§3.1, §3.2)', () => {
  test.each([
    [{ already_completed: true, is_workout_day: true }, 'completed'],
    [{ already_completed: false, is_workout_day: true }, 'training'],
    [{ already_completed: false, is_workout_day: false }, 'rest'],
    [null, 'rest'],
  ])('%j → %s', (status, state) => {
    expect(todayState(status)).toBe(state);
  });

  test('detail strings, including the fallbacks', () => {
    expect(todayDetail({ already_completed: true, plan_day: { title: 'Legs' } })).toBe('Legs is done — great work.');
    expect(todayDetail({ already_completed: true, plan_day: {} })).toBe("Today's session is done — great work.");
    expect(todayDetail({ is_workout_day: true, plan_day: { title: 'Legs' } })).toBe('Legs is ready to go.');
    expect(todayDetail({ is_workout_day: true, plan_day: {} })).toBe('Your workout is ready to go.');
    // ⚠W1: the rest-day line ignores plan_day, which is the NEXT scheduled day.
    expect(todayDetail({ is_workout_day: false, plan_day: { title: 'Legs' } })).toBe(
      'Nothing scheduled today — start any day below.'
    );
    expect(todayDetail(null)).toBe('Nothing scheduled today — start any day below.');
  });

  test('the hero Start needs a workout day that is not done and has an id (§3.3)', () => {
    expect(showsHeroStart({ is_workout_day: true, already_completed: false, plan_day: { id: 11 } })).toBe(true);
    expect(showsHeroStart({ is_workout_day: true, already_completed: true, plan_day: { id: 11 } })).toBe(false);
    expect(showsHeroStart({ is_workout_day: true, already_completed: false, plan_day: {} })).toBe(false);
    expect(showsHeroStart(null)).toBe(false);
  });
});

describe('hub derivations', () => {
  const enrolled = (schedule) => ({ enrollment: { id: 31, plan: { id: 3, name: 'Strength Base' } }, schedule });

  test('needsSchedule: an enrollment with days but no schedule rows', () => {
    expect(needsSchedule(enrolled([]), [{ id: 11 }])).toBe(true);
    expect(needsSchedule(enrolled([{ id: 1 }]), [{ id: 11 }])).toBe(false);
    expect(needsSchedule(enrolled([]), [])).toBe(false);
    expect(needsSchedule(null, [{ id: 11 }])).toBe(false);
  });

  test('hubPlanName falls back to "Your plan"', () => {
    expect(hubPlanName(enrolled([]))).toBe('Strength Base');
    expect(hubPlanName(null)).toBe('Your plan');
  });

  test('buildExerciseStatsMap keys by exercise id and defaults the unit to lb', () => {
    expect(
      buildExerciseStatsMap([
        { exercise: { id: 5 }, last_weight_value: 40, last_weight_unit: 'kg' },
        { exercise: { id: 6 }, last_weight_value: 20 },
        { last_weight_value: 10 },
      ])
    ).toEqual({ 5: { value: 40, unit: 'kg' }, 6: { value: 20, unit: 'lb' } });
    expect(buildExerciseStatsMap(null)).toEqual({});
  });
});
