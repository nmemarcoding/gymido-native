import axios from 'axios';

import { env } from '../config/env';

if (!env.apiBaseUrl && __DEV__) {
  console.warn('[api] API_BASE_URL is not set. Check your .env.<APP_ENV> file.');
}

let accessTokenProvider = null;

// Registered by the auth feature, so this module doesn't depend on it.
export function setAccessTokenProvider(provider) {
  accessTokenProvider = provider;
}

// For calls that already hold a token (e.g. right after login, before the
// session is marked signed in).
export function authorizationHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

// The device IANA zone, read on every request. Like the web, the header is
// omitted when the zone is unavailable (the server then uses UTC).
function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Shared Axios instance for the Gymido backend.
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl ?? undefined,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const timeZone = getTimeZone();
  if (timeZone) {
    config.headers.set('X-Timezone', timeZone);
  }
  if (!config.headers.has('Authorization') && accessTokenProvider) {
    const accessToken = await accessTokenProvider();
    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }
  return config;
});

// No response interceptor: errors pass through untouched (no redirect, logout
// or retry on 401/403), and the `Date` header is never read. The web can't see
// it (CORS), so server-clock calibration stays dormant (RN-SPEC-time §1.1).
