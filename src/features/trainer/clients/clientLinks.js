import { Dimensions } from 'react-native';

import { navigationRef } from '../../../navigation/navigationRef';
import { usesRail } from '../../../shared/hooks/useLayoutClass';
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

// T-55 + RN-SPEC-TRAINER-CLIENTS dated change 27 Oct (07c6d708): back to a
// client after leaving its tablet pane (Plans "← Back to client #N"). Tablet
// window (≥ 768): the Clients master/detail with that client selected (the
// `client` param, web's ?client=); `pop` returns to C1 if C2 is on top.
// Phone: the C2 push, as openClientDetail.
export function openClientSelection(clientUserId) {
  if (!navigationRef.isReady()) {
    return;
  }
  if (!usesRail(Dimensions.get('window').width)) {
    openClientDetail(clientUserId);
    return;
  }
  navigationRef.navigate(routes.AppShell, {
    screen: ShellTab.TClients,
    params: { screen: routes.TrainerClients, params: { client: String(clientUserId) }, pop: true },
  });
}

// Opens T1 in assign mode for a client (trainer plans spec §A1 entry 3):
// switch to the Plans tab with `assignTo`; Android back returns here through
// the tab history. T-121 M10: the shown client name rides along
// (`assignName`) so T1 says "Pick a plan to assign to {name}."; without it,
// T1 falls back to "client #id".
export function openAssignPlan(clientUserId, clientName) {
  if (!navigationRef.isReady()) {
    return;
  }
  const params = { assignTo: String(clientUserId) };
  if (typeof clientName === 'string' && clientName.trim()) {
    params.assignName = clientName.trim();
  }
  navigationRef.navigate(routes.AppShell, {
    screen: ShellTab.TPlans,
    params: { screen: routes.TrainerPlans, params },
  });
}
