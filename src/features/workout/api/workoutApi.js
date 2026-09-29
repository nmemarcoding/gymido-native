import { apiClient } from '../../../shared/api/client';

// Workout hub endpoints (RN-SPEC-workout §6). The hub deliberately calls
// nothing else: /complete, /abandon are Part B, and /skip plus the unused
// service functions are dead code that isn't ported (§6.5).

const getResponseData = (response) => response?.data?.data ?? null;

// §6.2: 200 with {session: null} when idle, never 404.
export async function getCurrentWorkoutSession() {
  return getResponseData(await apiClient.get('/workouts/current'))?.session ?? null;
}

export async function getTodayWorkoutStatus() {
  return getResponseData(await apiClient.get('/my-plans/current/today'));
}

// ⚠W7: one page only, never paginated.
export async function getExerciseStats() {
  const data = getResponseData(await apiClient.get('/exercise-stats?per_page=100'));
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getCompletedWorkouts({ startDate, endDate }) {
  const data = getResponseData(
    await apiClient.get(`/workouts?status=completed&start_date=${startDate}&end_date=${endDate}&per_page=100`)
  );
  return Array.isArray(data?.items) ? data.items : [];
}

// §6.4.
export async function startWorkout({ enrollmentId, workoutPlanDayId }) {
  const data = getResponseData(
    await apiClient.post('/workouts', {
      user_plan_enrollment_id: enrollmentId,
      workout_plan_day_id: workoutPlanDayId,
    })
  );
  return data?.session ?? null;
}

// §25 runtime calls. The client ignores every body and reloads instead.
// NOTE: POST …/sets/{setId}/complete exists server-side but must stay UNCALLED
// (it would stamp a server clock instead of the device's).
export async function updateWorkoutSet({ sessionId, exerciseId, setId, payload }) {
  await apiClient.patch(`/workouts/${sessionId}/exercises/${exerciseId}/sets/${setId}`, payload);
}

export async function completeWorkout(sessionId) {
  await apiClient.post(`/workouts/${sessionId}/complete`);
}

export async function abandonWorkout(sessionId) {
  await apiClient.post(`/workouts/${sessionId}/abandon`);
}
