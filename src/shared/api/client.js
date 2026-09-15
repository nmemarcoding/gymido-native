import axios from 'axios';

import { env } from '../config/env';

if (!env.apiBaseUrl && __DEV__) {
  console.warn('[api] API_BASE_URL is not set. Check your .env.<APP_ENV> file.');
}

// Shared Axios instance for the Gymido backend. The auth token interceptor is
// added with the Login & Sign Up work.
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl ?? undefined,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});
