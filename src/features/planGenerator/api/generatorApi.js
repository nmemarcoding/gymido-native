import { apiClient } from '../../../shared/api/client';
import { GENERATOR_MOCK, applyGeneratorMock } from '../devMock';

// RN-SPEC-PLAN-GENERATOR §G3 (contract v2). The client adds the auth header
// and X-Timezone.

const data = (response) => response.data?.data ?? {};

// `{ available, profile, options }`. G1 passes `{ screen: true }`; it only
// matters to the DEV-only stub (devMock.js 'off'), never in a release build.
export async function getGeneratorProfile({ screen = false } = {}) {
  if (GENERATOR_MOCK === 'off' && screen) {
    return applyGeneratorMock(GENERATOR_MOCK, 'screenProfile', null);
  }
  return data(await apiClient.get('/plan-generator/profile'));
}

export async function saveGeneratorProfile(body) {
  return data(await apiClient.put('/plan-generator/profile', body));
}

// No body.
export async function previewGeneratedPlan() {
  const preview = data(await apiClient.post('/plan-generator/preview'));
  return GENERATOR_MOCK ? applyGeneratorMock(GENERATOR_MOCK, 'preview', preview) : preview;
}

export async function acceptGeneratedPlan(body) {
  return data(await apiClient.post('/plan-generator/accept', body));
}

export async function searchExercises(term) {
  const response = await apiClient.get('/exercises', { params: { search: term, per_page: 20 } });
  return data(response).items ?? [];
}
