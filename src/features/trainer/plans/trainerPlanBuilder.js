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

// T-74 (T-79 carry, web parity: web's delete goes BACK, navigate(-1)): after
// a plan is deleted its builder leaves so the deleted plan is out of the back
// history:
// - the plan list (`listRoute`) is already below in this stack → popTo it;
// - else (opened from the Plans LIBRARY, a deep link from another page) →
//   goBack when this stack has a screen below (its own index, not
//   canGoBack, which also counts the parent tabs' history);
// - else (nothing below) → replace the deleted plan with the list.
// A create screen is never below: a successful create REPLACES it with the
// builder (CreatePlanForm.submit).
export function openListAfterDelete(navigation, listRoute) {
  const state = navigation?.getState?.();
  const list = state?.routes ?? [];
  const index = typeof state?.index === 'number' ? state.index : list.length - 1;
  if (list.slice(0, Math.max(index, 0)).some((route) => route.name === listRoute)) {
    navigation.popTo(listRoute);
    return;
  }
  if (index > 0) {
    navigation.goBack();
    return;
  }
  navigation.replace(listRoute);
}
