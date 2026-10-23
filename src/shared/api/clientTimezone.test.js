import { apiClient, authorizationHeader, setAccessTokenProvider } from './client';

// Every request carries the device zone (RN-SPEC-time §6): the server uses it
// for "today", and falls back to UTC silently without it.
describe('X-Timezone on every request', () => {
  const sent = [];
  const originalAdapter = apiClient.defaults.adapter;

  beforeAll(() => {
    apiClient.defaults.adapter = async (config) => {
      sent.push(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
    setAccessTokenProvider(async () => 'token-from-provider');
  });

  afterAll(() => {
    apiClient.defaults.adapter = originalAdapter;
    setAccessTokenProvider(null);
  });

  it('adds the zone with the provider token and with an explicit token', async () => {
    await apiClient.post('/trainer/clients/5/assignments', { workout_plan_id: 1 });
    await apiClient.get('/profile', { headers: authorizationHeader('explicit-token') });
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    expect(sent.map((config) => config.headers.get('X-Timezone'))).toEqual([zone, zone]);
    expect(sent.map((config) => config.headers.get('Authorization'))).toEqual([
      'Bearer token-from-provider',
      'Bearer explicit-token',
    ]);
  });
});
