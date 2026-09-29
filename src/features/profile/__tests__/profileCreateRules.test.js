import { numberInputValue } from '../../../shared/components/form/Input';
import {
  applyHeightUnit,
  buildPayload,
  convertFeetAndInchesToUnitValue,
  convertHeightValueToFeetAndInches,
  HEIGHT_UNIT_OPTIONS,
  INITIAL_FORM,
  parseNumber,
  SEX_OPTIONS,
  validate,
  WEIGHT_UNIT_OPTIONS,
} from '../profileCreateRules';

const form = (overrides) => ({
  ...INITIAL_FORM,
  first_name: 'John',
  last_name: 'Doe',
  height_unit: 'cm',
  height_value: '180',
  ...overrides,
});

describe('owner override O5', () => {
  test('height opens in ft/in with empty parts; one weight_unit defaulting to lb', () => {
    expect(INITIAL_FORM).toMatchObject({ height_unit: 'ft_in', height_feet: '', height_inches: '', height_value: '', weight_unit: 'lb' });
    expect(INITIAL_FORM).not.toHaveProperty('current_weight_unit');
    expect(INITIAL_FORM).not.toHaveProperty('goal_weight_unit');
  });

  test('weight unit options: lb then kg; height options keep the web order', () => {
    expect(WEIGHT_UNIT_OPTIONS.map((option) => option.value)).toEqual(['lb', 'kg']);
    expect(HEIGHT_UNIT_OPTIONS.map((option) => option.value)).toEqual(['cm', 'ft_in', 'in']);
  });

  test('payload: the shared unit goes to each weight only when that weight is filled', () => {
    expect(buildPayload(form({ weight_unit: 'kg', current_weight_value: '180', goal_weight_value: '' }))).toMatchObject({
      current_weight_value: 180,
      current_weight_unit: 'kg',
      goal_weight_value: null,
      goal_weight_unit: null,
    });
    expect(buildPayload(form({ current_weight_value: '180', goal_weight_value: '170' }))).toMatchObject({
      current_weight_unit: 'lb',
      goal_weight_unit: 'lb',
    });
  });

  test('O6 (replaces ⚠P2): default ft/in with empty feet → cm gives "" and a normal "Height is required"', () => {
    const next = applyHeightUnit({ ...INITIAL_FORM, first_name: 'J', last_name: 'D' }, 'cm');
    expect(next.height_value).toBe('');
    expect(validate(next)).toEqual({ height_value: 'Height is required' });
  });

  test.each([
    [{ height_feet: '5', height_inches: '9' }, 'cm', '175.26'],
    [{ height_feet: '5', height_inches: '9' }, 'in', '69'],
    [{ height_feet: '', height_inches: '5' }, 'cm', '12.7'],
    [{ height_feet: '0', height_inches: '0' }, 'in', ''],
  ])('O6: ft/in %j → %s is the string %j, parts cleared', (parts, unit, value) => {
    const next = applyHeightUnit({ ...INITIAL_FORM, ...parts }, unit);
    expect(next).toMatchObject({ height_unit: unit, height_value: value, height_feet: '', height_inches: '' });
  });

  test('O6: validation never throws, even on a stray number', () => {
    expect(() => validate(form({ height_value: 72 }))).not.toThrow();
    expect(validate(form({ height_value: null })).height_value).toBe('Height is required');
  });
});

describe('number input value (§3.4)', () => {
  test.each([
    ['180', '180'],
    ['82.5', '82.5'],
    ['5.', ''],
    ['.5', '.5'],
    ['1e2', '1e2'],
    ['-3', '-3'],
    ['abc', ''],
    ['', ''],
  ])('%j → %j', (text, stored) => {
    expect(numberInputValue(text)).toBe(stored);
  });
});

describe('height conversions (§3.3)', () => {
  test('cm → ft/in rounds to total inches', () => {
    expect(convertHeightValueToFeetAndInches('180', 'cm')).toEqual({ feet: '5', inches: '11' });
  });

  test('in → ft/in', () => {
    expect(convertHeightValueToFeetAndInches('71', 'in')).toEqual({ feet: '5', inches: '11' });
  });

  test.each(['', '0', '-4', 'x'])('empty / ≤0 / NaN %j → blanks', (value) => {
    expect(convertHeightValueToFeetAndInches(value, 'cm')).toEqual({ feet: '', inches: '' });
  });

  test('ft/in → cm is a rounded NUMBER; empty feet gives 0', () => {
    expect(convertFeetAndInchesToUnitValue('5', '11', 'cm')).toBe(180.34);
    expect(convertFeetAndInchesToUnitValue('5', '11', 'in')).toBe(71);
    expect(convertFeetAndInchesToUnitValue('', '', 'cm')).toBe(0);
  });

  test('to ft/in: converted parts, blank inches become "0", value cleared', () => {
    expect(applyHeightUnit(form({ height_unit: 'cm', height_value: '' }), 'ft_in')).toMatchObject({
      height_unit: 'ft_in',
      height_feet: '',
      height_inches: '0',
      height_value: '',
    });
  });

  test('back from ft/in stores a string (O6) and clears the parts', () => {
    const next = applyHeightUnit(form({ height_unit: 'ft_in', height_feet: '6', height_inches: '0' }), 'in');
    expect(next).toMatchObject({ height_unit: 'in', height_value: '72', height_feet: '', height_inches: '' });
    expect(validate(next)).toEqual({});
  });

  test('⚠P3: cm ↔ in keeps the value unconverted', () => {
    expect(applyHeightUnit(form({ height_value: '180' }), 'in').height_value).toBe('180');
  });
});

describe('validation (§4)', () => {
  test('required names and height (cm)', () => {
    expect(validate({ ...INITIAL_FORM, height_unit: 'cm', first_name: ' ', last_name: '' })).toEqual({
      first_name: 'First name is required',
      last_name: 'Last name is required',
      height_value: 'Height is required',
    });
  });

  test('height must be greater than zero; an unparseable value counts too (null <= 0)', () => {
    expect(validate(form({ height_value: '0' })).height_value).toBe('Height must be greater than zero');
    expect(validate(form({ height_value: '1e400' })).height_value).toBe('Height must be greater than zero');
  });

  test('ft/in rules', () => {
    expect(validate(form({ height_unit: 'ft_in', height_feet: '' })).height_value).toBe('Feet is required');
    expect(validate(form({ height_unit: 'ft_in', height_feet: '5.5' })).height_value).toBe(
      'Feet must be a positive whole number'
    );
    expect(validate(form({ height_unit: 'ft_in', height_feet: '5', height_inches: '12' })).height_inches).toBe(
      'Inches must be between 0 and 11'
    );
    expect(validate(form({ height_unit: 'ft_in', height_feet: '5', height_inches: '5.5' }))).toEqual({});
  });

  test('weights only when filled', () => {
    expect(validate(form({ current_weight_value: '-1', goal_weight_value: '0' }))).toEqual({
      current_weight_value: 'Current weight must be greater than zero',
      goal_weight_value: 'Goal weight must be greater than zero',
    });
  });

  test('⚠P11: no client range checks', () => {
    expect(validate(form({ height_value: '9999', current_weight_value: '5000' }))).toEqual({});
  });
});

describe('payload (§5.1)', () => {
  test('minimal form', () => {
    expect(buildPayload(form({ first_name: ' John ', last_name: ' Doe ' }))).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      height_value: 180,
      height_unit: 'cm',
      current_weight_value: null,
      current_weight_unit: null,
      goal_weight_value: null,
      goal_weight_unit: null,
      date_of_birth: null,
      sex: null,
    });
  });

  test('ft/in sends total inches; units only with values', () => {
    expect(
      buildPayload(
        form({
          height_unit: 'ft_in',
          height_feet: '5',
          height_inches: '',
          current_weight_value: '82.5',
          weight_unit: 'lb',
          date_of_birth: '1990-09-21',
          sex: 'prefer_not_to_say',
        })
      )
    ).toMatchObject({
      height_value: 60,
      height_unit: 'ft_in',
      current_weight_value: 82.5,
      current_weight_unit: 'lb',
      goal_weight_unit: null,
      date_of_birth: '1990-09-21',
      sex: 'prefer_not_to_say',
    });
  });

  test('parseNumber', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('2.5')).toBe(2.5);
  });

  test('⚠P5: "Prefer not to say" twice, first null, second the value', () => {
    const prefer = SEX_OPTIONS.filter((option) => option.label === 'Prefer not to say');
    expect(prefer.map((option) => option.value)).toEqual(['', 'prefer_not_to_say']);
  });
});
