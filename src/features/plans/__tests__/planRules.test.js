import { category, currentPlan, planItem } from '../../../test/planFixtures';
import {
  derivePlansList,
  estimateMinutes,
  formatSetSummary,
  initialWeekdaysFor,
  muscleFocus,
  requiredScheduleDaysFor,
  toggleWeekday,
  weekdaySummary,
} from '../planRules';

describe('formatSetSummary (RN-SPEC-plans §4.4)', () => {
  test.each([
    [{ set_count: 3, target_reps_min: 8, target_reps_max: 12 }, '3 sets × 8-12 reps'],
    [{ set_count: 4, target_reps_min: 5 }, '4 sets × 5 reps'],
    [{ set_count: 2 }, '2 sets × Reps open'],
    [undefined, 'Open prescription'],
    [{ set_count: 0, target_reps_min: 8 }, 'Open prescription'],
  ])('%j → %s', (summary, expected) => {
    expect(formatSetSummary({ target_set_summary: summary })).toBe(expected);
  });

  test('⚠15 parity: always "sets", even for one set', () => {
    expect(formatSetSummary({ target_set_summary: { set_count: 1, target_reps_min: 8 } })).toBe('1 sets × 8 reps');
  });

  test('parity: target_reps_max without a min reads "Reps open"', () => {
    expect(formatSetSummary({ target_set_summary: { set_count: 3, target_reps_max: 12 } })).toBe('3 sets × Reps open');
  });

  test('uses U+00D7 as the multiplication sign', () => {
    expect(formatSetSummary({ target_set_summary: { set_count: 3 } })).toContain('×');
  });
});

describe('estimateMinutes', () => {
  test('null for no exercises', () => {
    expect(estimateMinutes([])).toBeNull();
  });

  test('a missing or zero set count counts as 3', () => {
    // 3 + 3 sets = 6 × 3.5 = 21 → nearest 5 = 20.
    expect(estimateMinutes([{}, { target_set_summary: { set_count: 0 } }])).toBe(20);
  });

  test('rounds to the nearest 5 with a 10-minute floor', () => {
    expect(estimateMinutes([{ target_set_summary: { set_count: 1 } }])).toBe(10);
    // 9 sets × 3.5 = 31.5 → 30.
    expect(estimateMinutes([{ target_set_summary: { set_count: 9 } }])).toBe(30);
  });
});

test('muscleFocus keeps distinct names in first-appearance order', () => {
  const group = (name) => ({ exercise: { primary_muscle_group: { name } } });
  expect(muscleFocus([group('Legs'), group('Back'), group('Legs'), {}, group('Chest')])).toEqual([
    'Legs',
    'Back',
    'Chest',
  ]);
});

describe('requiredScheduleDaysFor', () => {
  test('⚠1/⚠12: days_per_week wins over the saved day count', () => {
    expect(requiredScheduleDaysFor({ days_per_week: 2 }, [{}, {}, {}])).toBe(2);
  });

  test('falls back to the day count, then 0', () => {
    expect(requiredScheduleDaysFor(null, [{}, {}])).toBe(2);
    expect(requiredScheduleDaysFor(null, [])).toBe(0);
  });
});

describe('initialWeekdaysFor', () => {
  const plan = planItem({ id: 3 });

  test('current plan: distinct saved weekdays, ascending, truncated to N', () => {
    const current = currentPlan({ plan, weekdayIds: [5, 1, 3, 1] });
    expect(initialWeekdaysFor(current, plan, 2)).toEqual([1, 3]);
  });

  test('another plan: the first N weekdays', () => {
    const current = currentPlan({ plan: planItem({ id: 9 }), weekdayIds: [5] });
    expect(initialWeekdaysFor(current, plan, 3)).toEqual([1, 2, 3]);
  });

  test('current plan with an empty schedule falls back to the first N', () => {
    expect(initialWeekdaysFor(currentPlan({ plan }), plan, 2)).toEqual([1, 2]);
  });
});

describe('toggleWeekday (⚠14)', () => {
  test('removes a selected day', () => {
    expect(toggleWeekday([1, 3], 3, 2)).toEqual([1]);
  });

  test('adds and keeps ascending order', () => {
    expect(toggleWeekday([5], 2, 3)).toEqual([2, 5]);
  });

  test('a tap beyond the limit silently does nothing', () => {
    const current = [1, 2];
    expect(toggleWeekday(current, 4, 2)).toBe(current);
  });
});

test('weekdaySummary joins labels in id order', () => {
  expect(weekdaySummary([1, 3, 7])).toBe('Mon, Wed, Sun');
  expect(weekdaySummary([])).toBe('');
});

describe('derivePlansList (RN-SPEC-plans §3.2)', () => {
  test('excludes the active plan and inactive plans from the browse list', () => {
    const plans = [planItem({ id: 1 }), planItem({ id: 2 }), planItem({ id: 3, is_active: false })];
    const current = currentPlan({ plan: plans[0] });
    const result = derivePlansList(plans, current);
    expect(result.browseCount).toBe(1);
    expect(result.groups[0][1].map((plan) => plan.id)).toEqual([2]);
    expect(result.activePlanDetail).toBe(plans[0]);
  });

  test('falls back to the enrollment plan copy when the list lacks it', () => {
    const privatePlan = planItem({ id: 77, name: 'Coach plan' });
    const result = derivePlansList([planItem({ id: 1 })], currentPlan({ plan: privatePlan }));
    expect(result.activePlanDetail).toBe(privatePlan);
  });

  test('groups by category in server order, with "Plans" for no category', () => {
    const plans = [
      planItem({ id: 1, category: category(2, 'Lose Fat') }),
      planItem({ id: 2, category: undefined }),
      planItem({ id: 3, category: category(1, 'Build Muscle') }),
      planItem({ id: 4, category: category(2, 'Lose Fat') }),
    ];
    const result = derivePlansList(plans, null);
    expect(result.groups.map(([name]) => name)).toEqual(['Lose Fat', 'Plans', 'Build Muscle']);
    expect(result.showCategoryHeaders).toBe(true);
  });

  test('parity: integer-like category names sort first (plain-object key order)', () => {
    const plans = [planItem({ id: 1, category: category(2, 'Strength') }), planItem({ id: 2, category: category(3, '2026') })];
    expect(derivePlansList(plans, null).groups.map(([name]) => name)).toEqual(['2026', 'Strength']);
  });

  test('⚠6: private trainer plans returned for admins are not filtered', () => {
    const plans = [planItem({ id: 1 }), planItem({ id: 50, name: 'Trainer private plan' })];
    expect(derivePlansList(plans, null).browseCount).toBe(2);
  });

  test('schedule weekdays are de-duplicated and sorted Mon→Sun', () => {
    const result = derivePlansList([], currentPlan({ plan: planItem(), weekdayIds: [5, 1, 3, 1] }));
    expect(result.activeWeekdays.map((weekday) => weekday.name)).toEqual(['Monday', 'Wednesday', 'Friday']);
    expect(result.noPlansAtAll).toBe(true);
  });
});
