import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Values come from app.config.js `extra`, which reads .env.<APP_ENV>.
const extra = Constants.expoConfig?.extra ?? {};

// Only non-empty strings count as set. Expo's config serialization turns
// null into {}, which would otherwise look like a configured value.
function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Local test stack only: the Android emulator reaches the host's localhost as
// 10.0.2.2, so one Metro (and one localtest env) serves the iOS simulator and
// the emulator side by side. Every other env is used exactly as configured.
export function resolveApiBaseUrl(url, appEnv, os = Platform.OS) {
  if (!url || os !== 'android' || !appEnv?.startsWith('localtest')) {
    return url;
  }
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, '$110.0.2.2');
}

const appEnv = stringOrNull(extra.appEnv) ?? 'development';

export const env = Object.freeze({
  appEnv,
  apiBaseUrl: resolveApiBaseUrl(stringOrNull(extra.apiBaseUrl), appEnv),
  auth0: Object.freeze({
    domain: stringOrNull(extra.auth0?.domain),
    clientId: stringOrNull(extra.auth0?.clientId),
    audience: stringOrNull(extra.auth0?.audience),
  }),
});
