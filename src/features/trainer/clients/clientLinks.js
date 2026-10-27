import { Dimensions } from 'react-native';

import { navigationRef } from '../../../navigation/navigationRef';
import { usesRail } from '../../../shared/hooks/useLayoutClass';
import { routes } from '../../../navigation/routes';
import { ShellTab } from '../../shell/shellNavigation';

// Opens C2 for a client: switch to the Clients tab and push C2 on C1
// (trainer clients spec §C2.2). `initial: false` keeps C1 underneath.
// T-55 tablet (window ≥ 768): C1 with that client selected in the pane (the
// `selected` param, web's ?client=); `pop` returns to C1 if C2 is on top.
export function openClientDetail(clientUserId) {
  if (!navigationRef.isReady()) {
    return;
  }
  if (usesRail(Dimensions.get('window').width)) {
    navigationRef.navigate(routes.AppShell, {
      screen: ShellTab.TClients,
      params: { screen: routes.TrainerClients, params: { selected: String(clientUserId) }, pop: true },
    });
    return;
  }
  navigationRef.navigate(routes.AppShell, {
    screen: ShellTab.TClients,
    params: { screen: routes.TrainerClient, params: { clientUserId }, initial: false },
  });
}

// Opens T1 in assign mode for a client (trainer plans spec §A1 entry 3):
// switch to the Plans tab with `assignTo`; Android back returns here through
// the tab history.
export function openAssignPlan(clientUserId) {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate(routes.AppShell, {
    screen: ShellTab.TPlans,
    params: { screen: routes.TrainerPlans, params: { assignTo: String(clientUserId) } },
  });
}
