import { apiClient, authorizationHeader } from '../../../shared/api/client';

// The backend creates the local user on the first call after sign-up.
export async function getMe(accessToken) {
  const response = await apiClient.get('/auth/me', { headers: authorizationHeader(accessToken) });
  return response.data?.data?.user ?? null;
}
