import { useRoute } from '@react-navigation/native';
import { useMemo } from 'react';

import { BackLink } from '../trainer/plans/components/builderParts';
import { SharedPlanScreen } from '../trainer/plans/screens/PlanScreen';
import OnHoldBox from './components/OnHoldBox';
import { createMemberPlanAdapter } from './memberPlanAdapter';
import { useMemberStart } from './useMemberStart';

// §M3.3: no header, no retry — just the back link and the on-hold box.
function renderOnHold({ message, goBack }) {
  return (
    <>
      {/* v2: the builder's back link; T-65: the kit pill "‹ My plans", back else replace to /plans/mine. */}
      <BackLink testID="my-plan-back" label="My plans" onPress={goBack} />
      <OnHoldBox message={message} />
    </>
  );
}

const MEMBER_UI = { renderOnHold, useExtension: useMemberStart };

// M3 (RN-SPEC-MEMBER-PLANS §M3), path /plans/mine/:planId. The trainer's T3
// screen driven by the member adapter (C6). Params: `planId`, and the
// one-time `nameTheCopy` flag set by "Copy to my plans" (§M5, C9).
export default function MyPlanScreen() {
  const { planId } = useRoute().params ?? {};
  const adapter = useMemo(() => createMemberPlanAdapter(planId, MEMBER_UI), [planId]);
  return <SharedPlanScreen planId={planId} adapter={adapter} />;
}
