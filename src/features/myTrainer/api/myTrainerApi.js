import { getStatus } from '../../../shared/api/apiError';
import { apiClient } from '../../../shared/api/client';

// Reads of RN-SPEC-my-trainer (MT1.1), shared with Profile's Coaching card.

const data = (response) => response.data?.data ?? {};

// A 404 means "no relationship", not an error.
export async function getMyTrainer() {
  try {
    const body = data(await apiClient.get('/my-trainer'));
    return { relationship: body.relationship ?? null, trainer: body.trainer ?? null };
  } catch (error) {
    if (getStatus(error) === 404) {
      return { relationship: null, trainer: null };
    }
    throw error;
  }
}

export async function listPendingTrainerRequests() {
  const items = data(await apiClient.get('/my-trainer/requests', { params: { status: 'pending' } })).items;
  return Array.isArray(items) ? items : [];
}

export async function acceptTrainerRequest(requestId) {
  return data(await apiClient.post(`/my-trainer/requests/${requestId}/accept`));
}

export async function rejectTrainerRequest(requestId) {
  return data(await apiClient.post(`/my-trainer/requests/${requestId}/reject`));
}

export async function endCoaching() {
  return data(await apiClient.delete('/my-trainer'));
}
