import { getServerMessage, getStatus } from '../../shared/api/apiError';

// Derived values of the exercise detail (RN-SPEC-exercise-detail §X1.3).
// Labels always come from the server's `name` fields.

export const NO_EQUIPMENT = 'No equipment needed';

export function primaryMuscleName(profile, exercise) {
  return profile?.primary_muscle?.name || exercise?.primary_muscle_group?.name || '';
}

export function factChips(profile) {
  const chips = [];
  if (profile?.difficulty_level?.name) {
    chips.push(profile.difficulty_level.name);
  }
  if (profile?.mechanic === 'compound') {
    chips.push('Compound');
  } else if (profile?.mechanic === 'isolation') {
    chips.push('Isolation');
  }
  if (profile?.is_unilateral === true) {
    chips.push('One side at a time');
  } else if (profile?.is_unilateral === false) {
    chips.push('Both sides');
  }
  if (profile?.movement_pattern?.name) {
    chips.push(profile.movement_pattern.name);
  }
  return chips;
}

// All-of groups, each any-of. `[]` (or only empty groups) means untagged →
// null. A group with BODYWEIGHT is satisfied; tagged with no lines left →
// ["No equipment needed"].
export function equipmentLines(equipment) {
  const groups = (Array.isArray(equipment) ? equipment : []).filter((group) => Array.isArray(group) && group.length > 0);
  if (groups.length === 0) {
    return null;
  }
  const lines = groups
    .filter((group) => !group.some((item) => item?.code === 'BODYWEIGHT'))
    .map((group) => group.map((item) => item?.name).join(' or '));
  return lines.length ? lines : [NO_EQUIPMENT];
}

// Coming soon: a loaded profile with every tag empty (the primary muscle
// doesn't count).
export function isComingSoon(profile) {
  if (!profile) {
    return false;
  }
  return !(
    profile.secondary_muscles?.length ||
    profile.stabilizer_muscles?.length ||
    profile.movement_pattern ||
    profile.mechanic ||
    (profile.is_unilateral !== null && profile.is_unilateral !== undefined) ||
    profile.difficulty_level ||
    equipmentLines(profile.equipment) ||
    profile.substitutes?.length
  );
}

// Alternatives row: the first 3 characters of the muscle code (⚠X-6).
export function substituteTileCode(substitute) {
  return (substitute?.primary_muscle_group?.code || 'EX').slice(0, 3);
}

// Alternatives row summary: muscle name + equipment description, " · ".
export function substituteSummary(substitute) {
  const muscle = substitute?.primary_muscle_group?.name || '';
  const parts = [muscle, ...(equipmentLines(substitute?.equipment) ?? [])].filter(Boolean);
  return parts.join(' · ') || muscle || 'Exercise';
}

// §X1.1 step 3, from the two settled calls (Promise.allSettled), in order:
// a 404 from either → not found (⚠X-2); the exercise call failed → error
// with the server message; otherwise loaded, a non-404 profile failure
// degrading silently to `profile: null` (⚠X-1).
export function resolveExerciseLoad(exerciseResult, profileResult) {
  const notFound = [exerciseResult, profileResult].some(
    (result) => result.status === 'rejected' && getStatus(result.reason) === 404
  );
  if (notFound) {
    return { status: 'notFound' };
  }
  if (exerciseResult.status === 'rejected') {
    return { status: 'error', message: getServerMessage(exerciseResult.reason) };
  }
  return {
    status: 'loaded',
    exercise: exerciseResult.value,
    profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
  };
}
