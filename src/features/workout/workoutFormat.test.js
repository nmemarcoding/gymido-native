import { buildExerciseStatsMap, completedDayIds, currentWeekRange, dayTitle, needsScheduleSetup, scheduledWeekdaysByDayId } from './workoutFormat';

describe('currentWeekRange (time §4.3)', () => {
  it('runs device-local Monday to Sunday', () => {
    expect(currentWeekRange(new Date(2026, 9, 22, 15))).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' });
    expect(currentWeekRange(new Date(2026, 9, 25, 23, 59))).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' });
    expect(currentWeekRange(new Date(2026, 9, 19, 0, 0))).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' });
  });
});

// DECLARED (T-76, 28 Oct 2026): the "hero (§3.1–§3.3)" tests (todayState badges, todayDetail lines,
// showsHeroStart, trainingDaysLabel) and "ring (§5.3)" (completedThisWeekCount, ⚠W11) are removed with
// the retired TodayHeroCard. Their replacements are stricter: hubModel.test.js (hubState per state,
// weekProgress "X of Y" from /week, todayMeta / todayDoneDetail / weekCompleteDetail copy).

describe('schedule and days', () => {
  it('lists every completed session\'s plan day id, duplicates kept (the ✓ Done rows)', () => {
    expect(completedDayIds([{ workout_plan_day_id: 7 }, { workout_plan_day_id: 7 }, { workout_plan_day_id: 9 }])).toEqual([7, 7, 9]);
    expect(completedDayIds(null)).toEqual([]);
  });

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
