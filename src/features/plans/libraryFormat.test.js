import {
  activePlanSummary,
  buildScheduleItems,
  dayMetaLabel,
  deriveLibrary,
  estimateMinutes,
  exerciseDetailId,
  exerciseNotes,
  formatSetSummary,
  initialWeekdays,
  muscleFocus,
  planCardDaysLabel,
  planCountLabel,
  selectedWeekdaysLabel,
  todayUTC,
  toggleWeekday,
} from './libraryFormat';

const plan = (id, category, extra = {}) => ({ id, is_active: true, days_per_week: 3, category: category ? { name: category } : undefined, ...extra });

describe('deriveLibrary (§3.2)', () => {
  it('excludes the active plan and groups by category in object key order', () => {
    const plans = [plan(1, 'Build Muscle'), plan(2, 'Strength'), plan(3, '2026'), plan(4, 'Build Muscle'), plan(5, null), plan(6, '7')];
    const current = { enrollment: { plan: { id: 2 } }, schedule: [] };
    const result = deriveLibrary(plans, current);
    expect(result.groups.map(([name, items]) => [name, items.map((p) => p.id)])).toEqual([
      ['7', [6]],
      ['2026', [3]],
      ['Build Muscle', [1, 4]],
      ['Plans', [5]],
    ]);
    expect(result.browseCount).toBe(5);
    expect(result.activePlanDetail.id).toBe(2);
    expect(result.showCategoryHeaders).toBe(true);
  });

  it('falls back to the enrollment copy for a private trainer plan', () => {
    const current = { enrollment: { plan: { id: 99, name: 'Private' } }, schedule: [] };
    expect(deriveLibrary([plan(1, 'A')], current).activePlanDetail).toEqual({ id: 99, name: 'Private' });
  });

  it('de-dupes weekdays by id and sorts by sort_order', () => {
    const weekday = (id, name) => ({ id, name, sort_order: id });
    const current = {
      enrollment: { plan: { id: 1 } },
      schedule: [{ weekday: weekday(5, 'Friday') }, { weekday: weekday(1, 'Monday') }, { weekday: weekday(5, 'Friday') }, { weekday: { id: 3 } }],
    };
    expect(deriveLibrary([], current).activeWeekdays.map((w) => w.name)).toEqual(['Monday', 'Friday']);
  });

  it('drops inactive plans and flags an empty list', () => {
    const result = deriveLibrary([], null);
    expect(result).toMatchObject({ hasActivePlan: false, noPlansAtAll: true, browseCount: 0 });
    expect(deriveLibrary([plan(1, 'A', { is_active: false })], null).browseCount).toBe(0);
  });
});

describe('S1 copy', () => {
  it('labels the active plan and the cards', () => {
    expect(activePlanSummary({ days_per_week: 4, category: { name: 'Strength' } })).toBe('4 training days / week · Strength');
    expect(activePlanSummary({})).toBe('Your active routine');
    expect(planCardDaysLabel({})).toBe(' days / week');
    expect(planCountLabel(1)).toBe('1 plan');
    expect(planCountLabel(2)).toBe('2 plans');
  });
});

describe('S2 helpers (§4.4)', () => {
  it('formats set summaries, always plural (⚠15)', () => {
    expect(formatSetSummary({})).toBe('Open prescription');
    expect(formatSetSummary({ target_set_summary: { set_count: 3, target_reps_min: 8, target_reps_max: 12 } })).toBe('3 sets × 8-12 reps');
    expect(formatSetSummary({ target_set_summary: { set_count: 1, target_reps_min: 8 } })).toBe('1 sets × 8 reps');
    expect(formatSetSummary({ target_set_summary: { set_count: 2, target_reps_max: 10 } })).toBe('2 sets × Reps open');
  });

  it('estimates minutes with a 10-minute floor and 3 sets for a missing count', () => {
    expect(estimateMinutes([])).toBeNull();
    expect(estimateMinutes([{}])).toBe(10);
    expect(estimateMinutes([{ target_set_summary: { set_count: 4 } }, {}, {}, {}])).toBe(45);
  });

  it('lists distinct muscles and the day meta line', () => {
    const items = ['Chest', 'Back', 'Chest', 'Arms'].map((name) => ({ exercise: { primary_muscle_group: { name } } }));
    expect(muscleFocus(items)).toEqual(['Chest', 'Back', 'Arms']);
    expect(dayMetaLabel(1, null)).toBe('1 exercise');
    expect(dayMetaLabel(4, 45)).toBe('4 exercises · ~45 min');
  });

  it('trims notes, keeps line breaks and resolves the detail id', () => {
    expect(exerciseNotes({ notes: '  Slow down.\nPause at the bottom.  ' })).toBe('Slow down.\nPause at the bottom.');
    expect(exerciseNotes({ notes: '   ' })).toBe('');
    expect(exerciseNotes({})).toBe('');
    expect(exerciseDetailId({ exercise_id: 7, exercise: { id: 8 } })).toBe(7);
    expect(exerciseDetailId({ exercise: { id: 8 } })).toBe(8);
  });
});

describe('S2 schedule (§4.2, §4.6, §4.7)', () => {
  const current = { enrollment: { plan: { id: 3 } }, schedule: [{ weekday: { id: 5 } }, { weekday: { id: 1 } }, { weekday: { id: 5 } }] };

  it('pre-selects the saved schedule for the current plan, else Mon…', () => {
    expect(initialWeekdays({ currentPlan: current, plan: { id: 3 }, requiredDays: 3 })).toEqual([1, 5]);
    expect(initialWeekdays({ currentPlan: current, plan: { id: 4 }, requiredDays: 3 })).toEqual([1, 2, 3]);
    expect(initialWeekdays({ currentPlan: { enrollment: { plan: { id: 3 } }, schedule: [] }, plan: { id: 3 }, requiredDays: 2 })).toEqual([1, 2]);
  });

  it('ignores a tap past the limit (⚠14) and keeps ids sorted', () => {
    expect(toggleWeekday([1, 3], 2, 3)).toEqual([1, 2, 3]);
    expect(toggleWeekday([1, 2, 3], 4, 3)).toEqual([1, 2, 3]);
    expect(toggleWeekday([1, 2, 3], 2, 3)).toEqual([1, 3]);
    expect(selectedWeekdaysLabel([1, 5])).toBe('Selected: Mon, Fri');
    expect(selectedWeekdaysLabel([])).toBe('Selected: None yet');
  });

  it('pairs day 1 with the earliest weekday and covers every day (⚠1)', () => {
    expect(buildScheduleItems([{ id: 10 }, { id: 11 }], [2, 4], 2)).toEqual([
      { workout_plan_day_id: 10, weekday_id: 2 },
      { workout_plan_day_id: 11, weekday_id: 4 },
    ]);
  });

  it('uses the UTC date, not the local one (⚠7)', () => {
    expect(todayUTC(new Date('2026-09-22T03:00:00Z'))).toBe('2026-09-22');
  });
});
