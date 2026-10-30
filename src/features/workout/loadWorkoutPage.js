import { getStatus } from '../../shared/api/apiError';
import { isGeneratorAvailable } from '../myPlans/api/myPlansApi';
import { getCurrentPlan, getCurrentWeek, listMyPlans, listPlanDays } from '../plans/api/libraryApi';
import { isValidWeek } from '../plans/libraryFormat';
import { getCurrentWorkout, getLastCompletedWorkout, getTodayStatus, listCompletedWorkouts, listExerciseStats } from './api/workoutApi';
import { buildExerciseStatsMap, completedDayIds, currentWeekRange } from './workoutFormat';
import { reconcileSessionState } from './runtime/workoutSessionStore';

const DEFAULT_API = {
  getCurrentWorkout,
  getCurrentPlan,
  getLastCompletedWorkout,
  listMyPlans,
  getTodayStatus,
  getCurrentWeek,
  isGeneratorAvailable,
  listExerciseStats,
  listCompletedWorkouts,
  listPlanDays,
};

const nullOn404 = (promise) =>
  promise.catch((error) => {
    if (getStatus(error) === 404) {
      return null;
    }
    throw error;
  });

const nullOnAny = (promise) => promise.catch(() => null);

// T-81: the completed list must cover the /week dates (week[0].date ..
// week[6].date). The two calls run in parallel with the device's local
// Mon–Sun, which is the same range except when they straddle a week change
// (Sunday → Monday midnight between the device clock and the server, or a
// time zone change): then the list is fetched again for the /week dates.
async function completedForWeek(api, completed, week, range) {
  if (!isValidWeek(week)) {
    return completed;
  }
  const weekRange = { startDate: week[0]?.date, endDate: week[6]?.date };
  if (typeof weekRange.startDate !== 'string' || typeof weekRange.endDate !== 'string') {
    return completed;
  }
  if (weekRange.startDate === range.startDate && weekRange.endDate === range.endDate) {
    return completed;
  }
  // T-81 reviewer carry (native-t81-c650c0a): a failed re-read keeps the
  // device-range list (as web), not null, so the strip's done-by-date and
  // the "✓ Done" ids still load.
  return api.listCompletedWorkouts(weekRange).catch(() => completed);
}

// RN-SPEC-workout §6.1: five calls in parallel with their own failure rules,
// then the plan's days when there is a plan. T-76 (28 Oct 2026): a sixth,
// GET /my-plans/current/week (null on any failure: the week card hides),
// and with no plan the generator check for "Build me a plan" (U2). Never
// throws: it reports its outcome (O12 §3a) so a caller can tell a failed
// reload from a good one.
export async function loadWorkoutPage({ api = DEFAULT_API, now = new Date() } = {}) {
  try {
    const range = currentWeekRange(now);
    const [session, currentPlan, todayStatus, stats, completedLocal, week] = await Promise.all([
      api.getCurrentWorkout(),
      nullOn404(api.getCurrentPlan()),
      nullOn404(api.getTodayStatus()),
      nullOnAny(api.listExerciseStats()),
      nullOnAny(api.listCompletedWorkouts(range)),
      nullOnAny(api.getCurrentWeek()),
    ]);
    // T-59: a session that ended elsewhere drops its stored rest + alert.
    reconcileSessionState(session?.id ?? null);
    const completed = await completedForWeek(api, completedLocal, week, range);
    const planId = currentPlan?.enrollment?.plan?.id;
    // T-140 (web review lesson 1): an open session renders the live workout,
    // so the page-only reads never delay it; otherwise they run in parallel.
    // Best-effort (a failure hides what it feeds): the newest completed
    // workout only when this week has none (Last workout; null = none ever)
    // and GET /my-plans only without an active plan (Plan finished).
    const open = Boolean(session?.id);
    const [planDays, generatorAvailable, lastCompleted, myPlans] = await Promise.all([
      planId && !open ? api.listPlanDays(planId) : [],
      planId || open ? false : api.isGeneratorAvailable().catch(() => false),
      open || completed?.length ? null : api.getLastCompletedWorkout().catch(() => null),
      planId || open ? [] : api.listMyPlans().catch(() => []),
    ]);
    return {
      ok: true,
      data: {
        session,
        currentPlan,
        todayStatus,
        planDays,
        week,
        generatorAvailable,
        completedThisWeek: completed ?? [],
        // T-140: the stats card hides when this week's list failed.
        completedThisWeekFailed: completed == null,
        lastCompleted,
        myPlans,
        completedThisWeekDayIds: completedDayIds(completed),
        exerciseStatsMap: buildExerciseStatsMap(stats),
      },
    };
  } catch (error) {
    return { ok: false, error };
  }
}
