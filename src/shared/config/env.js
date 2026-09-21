import Constants from 'expo-constants';

// Values come from app.config.js `extra`, which reads .env.<APP_ENV>.
const extra = Constants.expoConfig?.extra ?? {};

// Only non-empty strings count as set. Expo's config serialization turns
// null into {}, which would otherwise look like a configured value.
function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const env = Object.freeze({
  appEnv: stringOrNull(extra.appEnv) ?? 'development',
  apiBaseUrl: stringOrNull(extra.apiBaseUrl),
  // IANA zone for the timestamp fallback in shared/utils/timestamps.js.
  apiServerTz: stringOrNull(extra.apiServerTz),
  auth0: Object.freeze({
    domain: stringOrNull(extra.auth0?.domain),
    clientId: stringOrNull(extra.auth0?.clientId),
    audience: stringOrNull(extra.auth0?.audience),
  }),
});
