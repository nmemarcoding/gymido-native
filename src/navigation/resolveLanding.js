import { rolesInclude } from '../features/auth/roles';
import { Workspace } from '../features/workspace/workspace';
import { routes, signedInRouteNames } from './routes';

// Where a user lands after sign-in. Rules are checked in order; the first
// match wins. Mobile has no admin portal, so admins land on Home.
export function resolveLanding({
  meErrored = false,
  pendingDestination = null,
  profileMissing = false,
  roles = [],
  workspace = Workspace.member,
}) {
  if (meErrored) {
    return { name: routes.AccountUnavailable };
  }
  if (pendingDestination && signedInRouteNames.has(pendingDestination.name)) {
    return pendingDestination;
  }
  if (profileMissing) {
    return { name: routes.Onboarding };
  }
  if (rolesInclude(roles, 'admin')) {
    return { name: routes.Home };
  }
  if (rolesInclude(roles, 'trainer') && workspace === Workspace.trainer) {
    return { name: routes.TrainerDashboard };
  }
  return { name: routes.Home };
}
