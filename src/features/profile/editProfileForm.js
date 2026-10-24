// Edit profile (RN-SPEC-profile P2): form state, "has changes", validation,
// unit switching and payload, exact (bugs included, no O5/O6).
import { convertFeetAndInchesToUnitValue, convertHeightValueToFeetAndInches, parseNumber } from './createProfileForm';

const text = (value) => String(value ?? '');

// P2.1: the form from the store's profile.
export function editFormFromProfile(profile) {
  const unit = profile?.height_unit || 'cm';
  let height = { height_value: profile?.height_value ?? '', height_feet: '', height_inches: '' };
  if (unit === 'ft_in') {
    // Total inches → round, floor(/12), %12; missing/≤0/NaN → '' and ''.
    const { feet, inches } = convertHeightValueToFeetAndInches(profile?.height_value ?? '', 'in');
    height = { height_value: '', height_feet: feet, height_inches: inches };
  }
  return {
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    height_unit: unit,
    ...height,
    current_weight_value: profile?.current_weight_value ?? '',
    current_weight_unit: profile?.current_weight_unit || 'kg',
    goal_weight_value: profile?.goal_weight_value ?? '',
    goal_weight_unit: profile?.goal_weight_unit || 'kg',
    date_of_birth: profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '',
    sex: profile?.sex || '',
  };
}

// P2.2 / ⚠P-13: profile-create §3.3 web behaviour WITHOUT the O6 fix. Leaving
// ft/in stores the converted NUMBER (empty feet → 0).
export function updateEditHeightUnit(form, nextUnit) {
  if (nextUnit === form.height_unit) {
    return form;
  }
  if (nextUnit === 'ft_in') {
    const { feet, inches } = convertHeightValueToFeetAndInches(form.height_value, form.height_unit);
    return { ...form, height_unit: nextUnit, height_feet: feet, height_inches: inches === '' ? '0' : inches, height_value: '' };
  }
  if (form.height_unit === 'ft_in') {
    const converted = convertFeetAndInchesToUnitValue(form.height_feet, form.height_inches, nextUnit);
    return { ...form, height_unit: nextUnit, height_value: converted, height_feet: '', height_inches: '' };
  }
  // cm ↔ in keeps the value unconverted.
  return { ...form, height_unit: nextUnit };
}

// P2.3 payload height: ft_in → feet×12 + inches (empty → 0; non-finite → null).
export function payloadHeight(form) {
  if (form.height_unit === 'ft_in') {
    const total = Number(form.height_feet) * 12 + Number(form.height_inches);
    return Number.isFinite(total) ? total : null;
  }
  return form.height_value === '' ? null : Number(form.height_value);
}

// P2.3: compared as text (⚠P-9), the height as numbers.
export function editHasChanges(profile, form) {
  if (!profile) {
    return false;
  }
  const pairs = [
    [profile.first_name ?? '', form.first_name],
    [profile.last_name ?? '', form.last_name],
    [profile.height_unit || 'cm', form.height_unit],
    [profile.current_weight_value ?? '', form.current_weight_value],
    [profile.current_weight_unit || 'kg', form.current_weight_unit],
    [profile.goal_weight_value ?? '', form.goal_weight_value],
    [profile.goal_weight_unit || 'kg', form.goal_weight_unit],
    [profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '', form.date_of_birth],
    [profile.sex ?? '', form.sex],
  ];
  if (pairs.some(([before, after]) => String(before) !== text(after))) {
    return true;
  }
  return Number(profile.height_value) !== Number(payloadHeight(form));
}

// P2.4 dated change (23 Oct 2026, owner): the goal weight is optional only
// while the loaded profile has none saved.
export function isGoalWeightOptional(profile) {
  return text(profile?.goal_weight_value).trim() === '';
}

// P2.4, all rules, a later write to the same key wins.
export function validateEditProfile(form, { goalOptional = false } = {}) {
  const errors = {};
  if (!text(form.first_name).trim()) {
    errors.first_name = 'First name is required';
  }
  if (!text(form.last_name).trim()) {
    errors.last_name = 'Last name is required';
  }
  if (!text(form.height_unit).trim()) {
    errors.height_unit = 'Height unit is required';
  }
  if (form.height_unit === 'ft_in') {
    const feetText = text(form.height_feet);
    const feet = Number(feetText);
    if (!feetText.trim()) {
      errors.height_value = 'Feet is required';
    } else if (!Number.isInteger(feet) || feet <= 0) {
      errors.height_value = 'Feet must be a positive whole number';
    }
    if (text(form.height_inches) !== '') {
      const inches = Number(form.height_inches);
      // ⚠P-10: decimals pass.
      if (!Number.isFinite(inches) || inches < 0 || inches > 11) {
        errors.height_inches = 'Inches must be between 0 and 11';
      }
    }
  } else {
    const height = text(form.height_value);
    if (!height.trim()) {
      errors.height_value = 'Height is required';
    } else if (!(parseNumber(height) > 0)) {
      errors.height_value = 'Height must be greater than zero';
    }
  }
  const weight = (key, name, optional = false) => {
    const value = text(form[key]);
    if (!value.trim()) {
      if (!optional) {
        errors[key] = `${name} weight is required`;
      }
    } else if (!(parseNumber(value) > 0)) {
      errors[key] = `${name} weight must be greater than zero`;
    }
  };
  weight('current_weight_value', 'Current');
  weight('goal_weight_value', 'Goal', goalOptional);
  return errors;
}

// P2.5: the PATCH /profile body. A blank (optional) goal omits both goal
// keys, never null; date of birth and sex still send null when blank.
export function buildEditProfilePayload(form) {
  const goal = text(form.goal_weight_value).trim()
    ? { goal_weight_value: parseNumber(form.goal_weight_value), goal_weight_unit: form.goal_weight_unit }
    : {};
  return {
    first_name: text(form.first_name).trim(),
    last_name: text(form.last_name).trim(),
    height_value: payloadHeight(form),
    height_unit: form.height_unit,
    current_weight_value: parseNumber(form.current_weight_value),
    current_weight_unit: form.current_weight_unit,
    ...goal,
    date_of_birth: form.date_of_birth || null,
    sex: form.sex || null,
  };
}

// P2.5 step 5: the first message of each key in body.errors.
export function firstFieldErrors(error) {
  const serverErrors = error?.response?.data?.errors ?? {};
  const next = {};
  for (const key of Object.keys(serverErrors)) {
    const messages = serverErrors[key];
    next[key] = (Array.isArray(messages) ? messages[0] : messages) || '';
  }
  return next;
}

// P1.2
export function profileDisplayName(profile, email) {
  const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  if (name) {
    return name;
  }
  const local = email ? String(email).split('@')[0] : '';
  return local || 'My Name';
}

export function profileInitials(displayName) {
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || '●';
}
