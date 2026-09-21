import { AxiosHeaders } from 'axios';

import { apiClient, setAccessTokenProvider } from './client';

// RN-SPEC-plans §6.1 transport; RN-SPEC-time §1.1 (the Date header is never read).

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

test('X-Timezone is omitted when the device zone is unavailable (web parity)', async () => {
  const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({}) }));
  const config = await runRequestInterceptors({ headers: new AxiosHeaders() });
  expect(config.headers.has('X-Timezone')).toBe(false);
  spy.mockRestore();
});

test('no response interceptors: errors pass through and the Date header is never read', () => {
  expect(apiClient.interceptors.response.handlers.filter(Boolean)).toHaveLength(0);
});
