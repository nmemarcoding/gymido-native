import { jwtDecode } from 'jwt-decode';

import { navigationRef } from '../../navigation/navigationRef';
import { isNetworkError } from '../../shared/api/apiError';
import { setAccessTokenProvider } from '../../shared/api/client';
import { env } from '../../shared/config/env';
import { getProfile } from '../profile/api/profileApi';
import { Workspace } from '../workspace/workspace';
import { setWorkspace } from '../workspace/workspacePreference';
import { getMe } from './api/authApi';
import { AUTH_SCOPE, auth0 } from './auth0Client';
import { isDeadSession, isDecline, isNoCredentials } from './authErrors';
import { AuthStatus, initialSessionState, useAuthStore } from './authStore';
import { declineLimiter } from './declineLimiter';
import { getRoles, hasRole } from './roles';

const { getState, setState } = useAuthStore;

let reauthInFlight = false;
let resumeRefreshInFlight = false;

function logAuthError(context, error) {
  if (__DEV__) {
    console.warn(`[auth] ${context}:`, error?.type ?? error?.name, error?.message);
  }
}

function authorizeParameters(attempt) {
  return {
    scope: AUTH_SCOPE,
    audience: env.auth0.audience ?? undefined,
    // Login forces Google's account chooser: logout ends the Auth0 session but
    // not the upstream Google one.
    additionalParameters: attempt === 'signup' ? { screen_hint: 'signup' } : { prompt: 'select_account' },
  };
}

async function clearStoredCredentials() {
  try {
    await auth0.credentialsManager.clearCredentials();
  } catch (error) {
    logAuthError('clearCredentials', error);
  }
}

async function handleAuthorizeError(error) {
  setState({ ...initialSessionState });
  if (isDecline(error) && declineLimiter.record() === 'silent') {
    await clearStoredCredentials();
    setState({ status: AuthStatus.signedOut });
    return;
  }
  setState({ status: AuthStatus.signInFailed, signInError: error?.message || 'Unknown error' });
}

// Fetches /auth/me and the profile gate, then marks the session signed in.
async function loadUser(credentials, claims) {
  setState({ status: AuthStatus.loadingUser, claims });
  const roles = getRoles(claims);

  let user;
  try {
    const meUser = await getMe(credentials.accessToken);
    user = { ...meUser, roles };
  } catch (error) {
    if (!isNetworkError(error)) {
      setState({ status: AuthStatus.accountUnavailable, user: null, meErrored: true });
      return;
    }
    // Offline or timed out: open the app with the token-derived user and let
    // screens show their own load errors.
    user = { email: claims.email, roles };
  }

  let profileMissing = false;
  try {
    await getProfile(credentials.accessToken);
  } catch (error) {
    profileMissing = error?.response?.status === 404;
    if (!profileMissing) {
      logAuthError('profile', error);
    }
  }

  setState({ status: AuthStatus.signedIn, user, profileMissing, meErrored: false });
}

async function authenticate(attempt) {
  if (getState().status === AuthStatus.authenticating) {
    return;
  }
  setState({ status: AuthStatus.authenticating, lastAttempt: attempt, signInError: null });

  let credentials;
  let claims;
  try {
    credentials = await auth0.webAuth.authorize(authorizeParameters(attempt));
    await auth0.credentialsManager.saveCredentials(credentials);
    claims = jwtDecode(credentials.idToken);
  } catch (error) {
    logAuthError('authorize', error);
    await handleAuthorizeError(error);
    return;
  }

  // Interactive logins only: trainers start in the trainer workspace.
  if (hasRole(claims, 'trainer')) {
    setWorkspace(Workspace.trainer);
  }
  await loadUser(credentials, claims);
}

// Mid-session only: one guarded trip to Auth0 login that brings the user back
// to the screen they were on. The workspace preference is left untouched.
async function reauthenticate() {
  if (reauthInFlight) {
    return;
  }
  reauthInFlight = true;
  try {
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
    if (route) {
      setState({ pendingDestination: { name: route.name, params: route.params } });
    }
    await authenticate('login');
  } finally {
    reauthInFlight = false;
  }
}

async function getAccessToken() {
  if (getState().status !== AuthStatus.signedIn) {
    return null;
  }
  try {
    const credentials = await auth0.credentialsManager.getCredentials();
    return credentials.accessToken;
  } catch (error) {
    logAuthError('getAccessToken', error);
    if (isDeadSession(error) || isNoCredentials(error)) {
      reauthenticate();
    }
    throw error;
  }
}

setAccessTokenProvider(getAccessToken);

export function login() {
  return authenticate('login');
}

export function signup() {
  return authenticate('signup');
}

export function retryLastAttempt() {
  return authenticate(getState().lastAttempt);
}

// Cold start. Never opens Auth0 on its own: without a usable session the user
// lands on Welcome.
export async function restoreSession() {
  setState({ status: AuthStatus.restoring });

  let credentials;
  let claims;
  try {
    credentials = await auth0.credentialsManager.getCredentials();
    claims = jwtDecode(credentials.idToken);
  } catch (error) {
    if (!isNoCredentials(error)) {
      logAuthError('restoreSession', error);
    }
    // Dead sessions are cleared; transient failures keep the stored
    // credentials for the next launch.
    if (isDeadSession(error)) {
      await clearStoredCredentials();
    }
    setState({ ...initialSessionState, status: AuthStatus.signedOut });
    return;
  }

  await loadUser(credentials, claims);
}

// Forces a refresh when the app returns to the foreground so role changes
// propagate. Offline failures keep the current session.
export async function refreshOnResume() {
  if (resumeRefreshInFlight || getState().status !== AuthStatus.signedIn) {
    return;
  }
  resumeRefreshInFlight = true;
  try {
    const credentials = await auth0.credentialsManager.getCredentials(undefined, 0, {}, true);
    const claims = jwtDecode(credentials.idToken);
    const { status, user } = getState();
    if (status === AuthStatus.signedIn) {
      setState({ claims, user: user ? { ...user, roles: getRoles(claims) } : user });
    }
  } catch (error) {
    logAuthError('refreshOnResume', error);
    if (isDeadSession(error) || isNoCredentials(error)) {
      reauthenticate();
    }
  } finally {
    resumeRefreshInFlight = false;
  }
}

export async function logout() {
  await clearStoredCredentials();
  setState({ ...initialSessionState, status: AuthStatus.signedOut, signInError: null, pendingDestination: null });
  try {
    await auth0.webAuth.clearSession();
  } catch (error) {
    // The user can dismiss the iOS sign-out prompt; the local sign-out already happened.
    logAuthError('clearSession', error);
  }
}
