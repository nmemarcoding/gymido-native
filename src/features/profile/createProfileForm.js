import { parseDecimal } from '../../shared/format/numbers';

// Create profile (RN-SPEC-profile-create): form state, height maths,
// validation and payload, exact (bugs included, O5/O6 applied).

export const INITIAL_PROFILE_FORM = Object.freeze({
  first_name: '',
  last_name: '',
  height_unit: 'ft_in',
  height_value: '',
  height_feet: '',
  height_inches: '',
  current_weight_value: '',
  goal_weight_value: '',
  weight_unit: 'lb',
  date_of_birth: '',
  sex: '',
});

// §3.4: the browser's number-input semantics. Invalid text is stored as ''.
const NUMBER_TEXT = /^-?(\d+|\d*\.\d+)([eE][-+]?\d+)?$/;

export function numberValue(text) {
  return NUMBER_TEXT.test(text) ? text : '';
}

// §4 (T-16): read with parseDecimal, so "83,5" → 83.5 and junk → null.
export function parseNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const number = parseDecimal(value);
  return Number.isFinite(number) ? number : null;
}

// §3.3 cm → value/2.54, in → value; round to total inches; '' when empty/≤0/NaN.
export function convertHeightValueToFeetAndInches(value, unit) {
  const number = Number(value);
  if (value === '' || value === null || Number.isNaN(number) || number <= 0) {
    return { feet: '', inches: '' };
  }
  const totalInches = Math.round(unit === 'cm' ? number / 2.54 : number);
  return { feet: String(Math.floor(totalInches / 12)), inches: String(totalInches % 12) };
}

// cm → round(totalIn × 2.54 × 100)/100; in → totalIn. Number('') = 0.
export function convertFeetAndInchesToUnitValue(feet, inches, unit) {
  const totalInches = Number(feet) * 12 + Number(inches);
  if (Number.isNaN(totalInches)) {
    return null;
  }
  return unit === 'cm' ? Math.round(totalInches * 2.54 * 100) / 100 : totalInches;
}

// §3.3 updateHeightUnit with [O6]: height_value always stays a string.
export function updateHeightUnit(form, nextUnit) {
  if (nextUnit === form.height_unit) {
    return form;
  }
  if (nextUnit === 'ft_in') {
    const { feet, inches } = convertHeightValueToFeetAndInches(form.height_value, form.height_unit);
    return { ...form, height_unit: nextUnit, height_feet: feet, height_inches: inches === '' ? '0' : inches, height_value: '' };
  }
  if (form.height_unit === 'ft_in') {
    const converted = convertFeetAndInchesToUnitValue(form.height_feet, form.height_inches, nextUnit);
    return {
      ...form,
      height_unit: nextUnit,
      height_value: converted === null || converted === 0 ? '' : String(converted),
      height_feet: '',
      height_inches: '',
    };
  }
  // ⚠P3: cm ↔ in keeps the value unconverted.
  return { ...form, height_unit: nextUnit };
}

// §4, in order; a later write to the same key wins.
export function validateCreateProfile(form) {
  const errors = {};
  if (!form.first_name.trim()) {
    errors.first_name = 'First name is required';
  }
  if (!form.last_name.trim()) {
    errors.last_name = 'Last name is required';
  }
  if (!form.height_unit.trim()) {
    errors.height_unit = 'Height unit is required';
  }
  if (form.height_unit === 'ft_in') {
    const feet = Number(form.height_feet);
    if (form.height_feet === '') {
      errors.height_value = 'Feet is required';
    } else if (!Number.isInteger(feet) || feet <= 0) {
      errors.height_value = 'Feet must be a positive whole number';
    }
    if (form.height_inches !== '') {
      const inches = Number(form.height_inches);
      if (!Number.isFinite(inches) || inches < 0 || inches > 11) {
        errors.height_inches = 'Inches must be between 0 and 11';
      }
    }
  } else {
    // [O6] String(...) so this can never throw.
    const height = String(form.height_value ?? '');
    if (!height.trim()) {
      errors.height_value = 'Height is required';
    } else if (!(parseNumber(height) > 0)) {
      errors.height_value = 'Height must be greater than zero';
    }
  }
  if (String(form.current_weight_value).trim() !== '' && !(parseNumber(form.current_weight_value) > 0)) {
    errors.current_weight_value = 'Current weight must be greater than zero';
  }
  if (String(form.goal_weight_value).trim() !== '' && !(parseNumber(form.goal_weight_value) > 0)) {
    errors.goal_weight_value = 'Goal weight must be greater than zero';
  }
  return errors;
}

// §5.1, with [O5] one shared weight unit sent only beside a filled weight.
export function buildCreateProfilePayload(form) {
  const heightValue =
    form.height_unit === 'ft_in'
      ? Number(form.height_feet) * 12 + Number(form.height_inches)
      : form.height_value === ''
        ? null
        : Number(form.height_value);
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    height_value: heightValue,
    height_unit: form.height_unit,
    current_weight_value: parseNumber(form.current_weight_value),
    current_weight_unit: form.current_weight_value.trim() ? form.weight_unit : null,
    goal_weight_value: parseNumber(form.goal_weight_value),
    goal_weight_unit: form.goal_weight_value.trim() ? form.weight_unit : null,
    date_of_birth: form.date_of_birth || null,
    sex: form.sex || null,
  };
}

// §3.2 Sex options, dated change 27 Oct 2026 (owner D2): "Not set" first
// (sends null), "Prefer not to say" once. ⚠P5 retired.
export const SEX_OPTIONS = Object.freeze([
  Object.freeze({ value: '', label: 'Not set' }),
  Object.freeze({ value: 'male', label: 'Male' }),
  Object.freeze({ value: 'female', label: 'Female' }),
  Object.freeze({ value: 'other', label: 'Other' }),
  Object.freeze({ value: 'prefer_not_to_say', label: 'Prefer not to say' }),
]);

// ⚠P12 retired 27 Oct 2026: a change clears that field's error at once. Any
// height input or the height unit clears all height errors together; the
// shared Weight unit clears both unit errors. The same object comes back when
// nothing changes (no re-render).
const HEIGHT_ERROR_KEYS = ['height_unit', 'height_value', 'height_feet', 'height_inches'];
const UNIT_ERROR_KEYS = ['current_weight_unit', 'goal_weight_unit'];
export function clearFieldErrors(errors, field) {
  const keys = HEIGHT_ERROR_KEYS.includes(field) ? HEIGHT_ERROR_KEYS : field === 'weight_unit' ? UNIT_ERROR_KEYS : [field];
  if (!keys.some((key) => key in errors)) {
    return errors;
  }
  const next = { ...errors };
  keys.forEach((key) => delete next[key]);
  return next;
}

// ⚠P8 retired 27 Oct 2026: the field that takes focus after a failed submit,
// in form order. A height or height-unit error → Feet (ft/in) or Height;
// inches → Inches; any unit error → the shared Weight unit. null when none.
export function firstErrorTarget(errors, heightUnit) {
  const has = (...keys) => keys.some((key) => Boolean(errors[key]));
  const ftIn = heightUnit === 'ft_in';
  if (has('first_name')) return 'first_name';
  if (has('last_name')) return 'last_name';
  if (has('height_value', 'height_unit', 'height_feet')) return ftIn ? 'height_feet' : 'height_value';
  if (has('height_inches')) return ftIn ? 'height_inches' : 'height_value';
  if (has(...UNIT_ERROR_KEYS)) return 'weight_unit';
  for (const key of ['current_weight_value', 'goal_weight_value', 'date_of_birth', 'sex']) {
    if (has(key)) return key;
  }
  return null;
}
