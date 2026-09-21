import { AxiosHeaders } from 'axios';

import { apiClient, setAccessTokenProvider } from './client';
import { getServerOffsetMinutes, resetServerOffsetCache } from './serverClock';

// RN-SPEC-plans §6.1 transport and §7 calibration hook.

function runRequestInterceptors(config) {
  return apiClient.interceptors.request.handlers.reduce(
    (promise, handler) => promise.then(handler.fulfilled),
    Promise.resolve(config)
  );
}

test('15s timeout and JSON headers', () => {
  expect(apiClient.defaults.timeout).toBe(15000);
  expect(apiClient.defaults.headers.Accept).toBe('application/json');
  expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
});

test('every request carries X-Timezone (device IANA zone) and the bearer token', async () => {
  setAccessTokenProvider(async () => 'token-123');
  const config = await runRequestInterceptors({ headers: new AxiosHeaders() });
  expect(config.headers.get('X-Timezone')).toBe('America/Los_Angeles');
  expect(config.headers.get('Authorization')).toBe('Bearer token-123');
  setAccessTokenProvider(null);
});

test('mutation responses calibrate the server clock', () => {
  resetServerOffsetCache();
  const [handler] = apiClient.interceptors.response.handlers;
  const response = {
    config: { method: 'post' },
    headers: { date: 'Mon, 21 Sep 2026 20:00:00 GMT' },
    data: { success: true, data: { enrollment: { created_at: '2026-09-21T13:00:00Z' } } },
  };
  expect(handler.fulfilled(response)).toBe(response);
  expect(getServerOffsetMinutes()).toBe(420);
});

test('errors pass through untouched (no redirect, logout or retry)', () => {
  const [handler] = apiClient.interceptors.response.handlers;
  expect(handler.rejected).toBeFalsy();
});
