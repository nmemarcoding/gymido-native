import { createPlanWrites } from '../trainer/plans/api/plansApi';
import { getTrainerPlanCapabilities, openListAfterDelete } from '../trainer/plans/trainerPlanBuilder';
import { copyToMyPlans, getMyPlan } from './api/myPlansApi';
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
  // v2 (phase4 I): the back link draws a chevron icon, so the label is the words.
  backLabel: 'My plans',
  inactiveBannerBody: 'You can’t start its workouts until you activate it again.',
  deactivateDescription:
    'You can’t start its workouts while it’s inactive. Its history stays, and you can activate it again at any time.',
  refusedDeleteDescription:
    'You’re on it or it has workout history. You can deactivate it instead: its workouts can’t be started while it’s inactive, and its history stays. You can activate it again at any time.',
  editDetailsDescription: 'Changes apply from your next workout.',
  planDeleteConflict: 'This plan can’t be deleted while you’re on it, or once it has workout history.',
  dayDeleteConflict: 'This day can’t be deleted while you’re on this plan, or once it has workout history.',
  // RN-SPEC-v2-phase4 §2 (approved 27 Oct): "Make a copy" of the member's own plan.
  // T-78 (C10): the copy is named in the dialog before it exists.
  copiedMessage: 'You’re now on your copy in My plans.',
  copiedFallbackMessage: 'Your copy is in My plans.',
  copyNotYoursCopy: 'This plan can’t be copied.',
});

// `ui` brings the member's screen pieces (MyPlanScreen): `renderOnHold`
// (§M3.3, a 403 on load) and `useExtension` ("Start this plan", §M3.4).
// Kept apart so the adapter's data rules stay testable without UI.
export function createMemberPlanAdapter(planId, ui = {}) {
  return {
    loadHeader: () => getMyPlan(planId),
    // Always own: this route answers only for the owner; no /plans/{id} probe.
    probeOwnership: () => Promise.resolve(true),
    // Every T3 key true, plus enrol true. copyPlan: true since v2 Phase 4 §2
    // (approved 27 Oct, BE confirmed): members copy their own plan through
    // the catalog copy route (POST /my-custom-plans/copies).
    getCapabilities: () => ({ ...getTrainerPlanCapabilities({ isOwnPlan: true }), copyPlan: true, enrol: true }),
    mutations: {
      ...createPlanWrites(`/my-custom-plans/${planId}`),
      copyPlan: () => copyToMyPlans(planId),
    },
    // T-78 (C10): the update/delete writes of a NEW copy (by its id).
    copyWritesFor: (copyId) => createPlanWrites(`/my-custom-plans/${copyId}`),
    // No affected-clients call for members: every count UI stays hidden.
    countsClients: false,
    text: MEMBER_PLAN_TEXT,
    // Batch A: "← My plans" gets the 44 pt hit area.
    backLinkHitArea: true,
    // T-65 (PHONE-NAV spec §3): "‹ My plans" goes back, else replaces to this parent.
    backPath: '/plans/mine',
    // T-79 / T-74 (web parity): back to My plans when it is below in the
    // stack, else back (e.g. to the Plans library), else replace with it; the
    // deleted plan leaves the history (openListAfterDelete).
    openAfterDelete: (navigation) => openListAfterDelete(navigation, myPlanRoutes.MyPlans),
    openCreate: (navigation) => navigation.push(myPlanRoutes.MyPlanCreate),
    // §M5 / C10: the copy's builder (named before it was created; no dialog
    // opens there); T-16: no id → My plans.
    openCopy: (navigation, copyId) => navigation.push(myPlanRoutes.MyPlan, { planId: copyId }),
    openCopyFallback: (navigation) => navigation.push(myPlanRoutes.MyPlans),
    look: 'member',
    renderOnHold: ui.renderOnHold,
    useExtension: ui.useExtension,
  };
}
