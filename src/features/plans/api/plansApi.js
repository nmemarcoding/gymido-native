import { apiClient } from '../../../shared/api/client';

// Thin wrappers over the endpoints in RN-SPEC-plans §6, returning `body.data`
// the way the web app's plans service does.

const getResponseData = (response) => response?.data?.data ?? null;
const unwrapItems = (response) => getResponseData(response)?.items || [];

// No query params: only the server's first page of 20 loads (⚠5).
export async function getWorkoutPlans() {
  const response = await apiClient.get('/plans');
  const data = getResponseData(response) || {};
  return { items: Array.isArray(data.items) ? data.items : [] };
}

export async function getWorkoutPlan(planId) {
  return getResponseData(await apiClient.get(`/plans/${planId}`));
}

export async function getWorkoutPlanDays(planId) {
  return unwrapItems(await apiClient.get(`/plans/${planId}/days`));
}

export async function getWorkoutPlanDayExercises(planId, planDayId) {
  return unwrapItems(await apiClient.get(`/plans/${planId}/days/${planDayId}/exercises`));
}

export async function getCurrentPlan() {
  return getResponseData(await apiClient.get('/my-plans/current'));
}

export async function createMyPlanEnrollment(payload) {
  return getResponseData(await apiClient.post('/my-plans', payload));
}

export async function createMyPlanSchedule(enrollmentId, payload) {
  return getResponseData(await apiClient.post(`/my-plans/${enrollmentId}/schedule`, payload));
}

export async function replaceMyPlanSchedule(enrollmentId, payload) {
  return getResponseData(await apiClient.put(`/my-plans/${enrollmentId}/schedule`, payload));
}

export async function cancelMyPlanEnrollment(enrollmentId) {
  return getResponseData(await apiClient.post(`/my-plans/${enrollmentId}/cancel`));
}
