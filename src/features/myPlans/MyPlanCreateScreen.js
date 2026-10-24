import { useFocusRemountKey } from '../../shared/hooks/useFocusRemountKey';
import { buildCreatePlanPayload } from '../trainer/plans/planValidation';
import { CreatePlanForm } from '../trainer/plans/screens/CreatePlanScreen';
import { createMyPlan } from './api/myPlansApi';
import { memberSlug } from './myPlanFormat';
import { myPlanRoutes } from './myPlanRoutes';

// M2 (§M2): the trainer create form (T2) with the member's differences.
export const MEMBER_CREATE_VARIANT = {
  backLabel: '← My plans',
  backRoute: myPlanRoutes.MyPlans,
  subtitle: 'Private to you. Build it out, then start it.',
  namePlaceholder: 'My strength plan',
  // D1: no slug field; a fresh random-suffixed slug on every submit.
  showSlug: false,
  create: (values) => createMyPlan(buildCreatePlanPayload({ ...values, slug: memberSlug(values.name) })),
  planRoute: myPlanRoutes.MyPlan,
};

// Remounts on every focus, so Back from M3 shows an empty form.
export default function MyPlanCreateScreen() {
  const remountKey = useFocusRemountKey();
  return <CreatePlanForm key={remountKey} variant={MEMBER_CREATE_VARIANT} />;
}
