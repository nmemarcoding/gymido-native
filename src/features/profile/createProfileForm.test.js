import {
  INITIAL_PROFILE_FORM,
  buildCreateProfilePayload,
  convertFeetAndInchesToUnitValue,
  convertHeightValueToFeetAndInches,
  numberValue,
  updateHeightUnit,
  validateCreateProfile,
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
