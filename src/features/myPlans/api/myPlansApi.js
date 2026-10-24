import { apiClient } from '../../../shared/api/client';

// RN-SPEC-MEMBER-PLANS §M6. Writes on one plan go through createPlanWrites
// with the `/my-custom-plans/{id}` root.

const data = (response) => response.data?.data ?? {};

export async function listMyPlans(page) {
  const body = data(await apiClient.get('/my-custom-plans', { params: { page, per_page: 20 } }));
  const pagination = body.pagination ?? {};
  return {
    items: body.items ?? [],
    currentPage: pagination.page ?? 1,
    totalPages: pagination.total_pages ?? 1,
    totalRecords: pagination.total ?? 0,
    perPage: pagination.per_page ?? 20,
  };
}

export async function createMyPlan(payload) {
  return data(await apiClient.post('/my-custom-plans', payload)).plan ?? null;
}

export async function copyToMyPlans(planId) {
  return data(await apiClient.post('/my-custom-plans/copies', { workout_plan_id: Number(planId) })).plan ?? null;
}

export async function getMyPlan(planId) {
  return data(await apiClient.get(`/my-custom-plans/${planId}`)).plan ?? null;
}

// §M3.4: `{enrollment, schedule}`; a 404 means no current plan.
export async function getCurrentPlan() {
  return data(await apiClient.get('/my-plans/current'));
}

export async function cancelEnrollment(enrollmentId) {
  return data(await apiClient.post(`/my-plans/${enrollmentId}/cancel`));
}

export async function startPlan(planId, startedOn) {
  return data(await apiClient.post('/my-plans', { workout_plan_id: Number(planId), started_on: startedOn }))
    .enrollment ?? null;
}

// RN-SPEC-PLAN-GENERATOR G-E: the M1 "Build me a plan" button shows only on
// a 200 with `available === true`; any failure hides it (⚠G-1).
export async function isGeneratorAvailable() {
  try {
    return data(await apiClient.get('/plan-generator/profile')).available === true;
  } catch {
    return false;
  }
}
