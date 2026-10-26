// RN-SPEC-profile P1a (T-32 H1): a password login is an `auth0|` subject, or
// no subject yet. Any other prefix (e.g. `google-oauth2|`) is Google-only.
export function hasPasswordLogin(claims) {
  const sub = claims?.sub;
  return typeof sub !== 'string' || sub.length === 0 || sub.startsWith('auth0|');
}
