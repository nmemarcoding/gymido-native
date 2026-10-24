import { navigationRef } from '../../../navigation/navigationRef';
import { routes } from '../../../navigation/routes';
import { ShellTab } from '../../shell/shellNavigation';

// Opens C2 for a client: switch to the Clients tab and push C2 on C1
// (trainer clients spec §C2.2). `initial: false` keeps C1 underneath.
export function openClientDetail(clientUserId) {
  if (!navigationRef.isReady()) {
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
