// Error `type` values from react-native-auth0 (WebAuthErrorCodes and
// CredentialsManagerErrorCodes). Kept as literals so this module has no native
// imports and stays unit-testable.
const DECLINE_TYPES = new Set(['USER_CANCELLED', 'ACCESS_DENIED']);
const DEAD_SESSION_TYPES = new Set(['NO_REFRESH_TOKEN', 'SESSION_EXPIRED', 'INVALID_CREDENTIALS']);
const DEAD_OAUTH_CODES = ['invalid_grant', 'login_required', 'consent_required', 'missing_refresh_token'];
const NETWORK_PATTERN = /network|offline|internet|timed out|timeout|connection|unreachable/i;

function errorDetails(error) {
  const parts = [error?.message, error?.code, error?.cause?.message];
  if (error?.json) {
    try {
      parts.push(JSON.stringify(error.json));
    } catch {
      // Unserializable details are ignored.
    }
  }
  return parts.filter((part) => typeof part === 'string').join(' ');
}

// RENEW_FAILED covers both a rejected refresh token and a request that never
// reached Auth0, so the error details decide which one it was.
function renewFailedByNetwork(error) {
  const details = errorDetails(error);
  if (DEAD_OAUTH_CODES.some((code) => details.includes(code))) {
    return false;
  }
  return NETWORK_PATTERN.test(details);
}

// The user closed the browser or declined consent.
export function isDecline(error) {
  return DECLINE_TYPES.has(error?.type);
}

export function isNoCredentials(error) {
  return error?.type === 'NO_CREDENTIALS';
}

// Offline or unreachable: keep the session and try again later.
export function isTransientCredentialsError(error) {
  if (error?.type === 'NO_NETWORK') {
    return true;
  }
  return error?.type === 'RENEW_FAILED' && renewFailedByNetwork(error);
}

// The refresh token can no longer be used; the user must sign in again.
export function isDeadSession(error) {
  if (DEAD_SESSION_TYPES.has(error?.type)) {
    return true;
  }
  return error?.type === 'RENEW_FAILED' && !renewFailedByNetwork(error);
}
