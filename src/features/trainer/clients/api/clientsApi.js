import { apiClient } from '../../../../shared/api/client';

// Endpoints of RN-SPEC-TRAINER-CLIENTS §C6.

const data = (response) => response.data?.data ?? {};

export async function listActiveClients() {
  return data(await apiClient.get('/trainer/clients')).items ?? [];
}

export async function listPendingRequests() {
  return data(await apiClient.get('/trainer/requests', { params: { status: 'pending' } })).items ?? [];
}

export async function acceptRequest(relationshipId) {
  return data(await apiClient.post(`/trainer/requests/${relationshipId}/accept`)).relationship ?? null;
}

export async function rejectRequest(relationshipId) {
  return data(await apiClient.post(`/trainer/requests/${relationshipId}/reject`)).relationship ?? null;
}

// The query param is `q`, not `search`.
export async function searchMembers(q) {
  return data(await apiClient.get('/trainer/users/search', { params: { q, page: 1, per_page: 20 } })).items ?? [];
}

export async function inviteClient(clientUserId) {
  return data(await apiClient.post('/trainer/clients/requests', { client_user_id: clientUserId })).relationship ?? null;
}

export async function endCoaching(clientUserId) {
  return data(await apiClient.delete(`/trainer/clients/${clientUserId}`)).relationship ?? null;
}

export async function getClientPlan(clientUserId) {
  return data(await apiClient.get(`/trainer/clients/${clientUserId}/plan`)).plan ?? null;
}

export async function getClientProfile(clientUserId) {
  return data(await apiClient.get(`/trainer/clients/${clientUserId}/profile`)).profile ?? null;
}

// RN-SPEC-v2-phase6 §2 Email (approved 27 Oct): the same request as
// getClientProfile, keeping `client_email` (sent only for an ACTIVE client).
// T-52: folded in from clientDetailApi.js.
export async function getClientProfileAndEmail(clientUserId) {
  const response = await apiClient.get(`/trainer/clients/${clientUserId}/profile`);
  const body = response.data?.data ?? {};
  const email = typeof body.client_email === 'string' ? body.client_email.trim() : '';
  return { profile: body.profile ?? null, clientEmail: email || null };
}

export async function getClientProgress(clientUserId) {
  const body = data(await apiClient.get(`/trainer/clients/${clientUserId}/progress`));
  return { summary: body.summary ?? null, stats: body.stats ?? null };
}

export async function getClientWorkoutHistory(clientUserId) {
  const body = data(
    await apiClient.get(`/trainer/clients/${clientUserId}/workout-history`, { params: { page: 1, per_page: 10 } })
  );
  return body.history ?? { items: [] };
}

export async function listClientAssignments(clientUserId) {
  return data(await apiClient.get(`/trainer/clients/${clientUserId}/assignments`)).items ?? [];
}

export async function getClientWorkout(clientUserId, workoutId) {
  const body = data(await apiClient.get(`/trainer/clients/${clientUserId}/workouts/${workoutId}`));
  return { workout: body.workout ?? null, exercises: body.exercises ?? [] };
}

export async function listClientWeightLogs(clientUserId) {
  return data(await apiClient.get(`/trainer/clients/${clientUserId}/weight-logs`)).items ?? [];
}

// Plan assignment (RN-SPEC-TRAINER-PLANS §A4.4): `replace` only when true.
export async function assignPlan(clientUserId, workoutPlanId, replace) {
  const body = { workout_plan_id: workoutPlanId };
  if (replace) {
    body.replace = true;
  }
  return data(await apiClient.post(`/trainer/clients/${clientUserId}/assignments`, body)).assignment ?? null;
}
