import { routes, signedInRouteNames } from './routes';

// Where a user lands after sign-in. Rules are checked in order; the first
// match wins. Everyone with a profile lands on Home ("/"), whose Landing rule
// (RN-SPEC-app-shell §3.3) sends a trainer in Trainer mode on to /trainer.
// [O1] no admin branch: admins get whatever their other claims give them.
export function resolveLanding({ meErrored = false, pendingDestination = null, profileMissing = false }) {
  if (meErrored) {
    return { name: routes.AccountUnavailable };
  }
  if (pendingDestination && signedInRouteNames.has(pendingDestination.name)) {
    return pendingDestination;
  }
  if (profileMissing) {
    return { name: routes.Onboarding };
  }
  return { name: routes.Home };
}
