import {
  buildAddDayPayload,
  buildAddSetPayload,
  buildCreatePlanPayload,
  validateAddDay,
  validateAddSet,
  validateCreatePlan,
} from './planValidation';

describe('validateCreatePlan', () => {
  it('requires a name, a valid slug and a category', () => {
    expect(validateCreatePlan({ name: ' ', slug: '', categoryId: '' })).toEqual({
      name: 'Name is required.',
      slug: 'Slug is required.',
      category_id: 'Category is required.',
    });
    expect(validateCreatePlan({ name: 'A', slug: 'Bad Slug', categoryId: '1' })).toEqual({
      slug: 'Slug can only include letters, numbers, hyphens, and underscores.',
    });
    expect(validateCreatePlan({ name: 'A', slug: ' ok_slug-1 ', categoryId: '1' })).toEqual({});
  });

  it('builds the payload with numbers, a null difficulty and is_active', () => {
    expect(
      buildCreatePlanPayload({ name: ' A ', slug: ' a ', categoryId: '4', daysPerWeek: '3', difficultyLevelId: '', description: ' d ' })
    ).toEqual({ name: 'A', slug: 'a', category_id: 4, days_per_week: 3, difficulty_level_id: null, description: 'd', is_active: true });
  });
});

describe('validateAddDay', () => {
  it('requires a title', () => {
    expect(validateAddDay({ title: '  ', nextDayNumber: 1, dayLimit: 3, canAddDay: true })).toEqual({
      title: 'Day title is required.',
    });
  });

  it('records the hidden day-number errors', () => {
    expect(validateAddDay({ title: 'x', nextDayNumber: 4, dayLimit: 3, canAddDay: false }).day_number).toBe(
      'Day number must be between 1 and 7.'
    );
    expect(validateAddDay({ title: 'x', nextDayNumber: 2, dayLimit: null, canAddDay: false }).day_number).toBe(
      'This plan already has all available days.'
    );
  });

  it('always sends the description, empty when blank', () => {
    expect(buildAddDayPayload({ nextDayNumber: 2, title: ' Legs ', description: '  ' })).toEqual({
      day_number: 2,
      title: 'Legs',
      description: '',
    });
  });
});

describe('validateAddSet', () => {
  const blank = { repsMin: '', repsMax: '', weight: '', unit: 'lb', rest: '' };

  it('needs reps or weight', () => {
    expect(validateAddSet(blank)).toEqual({ target_reps_min: 'At least reps or weight must be specified.' });
  });

  it('rejects non-positive numbers', () => {
    expect(validateAddSet({ ...blank, repsMin: '0', repsMax: 'x', weight: '-1', rest: '0' })).toEqual({
      target_reps_min: 'Minimum reps must be a positive number.',
      target_reps_max: 'Maximum reps must be a positive number.',
      target_weight_value: 'Weight must be a positive number.',
      rest_seconds: 'Rest seconds must be a positive number.',
    });
  });

  it('lets min > max overwrite the reps-min message', () => {
    expect(validateAddSet({ ...blank, repsMin: '12', repsMax: '8' })).toEqual({
      target_reps_min: 'Minimum reps cannot be greater than maximum reps.',
    });
  });

  it('sends only the filled fields, with the unit beside the weight', () => {
    expect(buildAddSetPayload({ setNumber: 3, ...blank, repsMin: '8' })).toEqual({ set_number: 3, target_reps_min: 8 });
    expect(buildAddSetPayload({ setNumber: 1, ...blank, weight: '42.5', unit: 'kg', rest: '60' })).toEqual({
      set_number: 1,
      rest_seconds: 60,
      target_weight_value: 42.5,
      target_weight_unit: 'kg',
    });
  });
});
