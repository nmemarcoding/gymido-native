import { apiClient } from '../../../shared/api/client';

// Endpoints of RN-SPEC-exercise-detail §X2.

const data = (response) => response.data?.data ?? {};

export async function getExercise(exerciseId) {
  return data(await apiClient.get(`/exercises/${exerciseId}`)).exercise ?? null;
}

export async function getExerciseProfile(exerciseId) {
  return data(await apiClient.get(`/exercises/${exerciseId}/profile`)).profile ?? null;
}
