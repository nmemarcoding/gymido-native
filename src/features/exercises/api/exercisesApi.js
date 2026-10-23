import { apiClient } from '../../../shared/api/client';

// Endpoints of RN-SPEC-exercise-detail §X2.

const data = (response) => response.data?.data ?? {};

export async function getExercise(exerciseId) {
  return data(await apiClient.get(`/exercises/${exerciseId}`)).exercise ?? null;
}

export async function getExerciseProfile(exerciseId) {
  return data(await apiClient.get(`/exercises/${exerciseId}/profile`)).profile ?? null;
}

// RN-SPEC-exercises §E3: one catalog page. `search` is omitted when empty.
// Returns the raw payload (`items`, `pagination`).
export async function listExercisesPage(page, search) {
  const params = { page, per_page: 100 };
  if (search) {
    params.search = search;
  }
  return data(await apiClient.get('/exercises', { params }));
}
