import { apiClient } from '../../../shared/api/client';

// Endpoints of RN-SPEC-progress §PR3. The client adds auth and X-Timezone.

const data = (response) => response.data?.data ?? {};

export async function getWeightProgress() {
  return data(await apiClient.get('/weight-progress'));
}

export async function getRecentWeightLogs() {
  const params = { page: 1, per_page: 20, sort: 'desc' };
  return data(await apiClient.get('/weight-logs', { params })).items ?? [];
}

export async function getProgressOverview() {
  return data(await apiClient.get('/progress/overview'));
}

// No params: the server's own default range (⚠PR-4).
export async function getWorkoutHistorySummary() {
  return data(await apiClient.get('/history/workouts'));
}

export async function getProgressFrequency() {
  return data(await apiClient.get('/progress/frequency')).items ?? [];
}

// PR1.1: five calls in parallel. The two weight calls are required (a
// failure rejects with that error, ⚠PR-1); the activity ones fall back
// silently to null / null / [].
export async function loadProgress() {
  const [weightProgress, weightLogs, overview, history, frequency] = await Promise.allSettled([
    getWeightProgress(),
    getRecentWeightLogs(),
    getProgressOverview(),
    getWorkoutHistorySummary(),
    getProgressFrequency(),
  ]);
  if (weightProgress.status === 'rejected') {
    throw weightProgress.reason;
  }
  if (weightLogs.status === 'rejected') {
    throw weightLogs.reason;
  }
  return {
    weightProgress: weightProgress.value,
    weightLogs: weightLogs.value,
    overview: overview.status === 'fulfilled' ? overview.value : null,
    history: history.status === 'fulfilled' ? history.value : null,
    frequency: frequency.status === 'fulfilled' ? frequency.value : [],
  };
}
