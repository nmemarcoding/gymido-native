import { apiClient } from '../../../shared/api/client';

// Endpoints of RN-SPEC-home §H3.

const data = (response) => response.data?.data ?? {};

export async function getDashboard() {
  return data(await apiClient.get('/dashboard'));
}

export async function logWeight(body) {
  return data(await apiClient.post('/weight-logs', body));
}

// U1 "Your week" (RN-SPEC-v2-phase3 §1): `week[]`, Monday first, each day
// with `weekday`, `is_workout_day`, `plan_day?` and (BE #9) `date` + `status`.
// Optional: any failure (404 = no active plan) → null, the strip is hidden.
export async function getCurrentWeek() {
  try {
    const week = data(await apiClient.get('/my-plans/current/week')).week;
    return Array.isArray(week) ? week : null;
  } catch {
    return null;
  }
}
