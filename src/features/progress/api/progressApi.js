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

// N1 (RN-SPEC-v2-phase3 §1): the range's logs, oldest first, paging while
// page < total_pages (100 per page).
export async function getWeightLogsInRange({ start_date, end_date }) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = { start_date, end_date, sort: 'asc', per_page: 100, page };
    const body = data(await apiClient.get('/weight-logs', { params }));
    items.push(...(body.items ?? []));
    totalPages = Number(body.pagination?.total_pages) || 1;
    page += 1;
  } while (page <= totalPages);
  return items;
}

// #23 / U8: the past 12 weeks' missed days, planned_count and (BE) days[].
// 404 (no active plan) or any failure → null (the items hide).
export async function getMissedWeeks(weeks = 12) {
  try {
    return data(await apiClient.get('/my-plans/current/missed', { params: { weeks } }));
  } catch {
    return null;
  }
}

// U8: the 5 latest completed workouts live on /dashboard.
export async function getRecentWorkouts() {
  return (await getDashboardActivity()).recentWorkouts;
}

// One /dashboard call: U8 recent_workouts + ND-10 "Goal {n}" = the active
// plan's days per week (current_plan.enrollment.plan.days_per_week; no plan /
// junk / 0 → null). Any failure → [] / null.
export async function getDashboardActivity() {
  try {
    const dashboard = data(await apiClient.get('/dashboard'));
    const days = Number(dashboard.current_plan?.enrollment?.plan?.days_per_week);
    return { recentWorkouts: dashboard.recent_workouts ?? [], planDaysPerWeek: Number.isInteger(days) && days > 0 ? days : null };
  } catch {
    return { recentWorkouts: [], planDaysPerWeek: null };
  }
}

// ND-6: this week's training days (date + status) for the completion grid.
export async function getCurrentWeekDays() {
  try {
    const week = data(await apiClient.get('/my-plans/current/week')).week;
    return Array.isArray(week) ? week : null;
  } catch {
    return null;
  }
}

// PR1.1: five calls in parallel. The two weight calls are required (a
// failure rejects with that error, ⚠PR-1); the activity ones fall back
// silently to null / null / [].
// v2: plus the optional Phase 3 calls (missed weeks, recent workouts, this
// week), each falling back silently.
export async function loadProgress() {
  const [weightProgress, weightLogs, overview, history, frequency, missed, activity, week] = await Promise.allSettled([
    getWeightProgress(),
    getRecentWeightLogs(),
    getProgressOverview(),
    getWorkoutHistorySummary(),
    getProgressFrequency(),
    getMissedWeeks(12),
    getDashboardActivity(),
    getCurrentWeekDays(),
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
    missed: missed.status === 'fulfilled' ? missed.value : null,
    recentWorkouts: activity.status === 'fulfilled' ? activity.value.recentWorkouts : [],
    week: week.status === 'fulfilled' ? week.value : null,
    planDaysPerWeek: activity.status === 'fulfilled' ? activity.value.planDaysPerWeek : null,
  };
}
