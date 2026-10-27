import { navigationRef } from '../../../navigation/navigationRef';
import { routes } from '../../../navigation/routes';
import { ShellTab } from '../../shell/shellNavigation';

// Opens C2 for a client: switch to the Clients tab and push C2 on C1
// (trainer clients spec §C2.2). `initial: false` keeps C1 underneath.
// v2 phase 6: the list row's `client_activity` (BE, when sent) rides along so
// the detail page can show "Missed n this week" / "On track" and the weekday
// chips; the detail endpoints don't carry it. Absent → those stay hidden.
export function openClientDetail(clientUserId, clientActivity) {
  if (!navigationRef.isReady()) {
    return;
  }
  const params = clientActivity ? { clientUserId, clientActivity } : { clientUserId };
  navigationRef.navigate(routes.AppShell, {
    screen: ShellTab.TClients,
    params: { screen: routes.TrainerClient, params, initial: false },
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
