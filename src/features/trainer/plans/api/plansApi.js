import { apiClient } from '../../../../shared/api/client';
import { getStatus } from '../../../../shared/api/apiError';

// Endpoints of the trainer plans spec §A10. Every function returns the keys
// the screens read from `body.data`.

const items = (response) => response.data?.data?.items ?? [];

export async function listTrainerPlans(page) {
  const response = await apiClient.get('/trainer/plans', { params: { page, per_page: 20 } });
  const data = response.data?.data ?? {};
  const pagination = data.pagination ?? {};
  return {
    items: data.items ?? [],
    currentPage: pagination.page ?? 1,
    totalPages: pagination.total_pages ?? 1,
    totalRecords: pagination.total ?? 0,
    perPage: pagination.per_page ?? 20,
  };
}

export async function getTrainerPlan(planId) {
  const response = await apiClient.get(`/trainer/plans/${planId}`);
  return response.data?.data?.plan ?? null;
}

// Ownership probe (§A5.2): only a 404 means "own plan". 200 and every other
// failure mean catalog. ⚠T3-1
export async function probeIsOwnPlan(planId) {
  try {
    await apiClient.get(`/plans/${planId}`);
    return false;
  } catch (error) {
    return getStatus(error) === 404;
  }
}

export async function listPlanDays(planId) {
  return items(await apiClient.get(`/plans/${planId}/days`));
}

export async function listDayExercises(planId, dayId) {
  return items(await apiClient.get(`/plans/${planId}/days/${dayId}/exercises`));
}

export async function listExerciseSets(planId, dayId, planDayExerciseId) {
  return items(await apiClient.get(`/plans/${planId}/days/${dayId}/exercises/${planDayExerciseId}/sets`));
}

export async function createTrainerPlan(payload) {
  const response = await apiClient.post('/trainer/plans', payload);
  return response.data?.data?.plan ?? null;
}

export async function listExercisesPage(page) {
  const response = await apiClient.get('/exercises', { params: { page, per_page: 100 } });
  const data = response.data?.data ?? {};
  return { items: data.items ?? [], totalPages: data.pagination?.total_pages };
}

export async function listMuscleGroups() {
  return items(await apiClient.get('/muscle-groups'));
}

export async function listEquipmentTypes() {
  return items(await apiClient.get('/equipment-types'));
}

export async function listPlanCategories() {
  return items(await apiClient.get('/plan-categories'));
}

export async function listDifficultyLevels() {
  return items(await apiClient.get('/exercise-difficulty-levels'));
}

// Writes on one plan (trainer plans §A10, Part B §B9; member plans §M6).
// `root` is the plan's write path: `/trainer/plans/{id}` for a trainer,
// `/my-custom-plans/{id}` for a member. Day creates return `plan_day`, day
// writes return `day`.
export function createPlanWrites(root) {
  const data = (response) => response.data?.data ?? {};
  const exercises = (dayId) => `${root}/days/${dayId}/exercises`;
  const sets = (dayId, pdeId) => `${exercises(dayId)}/${pdeId}/sets`;
  const setResult = (response) => ({
    set: data(response).plan_day_exercise_set ?? null,
    targetSetSummary: data(response).target_set_summary ?? null,
  });
  return {
    addDay: async (payload) => data(await apiClient.post(`${root}/days`, payload)).plan_day ?? null,
    addExercise: async (dayId, payload) =>
      data(await apiClient.post(exercises(dayId), payload)).plan_day_exercise ?? null,
    addSet: async (dayId, pdeId, payload) => setResult(await apiClient.post(sets(dayId, pdeId), payload)),
    affectedClientCount: async () => {
      const count = data(await apiClient.get(`${root}/affected-clients`)).active_client_count;
      return typeof count === 'number' && !Number.isNaN(count) ? count : 0;
    },
    updatePlan: async (changes) => data(await apiClient.patch(root, changes)).plan ?? null,
    deletePlan: async () => data(await apiClient.delete(root)).plan ?? null,
    updateDay: async (dayId, payload) => data(await apiClient.put(`${root}/days/${dayId}`, payload)).day ?? null,
    deleteDay: async (dayId) => data(await apiClient.delete(`${root}/days/${dayId}`)).day ?? null,
    reorderExercises: async (dayId, order) =>
      data(await apiClient.post(`${exercises(dayId)}/reorder`, { order })).items ?? [],
    deleteExercise: async (dayId, pdeId) =>
      data(await apiClient.delete(`${exercises(dayId)}/${pdeId}`)).plan_day_exercise ?? null,
    updateSet: async (dayId, pdeId, setId, payload) =>
      setResult(await apiClient.put(`${sets(dayId, pdeId)}/${setId}`, payload)),
    deleteSet: async (dayId, pdeId, setId) =>
      data(await apiClient.delete(`${sets(dayId, pdeId)}/${setId}`)).plan_day_exercise_set ?? null,
  };
}

// Part C (spec §CP3): copy a plan the trainer can open. The id goes as a number.
export async function copyTrainerPlan(planId) {
  const response = await apiClient.post('/trainer/plans/copies', { workout_plan_id: Number(planId) });
  return response.data?.data?.plan ?? null;
}
