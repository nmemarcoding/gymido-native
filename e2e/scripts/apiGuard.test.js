// Prod-safety guard for device runs (Maestro, shot tools): the app under test
// must talk to a local test API on gymido_testdb, never the production host.
const { checkApiBase, apiBaseFromConfig } = require('./apiGuard');

describe('checkApiBase (allowlist: local test APIs only)', () => {
  it.each([
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://10.0.2.2:8080',
    'http://10.0.2.2:8091',
    'http://localhost:8091/',
    'http://localhost:8080/api',
  ])('allows %s', (url) => {
    expect(checkApiBase(url)).toEqual({ ok: true, host: expect.any(String) });
  });

  it.each([
    ['https://workoutapi.nimamemarzadeh.com', /not a local test API/],
    ['https://workoutapi.nimamemarzadeh.com:8080', /not a local test API/],
    ['http://localhost.nimamemarzadeh.com:8080', /not a local test API/],
    ['http://192.168.1.20:8080', /not a local test API/],
    ['http://localhost:3000', /port 3000/],
    ['http://localhost', /port/],
    [undefined, /no API base/],
    ['', /no API base/],
    ['not a url', /unreadable/],
  ])('refuses %s', (url, reason) => {
    const result = checkApiBase(url);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(reason);
  });
});

describe('apiBaseFromConfig (the embedded app.config / a dev manifest)', () => {
  it('reads extra.apiBaseUrl from an app.config', () => {
    expect(apiBaseFromConfig(JSON.stringify({ extra: { apiBaseUrl: 'http://10.0.2.2:8080' } }))).toBe('http://10.0.2.2:8080');
  });

  it('reads extra.expoClient.extra.apiBaseUrl from a dev-server manifest', () => {
    const manifest = { extra: { expoClient: { extra: { apiBaseUrl: 'http://localhost:8080' } } } };
    expect(apiBaseFromConfig(JSON.stringify(manifest))).toBe('http://localhost:8080');
  });

  it('missing or unreadable → null (the guard then refuses)', () => {
    expect(apiBaseFromConfig('{}')).toBeNull();
    expect(apiBaseFromConfig('garbage')).toBeNull();
    expect(checkApiBase(apiBaseFromConfig('{}')).ok).toBe(false);
  });
});
