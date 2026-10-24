import { copyTrainerPlan, createPlanWrites } from './api/plansApi';

const ADD_KEYS = ['addDay', 'addExercise', 'addSet'];
const EDIT_KEYS = [
  'editPlan',
  'deletePlan',
  'editDay',
  'deleteDay',
  'deleteExercise',
  'reorderExercises',
  'editSet',
  'deleteSet',
];

// Spec §A5.1: every control on the plan screen is gated on this table, never
// on ownership directly. Today each key is simply `isOwnPlan`.
export function getTrainerPlanCapabilities({ isOwnPlan }) {
  const capabilities = {};
  for (const key of [...ADD_KEYS, ...EDIT_KEYS]) {
    capabilities[key] = Boolean(isOwnPlan);
  }
  return capabilities;
}

// Part C §CP1: copying is its own capability, outside the table above, so it
// never counts towards canEdit or triggers the affected-clients request.
export function canCopyTrainerPlan() {
  return true;
}

export function canEditPlan(capabilities) {
  return EDIT_KEYS.some((key) => capabilities[key]);
}

// All writes for one plan, so member editing brings its own pair (C6).
export function createTrainerPlanMutations(planId) {
  return {
    ...createPlanWrites(`/trainer/plans/${planId}`),
    copyPlan: () => copyTrainerPlan(planId),
  };
}
