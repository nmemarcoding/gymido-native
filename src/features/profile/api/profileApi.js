import { apiClient, authorizationHeader } from '../../../shared/api/client';

// Pass accessToken when calling before the session is marked signed in.
export async function getProfile(accessToken) {
  const headers = accessToken ? authorizationHeader(accessToken) : undefined;
  const response = await apiClient.get('/profile', { headers });
  return response.data?.data ?? null;
}

export async function changePassword(password) {
  const response = await apiClient.post('/profile/change-password', { password });
  return response.data;
}

// RN-SPEC-profile-create §5.1: POST /profile → data.profile.
export async function createProfile(payload) {
  const response = await apiClient.post('/profile', payload);
  return response.data?.data ?? null;
}
