import { getStatus } from '../../shared/api/apiError';
import { getCurrentPlan, listPlanDays } from '../plans/api/libraryApi';
import { getCurrentWorkout, getTodayStatus, listCompletedWorkouts, listExerciseStats } from './api/workoutApi';
import { buildExerciseStatsMap, completedDayIds, currentWeekRange } from './workoutFormat';
import { reconcileSessionState } from './runtime/workoutSessionStore';

const DEFAULT_API = { getCurrentWorkout, getCurrentPlan, getTodayStatus, listExerciseStats, listCompletedWorkouts, listPlanDays };

const nullOn404 = (promise) =>
  promise.catch((error) => {
    if (getStatus(error) === 404) {
      return null;
    }
    throw error;
  });

const nullOnAny = (promise) => promise.catch(() => null);

// RN-SPEC-workout §6.1: five calls in parallel with their own failure rules,
// then the plan's days when there is a plan. Never throws: it reports its
// outcome (O12 §3a) so a caller can tell a failed reload from a good one.
export async function loadWorkoutPage({ api = DEFAULT_API, now = new Date() } = {}) {
  try {
    const [session, currentPlan, todayStatus, stats, completed] = await Promise.all([
      api.getCurrentWorkout(),
      nullOn404(api.getCurrentPlan()),
      nullOn404(api.getTodayStatus()),
      nullOnAny(api.listExerciseStats()),
      nullOnAny(api.listCompletedWorkouts(currentWeekRange(now))),
    ]);
    // T-59: a session that ended elsewhere drops its stored rest + alert.
    reconcileSessionState(session?.id ?? null);
    const planId = currentPlan?.enrollment?.plan?.id;
    const planDays = planId ? await api.listPlanDays(planId) : [];
    return {
      ok: true,
      data: {
        session,
        currentPlan,
        todayStatus,
        planDays,
        completedThisWeekDayIds: completedDayIds(completed),
        exerciseStatsMap: buildExerciseStatsMap(stats),
      },
    };
  } catch (error) {
    return { ok: false, error };
  }
}
