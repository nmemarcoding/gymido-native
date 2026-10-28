import { routes } from '../../../navigation/routes';
import { getTrainerPlan, probeIsOwnPlan } from './api/plansApi';
import { canCopyTrainerPlan, createTrainerPlanMutations, getTrainerPlanCapabilities } from './trainerPlanBuilder';

// C6: the plan screen is one screen driven by an adapter (loaders,
// ownership, capabilities, mutations, text, links). This is the trainer's;
// the member's comes with RN-SPEC-MEMBER-PLANS §M3.
export const TRAINER_PLAN_TEXT = Object.freeze({
  eyebrowOwn: 'Builder',
  eyebrowCatalog: 'Plan',
  descriptionOwnEdit: 'Build and edit days, exercises and sets. Changes apply from each client’s next workout.',
  descriptionOwnAddOnly: 'Add days, exercises and sets. Content can be added but not edited or removed.',
  descriptionCatalog:
    'A plan from the public catalog. You can assign it to a client, but only plans you created can be changed.',
  notFoundMessage: 'This plan isn’t yours, and isn’t public.',
  notYoursCopy: 'You can only add content to plans you created. This one is from the public catalog.',
  // v2 (phase6 O): the back pill draws a chevron icon, so the label is the words.
  backLabel: 'All plans',
  inactiveBannerBody: 'Clients on it can’t start its workouts until you activate it again.',
  deactivateDescription:
    'Clients on it can’t start its workouts while it’s inactive. Their history stays, and you can activate it again at any time.',
  refusedDeleteDescription:
    'It has clients on it or workout history. You can deactivate it instead: clients on it can’t start its workouts while it’s inactive, and their history stays. You can activate it again at any time.',
  editDetailsDescription: 'Changes apply from each client’s next workout.',
  planDeleteConflict: 'This plan can’t be deleted while clients are on it, or once it has workout history.',
  dayDeleteConflict: 'This day can’t be deleted while any client is on this plan, or once it has workout history.',
  copiedMessage: 'You’re now on your copy. Give it a name, then assign it.',
  // T-16 (4.0.4): a 201 with no plan id.
  copiedFallbackMessage: 'Your copy is in the plans list.',
  copyNotYoursCopy: 'This plan can’t be copied.',
});

export function createTrainerPlanAdapter(planId) {
  return {
    loadHeader: () => getTrainerPlan(planId),
    // §A5.2: own iff GET /plans/{id} answers 404.
    probeOwnership: () => probeIsOwnPlan(planId),
    getCapabilities: ({ isOwnPlan }) => ({
      ...getTrainerPlanCapabilities({ isOwnPlan }),
      copyPlan: canCopyTrainerPlan(),
    }),
    mutations: createTrainerPlanMutations(planId),
    // §B1: the trainer asks for the affected-client count.
    countsClients: true,
    text: TRAINER_PLAN_TEXT,
    // v2: the trainer boards (phase6 O) and their "Sets" display toggle.
    look: 'trainer',
    setsToggle: true,
    // T-65 (PHONE-NAV spec §3, 27 Oct 2026): "‹ All plans" goes back, else
    // replaces to this parent (it pushed a fresh T1, ⚠T3-3; T1 reloads on focus).
    backPath: '/trainer/plans',
    // ⚠B-3: a fresh T1 after a delete.
    openAfterDelete: (navigation) => navigation.push(routes.TrainerPlans),
    openCreate: (navigation) => navigation.push(routes.TrainerPlanCreate),
    // §CP2 / C9: a fresh T3 for the copy that opens Edit details once.
    openCopy: (navigation, copyId) => navigation.push(routes.TrainerPlan, { planId: copyId, nameTheCopy: true }),
    // T-16: no id in the copy response → the plans list, no name flag.
    openCopyFallback: (navigation) => navigation.push(routes.TrainerPlans),
  };
}
