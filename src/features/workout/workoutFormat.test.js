import {
  buildExerciseStatsMap,
  completedDayIds,
  completedThisWeekCount,
  currentWeekRange,
  dayTitle,
  needsScheduleSetup,
  scheduledWeekdaysByDayId,
  showsHeroStart,
  todayDetail,
  todayState,
  trainingDaysLabel,
} from './workoutFormat';

describe('currentWeekRange (time §4.3)', () => {
  it('runs device-local Monday to Sunday', () => {
    expect(currentWeekRange(new Date(2026, 9, 22, 15))).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' });
    expect(currentWeekRange(new Date(2026, 9, 25, 23, 59))).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' });
    expect(currentWeekRange(new Date(2026, 9, 19, 0, 0))).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' });
  });
});

describe('hero (§3.1–§3.3)', () => {
  const day = { id: 12, title: 'Chest & Biceps' };

  it('derives the badge from today status only', () => {
    expect(todayState({ is_workout_day: true, already_completed: true })).toBe('completed');
    expect(todayState({ is_workout_day: true, already_completed: false })).toBe('training');
    expect(todayState(null)).toBe('rest');
  });

  it('writes the detail line, naming the next day on rest days (⚠W1)', () => {
    expect(todayDetail({ already_completed: true, plan_day: day })).toBe('Chest & Biceps is done — great work.');
    expect(todayDetail({ already_completed: true, plan_day: {} })).toBe("Today's session is done — great work.");
    expect(todayDetail({ is_workout_day: true, plan_day: day })).toBe('Chest & Biceps is ready to go.');
    expect(todayDetail({ is_workout_day: true })).toBe('Your workout is ready to go.');
    expect(todayDetail({ is_workout_day: false, plan_day: day })).toBe('Nothing scheduled today — start any day below.');
    expect(todayDetail(null)).toBe('Nothing scheduled today — start any day below.');
  });

  it('shows Start only on an unfinished workout day with a plan day', () => {
    expect(showsHeroStart({ is_workout_day: true, already_completed: false, plan_day: day })).toBe(true);
    expect(showsHeroStart({ is_workout_day: true, already_completed: true, plan_day: day })).toBe(false);
    expect(showsHeroStart({ is_workout_day: true, plan_day: {} })).toBe(false);
    expect(showsHeroStart(null)).toBe(false);
  });

  it('labels the day count', () => {
    expect(trainingDaysLabel(1)).toBe('1\u00a0training day');
    expect(trainingDaysLabel(3)).toBe('3\u00a0training days');
  });
});

describe('ring (§5.3)', () => {
  it('counts plan days, not sessions (⚠W11)', () => {
    const planDays = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const ids = completedDayIds([{ workout_plan_day_id: 1 }, { workout_plan_day_id: 1 }, { workout_plan_day_id: 9 }]);
    expect(ids).toEqual([1, 1, 9]);
    expect(completedThisWeekCount(planDays, ids)).toBe(1);
    expect(completedThisWeekCount(planDays, completedDayIds(null))).toBe(0);
  });
});

describe('schedule and days', () => {
  it('groups weekdays per plan day, de-duplicated and sorted', () => {
    const weekday = (id, name) => ({ id, name, sort_order: id });
    const byDay = scheduledWeekdaysByDayId([
      { weekday: weekday(5, 'Friday'), plan_day: { id: 1 } },
      { weekday: weekday(1, 'Monday'), plan_day: { id: 1 } },
      { weekday: weekday(1, 'Monday'), plan_day: { id: 1 } },
      { weekday: weekday(3, 'Wednesday'), plan_day: { id: 2 } },
    ]);
    expect(byDay[1].map((w) => w.name)).toEqual(['Monday', 'Friday']);
    expect(byDay[2].map((w) => w.name)).toEqual(['Wednesday']);
  });

  it('offers schedule setup only for an enrollment with days and no schedule', () => {
    expect(needsScheduleSetup({ enrollment: { id: 3 }, schedule: [] }, [{ id: 1 }])).toBe(true);
    expect(needsScheduleSetup({ enrollment: { id: 3 }, schedule: [{}] }, [{ id: 1 }])).toBe(false);
    expect(needsScheduleSetup({ enrollment: { id: 3 } }, [])).toBe(false);
    expect(needsScheduleSetup(null, [{ id: 1 }])).toBe(false);
  });

  it('falls back to "Day {n}" and maps last weights with lb as default', () => {
    expect(dayTitle({ title: '', day_number: 2 })).toBe('Day 2');
    expect(buildExerciseStatsMap([{ exercise: { id: 5 }, last_weight_value: 40 }, { exercise: { id: 6 }, last_weight_value: 20, last_weight_unit: 'kg' }])).toEqual({
      5: { value: 40, unit: 'lb' },
      6: { value: 20, unit: 'kg' },
    });
  });
});
