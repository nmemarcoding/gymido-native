import { keepUnitsTogether } from '../../shared/format/counts';
import { isSessionOpen } from '../home/homeFormat';
import { cutWorkoutTitle } from '../reminders/reminderPlan';

// T-91 (UX T91-end-plan-ruling §1–§3 + the PM amendment of 29 Oct): every
// plan gets the self-chosen body (no wire key tells an assigned plan), so
// the "{Trainer} will see that you ended it." line is dropped.
export const END_PLAN_COPY = Object.freeze({
  menuTitle: 'Plan actions',
  menuItem: 'End plan',
  body: "You'll stop getting workouts from this plan. Your workout history and progress are kept. You can start this or another plan any time.",
  // §2 "Workout in progress": the body starts with this line.
  blocked: 'Finish or discard your workout in progress first.',
  confirm: 'End plan',
  sending: 'Ending…',
  goToWorkout: 'Go to workout',
  gone: 'This plan has already ended.',
  failed: "Couldn't end this plan",
});

// The name is cut at 32 characters + "…" (the T-103 reminder cut).
const shortName = (name) => keepUnitsTogether(cutWorkoutTitle(name)) || 'Plan';

export const planActionsLabel = (name) => `${END_PLAN_COPY.menuTitle}, ${keepUnitsTogether(name) || 'Plan'}`;

export const endPlanTitle = (name) => `End ${shortName(name)}?`;

export const endPlanBody = (blocked) => (blocked ? `${END_PLAN_COPY.blocked} ${END_PLAN_COPY.body}` : END_PLAN_COPY.body);

export const endPlanSuccess = (name) => `${shortName(name)} ended. Your history is kept.`;

// §2 "Workout in progress" (PM Q1, 29 Oct): an open session of the current
// enrollment, or one without `user_plan_enrollment_id`, blocks End plan
// (cancel never touches sessions, so "finish or discard first" stays here).
export function sessionBlocksEnd(session, enrollmentId) {
  if (!isSessionOpen(session)) {
    return false;
  }
  const owner = session.user_plan_enrollment_id;
  return owner === undefined || owner === null || Number(owner) === Number(enrollmentId);
}
