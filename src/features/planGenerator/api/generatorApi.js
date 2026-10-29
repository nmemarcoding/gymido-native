import { apiClient } from '../../../shared/api/client';
import { signalReminders } from '../../reminders/reminderSignals';

// RN-SPEC-PLAN-GENERATOR §G3 (contract v2). The client adds the auth header
// and X-Timezone.

const data = (response) => response.data?.data ?? {};

// `{ available, profile, options }`
export async function getGeneratorProfile() {
  return data(await apiClient.get('/plan-generator/profile'));
}

export async function saveGeneratorProfile(body) {
  return data(await apiClient.put('/plan-generator/profile', body));
}

// No body.
export async function previewGeneratedPlan() {
  return data(await apiClient.post('/plan-generator/preview'));
}

export async function acceptGeneratedPlan(body) {
  const result = data(await apiClient.post('/plan-generator/accept', body));
  signalReminders('planChanged');
  return result;
}

export async function searchExercises(term) {
  const response = await apiClient.get('/exercises', { params: { search: term, per_page: 20 } });
  return data(response).items ?? [];
}
