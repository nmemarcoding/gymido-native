import { createPlanWrites } from '../trainer/plans/api/plansApi';
import { getTrainerPlanCapabilities } from '../trainer/plans/trainerPlanBuilder';
import { getMyPlan } from './api/myPlansApi';
import { myPlanRoutes } from './myPlanRoutes';

// RN-SPEC-MEMBER-PLANS §M3: the member's adapter for the shared plan screen.
export const MEMBER_PLAN_TEXT = Object.freeze({
  eyebrowOwn: 'My plan',
  eyebrowCatalog: 'Plan',
  descriptionOwnEdit: 'Build and edit days, exercises and sets. Changes apply from your next workout.',
  descriptionOwnAddOnly: 'Add days, exercises and sets. Content can be added but not edited or removed.',
  descriptionCatalog: '',
  notFoundMessage: 'This plan isn’t one of yours.',
  notYoursCopy: 'This plan is no longer available.',
  backLabel: '← My plans',
  inactiveBannerBody: 'You can’t start its workouts until you activate it again.',
  deactivateDescription:
    'You can’t start its workouts while it’s inactive. Its history stays, and you can activate it again at any time.',
  refusedDeleteDescription:
    'You’re on it or it has workout history. You can deactivate it instead: its workouts can’t be started while it’s inactive, and its history stays. You can activate it again at any time.',
  editDetailsDescription: 'Changes apply from your next workout.',
  planDeleteConflict: 'This plan can’t be deleted while you’re on it, or once it has workout history.',
  dayDeleteConflict: 'This day can’t be deleted while you’re on this plan, or once it has workout history.',
});

// `ui` brings the member's screen pieces (MyPlanScreen): `renderOnHold`
// (§M3.3, a 403 on load) and `useExtension` ("Start this plan", §M3.4).
// Kept apart so the adapter's data rules stay testable without UI.
export function createMemberPlanAdapter(planId, ui = {}) {
  return {
    loadHeader: () => getMyPlan(planId),
    // Always own: this route answers only for the owner; no /plans/{id} probe.
    probeOwnership: () => Promise.resolve(true),
    // Every T3 key true, plus copyPlan false and enrol true.
    getCapabilities: () => ({ ...getTrainerPlanCapabilities({ isOwnPlan: true }), copyPlan: false, enrol: true }),
    mutations: createPlanWrites(`/my-custom-plans/${planId}`),
    // No affected-clients call for members: every count UI stays hidden.
    countsClients: false,
    text: MEMBER_PLAN_TEXT,
    // Batch A: "← My plans" gets the 44 pt hit area.
    backLinkHitArea: true,
    openBack: (navigation) => navigation.push(myPlanRoutes.MyPlans),
    openAfterDelete: (navigation) => navigation.push(myPlanRoutes.MyPlans),
    openCreate: (navigation) => navigation.push(myPlanRoutes.MyPlanCreate),
    renderOnHold: ui.renderOnHold,
    useExtension: ui.useExtension,
  };
}
