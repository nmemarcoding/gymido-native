import { apiClient } from '../../../shared/api/client';

// Endpoints of RN-SPEC-home §H3.

const data = (response) => response.data?.data ?? {};

export async function getDashboard() {
  return data(await apiClient.get('/dashboard'));
}

export async function logWeight(body) {
  return data(await apiClient.post('/weight-logs', body));
}
