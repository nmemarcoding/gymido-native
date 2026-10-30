import {
  INITIAL_PROFILE_FORM,
  PROFILE_STEP_COUNT,
  SEX_OPTIONS,
  aboutYouEmpty,
  buildCreateProfilePayload,
  clearFieldErrors,
  convertFeetAndInchesToUnitValue,
  convertHeightValueToFeetAndInches,
  fieldsOfStep,
  firstErrorTarget,
  numberValue,
  stepOfFirstError,
  updateHeightUnit,
  validateCreateProfile,
  validateStep,
  weightsEmpty,
} from './createProfileForm';

const form = (changes) => ({ ...INITIAL_PROFILE_FORM, ...changes });

describe('number text (§3.4)', () => {
  it('keeps only browser-valid numbers', () => {
    expect(numberValue('5.')).toBe('');
    expect(numberValue('.5')).toBe('.5');
    expect(numberValue('1e2')).toBe('1e2');
    expect(numberValue('abc')).toBe('');
    expect(numberValue('-3')).toBe('-3');
  });
});

describe('height conversions (§3.3)', () => {
  it('converts to feet and inches', () => {
    expect(convertHeightValueToFeetAndInches('175.26', 'cm')).toEqual({ feet: '5', inches: '9' });
    expect(convertHeightValueToFeetAndInches('71', 'in')).toEqual({ feet: '5', inches: '11' });
    expect(convertHeightValueToFeetAndInches('', 'cm')).toEqual({ feet: '', inches: '' });
  });

  it('converts feet and inches to a unit value', () => {
    expect(convertFeetAndInchesToUnitValue('5', '9', 'cm')).toBe(175.26);
    expect(convertFeetAndInchesToUnitValue('5', '9', 'in')).toBe(69);
    expect(convertFeetAndInchesToUnitValue('', '5', 'cm')).toBe(12.7);
  });

  it('switches units with the O6 string rule', () => {
    const toCm = updateHeightUnit(form({ height_feet: '5', height_inches: '9' }), 'cm');
    expect(toCm).toMatchObject({ height_unit: 'cm', height_value: '175.26', height_feet: '', height_inches: '' });
    expect(updateHeightUnit(form({}), 'in').height_value).toBe('');
    expect(updateHeightUnit(form({ height_unit: 'cm', height_value: '' }), 'ft_in')).toMatchObject({
      height_feet: '',
      height_inches: '0',
    });
    // ⚠P3: cm ↔ in keeps the number.
    expect(updateHeightUnit(form({ height_unit: 'cm', height_value: '180' }), 'in').height_value).toBe('180');
  });
});

describe('validation (§4)', () => {
  it('reports the required fields in order', () => {
    expect(validateCreateProfile(form({}))).toEqual({
      first_name: 'First name is required',
      last_name: 'Last name is required',
      height_value: 'Feet is required',
    });
  });

  it('checks feet, inches and weights', () => {
    const errors = validateCreateProfile(
      form({ first_name: 'a', last_name: 'b', height_feet: '5.5', height_inches: '12', current_weight_value: '0', goal_weight_value: '-1' })
    );
    expect(errors).toEqual({
      height_value: 'Feet must be a positive whole number',
      height_inches: 'Inches must be between 0 and 11',
      current_weight_value: 'Current weight must be greater than zero',
      goal_weight_value: 'Goal weight must be greater than zero',
    });
  });

  it('requires a cm/in height and a positive one', () => {
    const base = form({ first_name: 'a', last_name: 'b', height_unit: 'cm' });
    expect(validateCreateProfile(base).height_value).toBe('Height is required');
    expect(validateCreateProfile({ ...base, height_value: '0' }).height_value).toBe('Height must be greater than zero');
    expect(validateCreateProfile({ ...base, height_value: '180' })).toEqual({});
  });
});

describe('payload (§5.1)', () => {
  it('sends total inches, the shared weight unit only beside a weight, and nulls', () => {
    expect(
      buildCreateProfilePayload(
        form({ first_name: ' John ', last_name: 'Doe', height_feet: '5', height_inches: '9', current_weight_value: '82.5' })
      )
    ).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      height_value: 69,
      height_unit: 'ft_in',
      current_weight_value: 82.5,
      current_weight_unit: 'lb',
      goal_weight_value: null,
      goal_weight_unit: null,
      date_of_birth: null,
      sex: null,
    });
  });

  it('sends cm heights as numbers and the chosen sex', () => {
    const payload = buildCreateProfilePayload(
      form({ first_name: 'a', last_name: 'b', height_unit: 'cm', height_value: '180', sex: 'prefer_not_to_say', date_of_birth: '1990-09-21' })
    );
    expect(payload).toMatchObject({ height_value: 180, sex: 'prefer_not_to_say', date_of_birth: '1990-09-21' });
  });
});

describe('comma decimal weights (T-16)', () => {
  it('validates and sends "83,5" as 83.5 and rejects junk', () => {
    const base = form({ first_name: 'a', last_name: 'b', height_unit: 'cm', height_value: '180' });
    expect(validateCreateProfile(form({ ...base, current_weight_value: '83,5', goal_weight_value: ',5' }))).toEqual({});
    expect(validateCreateProfile(form({ ...base, current_weight_value: 'abc', goal_weight_value: '1e2' }))).toEqual({
      current_weight_value: 'Current weight must be greater than zero',
      goal_weight_value: 'Goal weight must be greater than zero',
    });
    const payload = buildCreateProfilePayload(form({ ...base, current_weight_value: '83,5', goal_weight_value: '78,' }));
    expect(payload.current_weight_value).toBe(83.5);
    expect(payload.goal_weight_value).toBe(78);
  });

  it('treats a spaces-only weight as empty, not as an error', () => {
    const base = form({ first_name: 'a', last_name: 'b', height_unit: 'cm', height_value: '180' });
    expect(validateCreateProfile(form({ ...base, current_weight_value: '   ', goal_weight_value: ' ' }))).toEqual({});
    const payload = buildCreateProfilePayload(form({ ...base, current_weight_value: '   ', goal_weight_value: ' ' }));
    expect(payload).toEqual(expect.objectContaining({ current_weight_value: null, current_weight_unit: null, goal_weight_value: null, goal_weight_unit: null }));
  });
});

// Dated changes 27 Oct 2026 (RN-SPEC-profile-create @ bdc7f348 §3.2, §9).
describe('Sex options (D2, ⚠P5 retired)', () => {
  it('"Not set" (sends null) first, then Male · Female · Other, then "Prefer not to say" once', () => {
    expect(SEX_OPTIONS).toEqual([
      { value: '', label: 'Not set' },
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ]);
    expect(SEX_OPTIONS.filter((option) => option.label === 'Prefer not to say')).toHaveLength(1);
    expect(buildCreateProfilePayload(form({ sex: '' })).sex).toBeNull();
  });
});

describe('editing clears its own error (⚠P12 retired)', () => {
  const errors = {
    first_name: 'a',
    last_name: 'b',
    height_unit: 'u',
    height_value: 'c',
    height_feet: 'f',
    height_inches: 'd',
    current_weight_unit: 'e',
    goal_weight_unit: 'g',
    current_weight_value: 'h',
    goal_weight_value: 'i',
    date_of_birth: 'j',
    sex: 'k',
  };
  const without = (...keys) => Object.fromEntries(Object.entries(errors).filter(([key]) => !keys.includes(key)));

  it.each(['first_name', 'last_name', 'current_weight_value', 'goal_weight_value', 'date_of_birth', 'sex'])('%s clears only itself', (key) => {
    expect(clearFieldErrors(errors, key)).toEqual(without(key));
  });

  it.each(['height_unit', 'height_value', 'height_feet', 'height_inches'])('%s clears every height error together', (key) => {
    expect(clearFieldErrors(errors, key)).toEqual(without('height_unit', 'height_value', 'height_feet', 'height_inches'));
  });

  it('the shared Weight unit clears both unit errors', () => {
    expect(clearFieldErrors(errors, 'weight_unit')).toEqual(without('current_weight_unit', 'goal_weight_unit'));
  });

  it('returns the same object when there is nothing to clear', () => {
    const only = { last_name: 'b' };
    expect(clearFieldErrors(only, 'first_name')).toBe(only);
  });
});

describe('first field in error (⚠P8 retired)', () => {
  it('follows form order', () => {
    expect(firstErrorTarget({ sex: 'x', first_name: 'x' }, 'ft_in')).toBe('first_name');
    expect(firstErrorTarget({ goal_weight_value: 'x', last_name: 'x' }, 'ft_in')).toBe('last_name');
    expect(firstErrorTarget({ current_weight_value: 'x', goal_weight_unit: 'x' }, 'ft_in')).toBe('weight_unit');
    expect(firstErrorTarget({ current_weight_unit: 'x' }, 'cm')).toBe('weight_unit');
    expect(firstErrorTarget({ goal_weight_value: 'x', current_weight_value: 'x' }, 'ft_in')).toBe('current_weight_value');
    expect(firstErrorTarget({ date_of_birth: 'x', goal_weight_value: 'x' }, 'ft_in')).toBe('goal_weight_value');
    expect(firstErrorTarget({ sex: 'x', date_of_birth: 'x' }, 'ft_in')).toBe('date_of_birth');
    expect(firstErrorTarget({ sex: 'x' }, 'ft_in')).toBe('sex');
    expect(firstErrorTarget({}, 'ft_in')).toBeNull();
  });

  it('a height or height_unit error goes to the height input (Feet in ft/in); inches to Inches', () => {
    expect(firstErrorTarget({ height_value: 'x' }, 'ft_in')).toBe('height_feet');
    expect(firstErrorTarget({ height_unit: 'x' }, 'ft_in')).toBe('height_feet');
    expect(firstErrorTarget({ height_inches: 'x', height_value: 'x' }, 'ft_in')).toBe('height_feet');
    expect(firstErrorTarget({ height_inches: 'x' }, 'ft_in')).toBe('height_inches');
    expect(firstErrorTarget({ height_value: 'x' }, 'cm')).toBe('height_value');
    expect(firstErrorTarget({ height_unit: 'x' }, 'in')).toBe('height_value');
    expect(firstErrorTarget({ height_unit: 'x', current_weight_value: 'x' }, 'cm')).toBe('height_value');
  });

  it('an empty message is not an error', () => {
    expect(firstErrorTarget({ first_name: '', sex: 'x' }, 'ft_in')).toBe('sex');
  });
});

// T-53 (onboarding ruling §4): the same rules and messages, run per step.
describe('T-53 steps', () => {
  it('four steps; each owns its fields', () => {
    expect(PROFILE_STEP_COUNT).toBe(4);
    expect(fieldsOfStep(1)).toEqual(['first_name', 'last_name']);
    expect(fieldsOfStep(2)).toEqual(['height_unit', 'height_value', 'height_feet', 'height_inches']);
    expect(fieldsOfStep(3)).toEqual(['current_weight_value', 'goal_weight_value', 'current_weight_unit', 'goal_weight_unit']);
    expect(fieldsOfStep(4)).toEqual(['date_of_birth', 'sex']);
  });

  it('validateStep runs only that step\'s rules (1–2, 3–5b, 6–7; none on P4)', () => {
    const empty = form({ current_weight_value: '0' });
    expect(validateStep(empty, 1)).toEqual({ first_name: 'First name is required', last_name: 'Last name is required' });
    expect(validateStep(empty, 2)).toEqual({ height_value: 'Feet is required' });
    expect(validateStep(form({ height_unit: 'cm', height_value: '0' }), 2)).toEqual({ height_value: 'Height must be greater than zero' });
    expect(validateStep(empty, 3)).toEqual({ current_weight_value: 'Current weight must be greater than zero' });
    expect(validateStep(empty, 4)).toEqual({});
  });

  it('a 422 lands on the step of its first error key, in step order', () => {
    expect(stepOfFirstError({ sex: ['x'], last_name: ['x'] })).toBe(1);
    expect(stepOfFirstError({ goal_weight_value: 'x', height_unit: 'x' })).toBe(2);
    expect(stepOfFirstError({ current_weight_unit: 'x', date_of_birth: 'x' })).toBe(3);
    expect(stepOfFirstError({ date_of_birth: 'x' })).toBe(4);
    expect(stepOfFirstError({ first_name: '' })).toBeNull();
    expect(stepOfFirstError({ body: 'x' })).toBeNull();
  });

  it('P3 "Skip" while both weights are empty after trim; P4 "Skip" while neither is set', () => {
    expect(weightsEmpty(form({ current_weight_value: '  ', goal_weight_value: '' }))).toBe(true);
    expect(weightsEmpty(form({ goal_weight_value: '70' }))).toBe(false);
    expect(aboutYouEmpty(form({}))).toBe(true);
    expect(aboutYouEmpty(form({ sex: 'male' }))).toBe(false);
    expect(aboutYouEmpty(form({ date_of_birth: '1990-01-02' }))).toBe(false);
  });
});
