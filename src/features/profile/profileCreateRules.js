// Pure rules for Create profile (RN-SPEC-profile-create §3–§5), ported from the
// web (CreateProfilePage.jsx, utils/height.js). Web bugs are reproduced on
// purpose (⚠P3 etc.) except where an owner override says otherwise (O5, O6).

// [O5] Owner override (native only): height opens in ft/in, and one shared
// weight_unit (default lb) replaces the web's two per-row weight units.
export const INITIAL_FORM = Object.freeze({
  first_name: '',
  last_name: '',
  height_unit: 'ft_in',
  height_value: '',
  height_feet: '',
  height_inches: '',
  weight_unit: 'lb',
  current_weight_value: '',
  goal_weight_value: '',
  date_of_birth: '',
  sex: '',
});

export const HEIGHT_UNIT_OPTIONS = [
  { label: 'cm', value: 'cm' },
  { label: 'ft/in', value: 'ft_in' },
  { label: 'in', value: 'in' },
];

// [O5] Default first (web per-row order was kg, lb).
export const WEIGHT_UNIT_OPTIONS = [
  { label: 'lb', value: 'lb' },
  { label: 'kg', value: 'kg' },
];

// ⚠P5: "Prefer not to say" twice; the first sends null, the second the value.
export const SEX_OPTIONS = [
  { label: 'Prefer not to say', value: '' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

export function parseNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// cm → /2.54, in → as is; round to total inches; '' for empty/≤0/NaN.
export function convertHeightValueToFeetAndInches(value, unit) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number) || number <= 0) {
    return { feet: '', inches: '' };
  }
  const totalInches = Math.round(unit === 'cm' ? number / 2.54 : number);
  return { feet: String(Math.floor(totalInches / 12)), inches: String(totalInches % 12) };
}

// cm → round(totalIn × 2.54 × 100) / 100; in → totalIn. Number('') is 0, so
// empty feet gives 0.
export function convertFeetAndInchesToUnitValue(feet, inches, unit) {
  const totalInches = Number(feet) * 12 + Number(inches);
  return unit === 'cm' ? Math.round(totalInches * 2.54 * 100) / 100 : totalInches;
}

// updateHeightUnit (§3.3).
export function applyHeightUnit(form, nextUnit) {
  if (nextUnit === 'ft_in') {
    const { feet, inches } = convertHeightValueToFeetAndInches(form.height_value, form.height_unit);
    return { ...form, height_unit: nextUnit, height_feet: feet, height_inches: inches === '' ? '0' : inches, height_value: '' };
  }
  if (form.height_unit === 'ft_in') {
    // [O6] replaces ⚠P2: height_value is always a string; 0/null become ''.
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

// Client validation (§4), in order; later writes to a key overwrite earlier
// ones. [O6] height is read as String(height_value ?? '') so this never throws.
export function validate(form) {
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
  } else if (!String(form.height_value ?? '').trim()) {
    errors.height_value = 'Height is required';
  } else if (parseNumber(String(form.height_value ?? '')) <= 0) {
    // A null parse also counts: null <= 0 is true.
    errors.height_value = 'Height must be greater than zero';
  }
  if (form.current_weight_value.trim() && parseNumber(form.current_weight_value) <= 0) {
    errors.current_weight_value = 'Current weight must be greater than zero';
  }
  if (form.goal_weight_value.trim() && parseNumber(form.goal_weight_value) <= 0) {
    errors.goal_weight_value = 'Goal weight must be greater than zero';
  }
  return errors;
}

// POST /profile body (§5.1).
export function buildPayload(form) {
  const heightValue =
    form.height_unit === 'ft_in'
      ? Number(form.height_feet) * 12 + Number(form.height_inches)
      : form.height_value === ''
        ? null
        : Number(form.height_value);
  const hasCurrent = form.current_weight_value.trim() !== '';
  const hasGoal = form.goal_weight_value.trim() !== '';
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    height_value: heightValue,
    height_unit: form.height_unit,
    current_weight_value: parseNumber(form.current_weight_value),
    // [O5] the shared unit, only when that weight is filled.
    current_weight_unit: hasCurrent ? form.weight_unit : null,
    goal_weight_value: parseNumber(form.goal_weight_value),
    goal_weight_unit: hasGoal ? form.weight_unit : null,
    date_of_birth: form.date_of_birth || null,
    sex: form.sex || null,
  };
}
