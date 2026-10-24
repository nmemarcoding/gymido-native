import {
  buildEditProfilePayload,
  editFormFromProfile,
  editHasChanges,
  firstFieldErrors,
  payloadHeight,
  profileDisplayName,
  profileInitials,
  updateEditHeightUnit,
  validateEditProfile,
} from './editProfileForm';

const PROFILE = {
  first_name: 'Asad',
  last_name: 'Khan',
  height_value: 180,
  height_unit: 'cm',
  current_weight_value: 82.5,
  current_weight_unit: 'kg',
  goal_weight_value: 78,
  goal_weight_unit: 'kg',
  date_of_birth: '1990-04-02T00:00:00.000000Z',
  sex: 'male',
};

describe('form from profile (P2.1)', () => {
  it('copies values and cuts the date to 10 characters', () => {
    expect(editFormFromProfile(PROFILE)).toEqual({
      first_name: 'Asad',
      last_name: 'Khan',
      height_unit: 'cm',
      height_value: 180,
      height_feet: '',
      height_inches: '',
      current_weight_value: 82.5,
      current_weight_unit: 'kg',
      goal_weight_value: 78,
      goal_weight_unit: 'kg',
      date_of_birth: '1990-04-02',
      sex: 'male',
    });
  });

  it('defaults to cm, kg and empty text', () => {
    const form = editFormFromProfile({});
    expect(form.height_unit).toBe('cm');
    expect(form.height_value).toBe('');
    expect(form.current_weight_unit).toBe('kg');
    expect(form.goal_weight_unit).toBe('kg');
    expect(form.date_of_birth).toBe('');
    expect(form.sex).toBe('');
  });

  it('splits ft_in total inches into feet and inches', () => {
    expect(editFormFromProfile({ height_unit: 'ft_in', height_value: 69.4 })).toMatchObject({
      height_value: '',
      height_feet: '5',
      height_inches: '9',
    });
    expect(editFormFromProfile({ height_unit: 'ft_in', height_value: 0 })).toMatchObject({ height_feet: '', height_inches: '' });
    expect(editFormFromProfile({ height_unit: 'ft_in' })).toMatchObject({ height_feet: '', height_inches: '' });
  });
});

describe('height unit switching (P2.2, ⚠P-13, no O6)', () => {
  const form = editFormFromProfile(PROFILE);

  it('cm → ft/in converts', () => {
    expect(updateEditHeightUnit({ ...form, height_value: '175.26' }, 'ft_in')).toMatchObject({
      height_unit: 'ft_in',
      height_feet: '5',
      height_inches: '9',
      height_value: '',
    });
  });

  it('ft/in → cm stores a number, empty feet → 0', () => {
    const ftIn = { ...form, height_unit: 'ft_in', height_value: '', height_feet: '5', height_inches: '9' };
    expect(updateEditHeightUnit(ftIn, 'cm').height_value).toBe(175.26);
    expect(updateEditHeightUnit(ftIn, 'in').height_value).toBe(69);
    const empty = updateEditHeightUnit({ ...ftIn, height_feet: '', height_inches: '' }, 'cm');
    expect(empty.height_value).toBe(0);
    expect(validateEditProfile(empty).height_value).toBe('Height must be greater than zero');
  });

  it('cm ↔ in keeps the value', () => {
    expect(updateEditHeightUnit(form, 'in').height_value).toBe(180);
  });
});

describe('has changes (P2.3)', () => {
  it('is false without a profile or without edits', () => {
    expect(editHasChanges(null, editFormFromProfile(PROFILE))).toBe(false);
    expect(editHasChanges(PROFILE, editFormFromProfile(PROFILE))).toBe(false);
  });

  it('compares text (⚠P-9)', () => {
    expect(editHasChanges(PROFILE, { ...editFormFromProfile(PROFILE), current_weight_value: '82.50' })).toBe(true);
    expect(editHasChanges(PROFILE, { ...editFormFromProfile(PROFILE), current_weight_value: '82.5' })).toBe(false);
    expect(editHasChanges(PROFILE, { ...editFormFromProfile(PROFILE), sex: '' })).toBe(true);
  });

  it('compares the height as numbers', () => {
    expect(editHasChanges(PROFILE, { ...editFormFromProfile(PROFILE), height_value: '180.0' })).toBe(false);
    const ftIn = { height_unit: 'ft_in', height_value: 69 };
    const form = editFormFromProfile(ftIn);
    expect(editHasChanges(ftIn, form)).toBe(false);
    expect(editHasChanges(ftIn, { ...form, height_inches: '10' })).toBe(true);
  });
});

describe('payload height', () => {
  it('ft_in → total inches, decimals kept (⚠P-10)', () => {
    expect(payloadHeight({ height_unit: 'ft_in', height_feet: '5', height_inches: '9' })).toBe(69);
    expect(payloadHeight({ height_unit: 'ft_in', height_feet: '5', height_inches: '5.5' })).toBe(65.5);
    expect(payloadHeight({ height_unit: 'ft_in', height_feet: '5', height_inches: '' })).toBe(60);
    expect(payloadHeight({ height_unit: 'cm', height_value: '' })).toBeNull();
  });
});

describe('validation (P2.4)', () => {
  it('lists every failing field', () => {
    const errors = validateEditProfile({
      ...editFormFromProfile({}),
      first_name: ' ',
      current_weight_value: '',
      goal_weight_value: '0',
    });
    expect(errors).toEqual({
      first_name: 'First name is required',
      last_name: 'Last name is required',
      height_value: 'Height is required',
      current_weight_value: 'Current weight is required',
      goal_weight_value: 'Goal weight must be greater than zero',
    });
  });

  it('checks feet and inches', () => {
    const base = { ...editFormFromProfile(PROFILE), height_unit: 'ft_in', height_value: '' };
    expect(validateEditProfile({ ...base, height_feet: '', height_inches: '' }).height_value).toBe('Feet is required');
    expect(validateEditProfile({ ...base, height_feet: '5.5', height_inches: '' }).height_value).toBe(
      'Feet must be a positive whole number'
    );
    expect(validateEditProfile({ ...base, height_feet: '5', height_inches: '12' }).height_inches).toBe(
      'Inches must be between 0 and 11'
    );
    expect(validateEditProfile({ ...base, height_feet: '5', height_inches: '5.5' })).toEqual({});
  });

  it('accepts a loaded profile with number values', () => {
    expect(validateEditProfile(editFormFromProfile(PROFILE))).toEqual({});
  });
});

describe('payload (P2.5)', () => {
  it('sends the full body with nulls and units', () => {
    const form = {
      ...editFormFromProfile(PROFILE),
      first_name: ' Asad ',
      height_unit: 'ft_in',
      height_feet: '5',
      height_inches: '9',
      date_of_birth: '',
      sex: '',
    };
    expect(buildEditProfilePayload(form)).toEqual({
      first_name: 'Asad',
      last_name: 'Khan',
      height_value: 69,
      height_unit: 'ft_in',
      current_weight_value: 82.5,
      current_weight_unit: 'kg',
      goal_weight_value: 78,
      goal_weight_unit: 'kg',
      date_of_birth: null,
      sex: null,
    });
  });

  it('keeps the first server message per key', () => {
    const error = { response: { data: { errors: { height_value: ['Too tall', 'x'], sex: 'Bad' } } } };
    expect(firstFieldErrors(error)).toEqual({ height_value: 'Too tall', sex: 'Bad' });
  });
});

describe('display name and initials (P1.2)', () => {
  it('falls back to the email, then "My Name"', () => {
    expect(profileDisplayName(PROFILE, 'a@b.c')).toBe('Asad Khan');
    expect(profileDisplayName({ first_name: '', last_name: '' }, 'mamad@x.com')).toBe('mamad');
    expect(profileDisplayName(null, null)).toBe('My Name');
    expect(profileDisplayName(null, '@x.com')).toBe('My Name');
  });

  it('takes two upper-case initials, else ●', () => {
    expect(profileInitials('asad khan jr')).toBe('AK');
    expect(profileInitials('mamad')).toBe('M');
    expect(profileInitials('a  b')).toBe('AB');
    expect(profileInitials('')).toBe('●');
  });
});

describe('optional goal weight (P2.4 dated change, 23 Oct 2026)', () => {
  const { isGoalWeightOptional } = require('./editProfileForm');
  const noGoal = { ...PROFILE, goal_weight_value: null, goal_weight_unit: null };

  it('is optional only while the loaded profile has no goal', () => {
    expect(isGoalWeightOptional(noGoal)).toBe(true);
    expect(isGoalWeightOptional({ ...PROFILE, goal_weight_value: '' })).toBe(true);
    expect(isGoalWeightOptional(PROFILE)).toBe(false);
  });

  it('accepts a blank goal when optional, still rejects a blank saved goal and a non-positive one', () => {
    const blank = { ...editFormFromProfile(noGoal), goal_weight_value: '' };
    expect(validateEditProfile(blank, { goalOptional: true }).goal_weight_value).toBeUndefined();
    expect(validateEditProfile(blank, { goalOptional: false }).goal_weight_value).toBe('Goal weight is required');
    expect(validateEditProfile({ ...blank, goal_weight_value: '0' }, { goalOptional: true }).goal_weight_value).toBe(
      'Goal weight must be greater than zero'
    );
  });

  it('omits both goal keys when the goal is blank, keeps null for date of birth and sex', () => {
    const payload = buildEditProfilePayload({ ...editFormFromProfile(noGoal), goal_weight_value: '  ', date_of_birth: '', sex: '' });
    expect(payload).not.toHaveProperty('goal_weight_value');
    expect(payload).not.toHaveProperty('goal_weight_unit');
    expect(payload).toMatchObject({ date_of_birth: null, sex: null });
    expect(buildEditProfilePayload({ ...editFormFromProfile(noGoal), goal_weight_value: '75' })).toMatchObject({
      goal_weight_value: 75,
      goal_weight_unit: 'kg',
    });
  });
});
