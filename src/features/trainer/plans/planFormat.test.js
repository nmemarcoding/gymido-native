import {
  ALL_EQUIPMENT,
  ALL_MUSCLE_GROUPS,
  exerciseName,
  filterCatalog,
  formatDayTitle,
  formatDaysPerWeek,
  formatExerciseCount,
  formatExerciseSummary,
  formatSetSummary,
  getAddDayContext,
  getAddedExerciseIds,
  getOrderIndexBase,
  slugify,
} from './planFormat';

describe('formatSetSummary', () => {
  it('joins reps, weight and rest with a middle dot', () => {
    expect(
      formatSetSummary({ target_reps_min: 8, target_reps_max: 12, target_weight_value: 80, target_weight_unit: 'kg', rest_seconds: 90 })
    ).toBe('8-12 reps · 80 kg · 90s rest');
  });

  it('handles one-sided reps and open values', () => {
    expect(formatSetSummary({ target_reps_min: 8 })).toBe('8 reps · Open weight · Open rest');
    expect(formatSetSummary({ target_reps_max: 10 })).toBe('10 reps · Open weight · Open rest');
    expect(formatSetSummary({})).toBe('Open reps · Open weight · Open rest');
  });

  it('treats 0 reps and rest as absent but shows a 0 weight', () => {
    expect(formatSetSummary({ target_reps_min: 0, target_reps_max: 0, target_weight_value: 0, target_weight_unit: 'kg', rest_seconds: 0 })).toBe(
      'Open reps · 0 kg · Open rest'
    );
  });

  it('trims the weight when the unit is absent', () => {
    expect(formatSetSummary({ target_weight_value: 80 })).toBe('Open reps · 80 · Open rest');
  });
});

describe('formatExerciseSummary', () => {
  it('reads the set count from the summary, then target_sets', () => {
    expect(formatExerciseSummary({ target_set_summary: { set_count: 1, target_reps_min: 5 } })).toBe(
      '1 set · 5 reps · Open weight · Open rest'
    );
    expect(formatExerciseSummary({ target_set_summary: {}, target_sets: [{}, {}] })).toBe(
      '2 sets · Open reps · Open weight · Open rest'
    );
  });

  it('says no sets when there are none', () => {
    expect(formatExerciseSummary({})).toBe('No sets configured');
  });
});

describe('copy quirks reproduced from the web', () => {
  it('never singularises days per week (⚠T1-4)', () => {
    expect(formatDaysPerWeek({ days_per_week: 1 })).toBe('1 days / week');
    expect(formatDaysPerWeek({ days_per_week: 0 })).toBe('Training plan');
    expect(formatDaysPerWeek({})).toBe('Training plan');
  });

  it('never singularises the exercise count and defaults to 0 (⚠T3-4)', () => {
    expect(formatExerciseCount({ exercises_count: 1 })).toBe('1 exercises');
    expect(formatExerciseCount({})).toBe('0 exercises');
  });

  it('names untitled days and unnamed exercises', () => {
    expect(formatDayTitle({ day_number: 2, title: '' })).toBe('Day 2: Untitled day');
    expect(exerciseName({ exercise_id: 7 })).toBe('Exercise #7');
    expect(exerciseName({ exercise_id: 7, exercise: { name: 'Squat' } })).toBe('Squat');
  });
});

describe('slugify', () => {
  it('follows the web rule', () => {
    expect(slugify('  Client A – Hypertrophy  ')).toBe('client-a-hypertrophy');
    expect(slugify('Push__Pull--Legs!!')).toBe('push__pull-legs');
    expect(slugify('---')).toBe('');
  });
});

describe('getAddDayContext', () => {
  it('numbers the next day after the highest and checks the weekly limit', () => {
    expect(getAddDayContext({ days_per_week: 3 }, [{ day_number: 1 }, { day_number: 4 }])).toEqual({
      nextDayNumber: 5,
      dayLimit: 3,
      canAddDay: true,
    });
    expect(getAddDayContext({ days_per_week: 2 }, [{ day_number: 1 }, { day_number: 2 }]).canAddDay).toBe(false);
    expect(getAddDayContext({}, [])).toEqual({ nextDayNumber: 1, dayLimit: null, canAddDay: true });
  });
});

describe('picker helpers', () => {
  const catalog = [
    { id: 1, name: 'Bench Press', slug: 'bench-press', primary_muscle_group: { name: 'Chest' }, equipment_type_id: 2 },
    { id: 2, name: 'Squat', slug: 'back-squat', primary_muscle_group: { name: 'Legs' }, equipment_type_id: 2 },
    { id: 3, name: 'Push-up', slug: 'push-up', primary_muscle_group: { name: 'Chest' } },
  ];

  it('matches name or slug, muscle name and equipment id, in catalog order', () => {
    const defaults = { search: '', muscle: ALL_MUSCLE_GROUPS, equipment: ALL_EQUIPMENT };
    expect(filterCatalog(catalog, defaults).map((e) => e.id)).toEqual([1, 2, 3]);
    expect(filterCatalog(catalog, { ...defaults, search: '  BACK ' }).map((e) => e.id)).toEqual([2]);
    expect(filterCatalog(catalog, { ...defaults, muscle: 'Chest' }).map((e) => e.id)).toEqual([1, 3]);
    expect(filterCatalog(catalog, { ...defaults, equipment: '2' }).map((e) => e.id)).toEqual([1, 2]);
  });

  it('derives the order_index base and the ids already added', () => {
    expect(getOrderIndexBase([])).toBe(0);
    expect(getOrderIndexBase([{ order_index: 2 }, { order_index: 5 }])).toBe(5);
    const added = getAddedExerciseIds([{ exercise: { id: 4 } }, { exercise_id: 9 }]);
    expect([...added]).toEqual([4, 9]);
  });
});
