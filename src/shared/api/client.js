import axios from 'axios';

import { env } from '../config/env';
import { calibrateFromResponse } from './serverClock';

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

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
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
  config.headers.set('X-Timezone', getTimeZone());
  if (!config.headers.has('Authorization') && accessTokenProvider) {
    const accessToken = await accessTokenProvider();
    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }
  return config;
});

// Learns the server's UTC offset from mutation responses (RN-SPEC-plans §7).
// Errors pass through untouched: no redirect, logout or retry on 401/403.
apiClient.interceptors.response.use(calibrateFromResponse);
