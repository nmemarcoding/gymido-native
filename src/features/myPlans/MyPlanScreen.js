import { useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { TextLink } from '../trainer/plans/components/PlanPage';
import { SharedPlanScreen } from '../trainer/plans/screens/PlanScreen';
import OnHoldBox from './components/OnHoldBox';
import { createMemberPlanAdapter } from './memberPlanAdapter';
import { myPlanRoutes } from './myPlanRoutes';
import { useMemberStart } from './useMemberStart';

// §M3.3: no header, no retry — just the back link and the on-hold box.
function renderOnHold({ message, navigation }) {
  return (
    <>
      <TextLink
        testID="my-plan-back"
        label="← My plans"
        onPress={() => navigation.push(myPlanRoutes.MyPlans)}
        style={styles.backLink}
      />
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

const styles = StyleSheet.create({
  // Batch A: the 44 pt text-link hit area.
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
