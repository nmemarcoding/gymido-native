import { create } from 'zustand';

export const AuthStatus = Object.freeze({
  restoring: 'restoring',
  signedOut: 'signedOut',
  authenticating: 'authenticating',
  loadingUser: 'loadingUser',
  signedIn: 'signedIn',
  signInFailed: 'signInFailed',
  accountUnavailable: 'accountUnavailable',
});

export const initialSessionState = Object.freeze({
  user: null,
  claims: null,
  profileMissing: false,
  meErrored: false,
  // Mirrors the stored gymido-mode preference, which loads asynchronously.
  workspace: 'member',
});

// In memory only. Roles come from the current token's claims and are never
// persisted, so a token refresh is the only way role changes propagate.
export const useAuthStore = create(() => ({
  status: AuthStatus.restoring,
  ...initialSessionState,
  signInError: null,
  lastAttempt: 'login',
  pendingDestination: null,
}));
