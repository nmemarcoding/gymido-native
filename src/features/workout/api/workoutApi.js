import { apiClient } from '../../../shared/api/client';

// Endpoints of RN-SPEC-workout §6 (hub). Each returns the raw `data`; the
// loader applies the per-call failure rules.

const data = (response) => response.data?.data ?? {};

// 200 with `session: null` when idle, never 404 (frozen quirk #5).
export async function getCurrentWorkout() {
  return data(await apiClient.get('/workouts/current')).session ?? null;
}

export async function getTodayStatus() {
  return data(await apiClient.get('/my-plans/current/today'));
}

export async function listExerciseStats() {
  return data(await apiClient.get('/exercise-stats', { params: { per_page: 100 } })).items ?? [];
}

export async function listCompletedWorkouts({ startDate, endDate }) {
  const params = { status: 'completed', start_date: startDate, end_date: endDate, per_page: 100 };
  return data(await apiClient.get('/workouts', { params })).items ?? [];
}

export async function startWorkout(body) {
  return data(await apiClient.post('/workouts', body));
}

// §25 runtime calls. The bodies of the responses are ignored (a reload follows).
export async function updateSessionSet(sessionId, exerciseId, setId, body) {
  return data(await apiClient.patch(`/workouts/${sessionId}/exercises/${exerciseId}/sets/${setId}`, body));
}

export async function completeWorkout(sessionId) {
  return data(await apiClient.post(`/workouts/${sessionId}/complete`));
}

export async function abandonWorkout(sessionId) {
  return data(await apiClient.post(`/workouts/${sessionId}/abandon`));
}
