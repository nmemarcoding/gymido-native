import { apiClient } from '../../../shared/api/client';
import { signalReminders } from '../../reminders/reminderSignals';

// Endpoints of RN-SPEC-plans §6 (S1 and S2).

const data = (response) => response.data?.data ?? {};

// S1: no query params, so the server's first 20 active plans (⚠5).
export async function listPlans() {
  return data(await apiClient.get('/plans')).items ?? [];
}

// The raw `data` ({ enrollment, schedule }); callers decide what a failure means.
export async function getCurrentPlan() {
  return data(await apiClient.get('/my-plans/current'));
}

// T-140 Plan finished: every enrollment, any status.
export async function listMyPlans() {
  return data(await apiClient.get('/my-plans')).items ?? [];
}

export async function getPlan(planId) {
  return data(await apiClient.get(`/plans/${planId}`));
}

export async function listPlanDays(planId) {
  return data(await apiClient.get(`/plans/${planId}/days`)).items ?? [];
}

export async function listDayExercises(planId, dayId) {
  return data(await apiClient.get(`/plans/${planId}/days/${dayId}/exercises`)).items ?? [];
}

export async function cancelEnrollment(enrollmentId) {
  const result = data(await apiClient.post(`/my-plans/${enrollmentId}/cancel`));
  signalReminders('planChanged');
  return result;
}

export async function enrollInPlan(body) {
  const result = data(await apiClient.post('/my-plans', body));
  signalReminders('planChanged');
  return result;
}

export async function createSchedule(enrollmentId, items) {
  const result = data(await apiClient.post(`/my-plans/${enrollmentId}/schedule`, { items }));
  signalReminders('planChanged');
  return result;
}

export async function replaceSchedule(enrollmentId, items) {
  const result = data(await apiClient.put(`/my-plans/${enrollmentId}/schedule`, { items }));
  signalReminders('planChanged');
  return result;
}

// v2 Phase 4 §1 (approved #9): the enrolled week, Monday first:
// `{ week: [{ weekday, is_workout_day, plan_day?, date?, status? } × 7] }`
// (BE #9 adds `date` + `status` ∈ done | today | upcoming | missed | rest).
export async function getCurrentWeek() {
  return data(await apiClient.get('/my-plans/current/week')).week ?? [];
}

// T-60 (phone Plans page) side data, both existing endpoints: the next
// workout (`{ is_workout_day, already_completed, plan_day, action, image? }`)
// and the level names by difficulty_level_id.
export async function getCurrentToday() {
  return data(await apiClient.get('/my-plans/current/today'));
}

export async function listDifficultyLevels() {
  return data(await apiClient.get('/exercise-difficulty-levels')).items ?? [];
}
