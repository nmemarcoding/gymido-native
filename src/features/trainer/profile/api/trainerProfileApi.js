import { apiClient } from '../../../../shared/api/client';

// RN-SPEC-trainer-profile TP2: PUT /trainer/profile, a full replacement that
// creates the trainer_profiles row. The response's `profile` is unused.
// ⚠TP-1: there is no GET for the trainer's own profile.
export async function updateTrainerProfile(payload) {
  const response = await apiClient.put('/trainer/profile', payload);
  return response.data;
}
