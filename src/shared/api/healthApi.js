import { apiClient } from './client';

// T-90 addendum: GET /health's data ({ version, build, … }); null without it.
export async function getServerHealth() {
  const response = await apiClient.get('/health');
  return response.data?.data ?? null;
}
