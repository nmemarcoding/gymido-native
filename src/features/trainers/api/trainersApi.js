import { apiClient } from '../../../shared/api/client';

// RN-SPEC-trainers §TR4. The client adds the auth header and X-Timezone.

const data = (response) => response.data?.data ?? {};

export const TRAINERS_PER_PAGE = 20;

// TR1.1: search is omitted when empty.
export async function listTrainers({ page, search }) {
  const params = { page, per_page: TRAINERS_PER_PAGE };
  if (search) {
    params.search = search;
  }
  return data(await apiClient.get('/trainers', { params }));
}

export async function getTrainer(trainerUserId) {
  return data(await apiClient.get(`/trainers/${trainerUserId}`)).trainer;
}

// No body.
export async function requestCoaching(trainerUserId) {
  return data(await apiClient.post(`/trainers/${trainerUserId}/requests`)).relationship;
}

// null = never applied (a normal state).
export async function getMyTrainerApplication() {
  return data(await apiClient.get('/my-trainer-application')).application ?? null;
}

// TR3.4: {"message": trimmed}, or {} when the trimmed message is empty.
export function applicationBody(message) {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  return trimmed ? { message: trimmed } : {};
}

export async function submitTrainerApplication(message) {
  return data(await apiClient.post('/trainer-application', applicationBody(message))).application;
}
