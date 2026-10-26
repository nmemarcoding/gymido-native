import { apiClient, authorizationHeader } from '../../../shared/api/client';

// Pass accessToken when calling before the session is marked signed in.
export async function getProfile(accessToken) {
  const headers = accessToken ? authorizationHeader(accessToken) : undefined;
  const response = await apiClient.get('/profile', { headers });
  return response.data?.data ?? null;
}

// RN-SPEC-profile P1a (25 Oct 2026, T-32 H1): asks the server to have Auth0
// email a password reset link. The body is always `{}`.
export async function sendPasswordResetEmail() {
  const response = await apiClient.post('/profile/change-password', {});
  return response.data;
}

// Create profile (RN-SPEC-profile-create §5).
export async function createProfile(payload) {
  const response = await apiClient.post('/profile', payload);
  return response.data?.data?.profile ?? response.data?.data ?? null;
}

// Edit profile (RN-SPEC-profile P2.5, dated change 23 Oct 2026: PATCH);
// returns `data.profile`.
export async function updateProfile(payload) {
  const response = await apiClient.patch('/profile', payload);
  return response.data?.data?.profile ?? null;
}

// Delete account (RN-SPEC-profile P1b.7, T-43): no body; the 200 body is not read.
export async function deleteAccount() {
  await apiClient.delete('/profile');
}
