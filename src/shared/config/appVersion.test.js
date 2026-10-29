import { appVersion, serverVersion } from './appVersion';

// T-90 (owner + UX spec + addendum): Profile shows the running app's version
// from the app config and the server's from GET /health; a missing part is
// dropped, never "undefined".
describe('appVersion', () => {
  const config = { version: '2.0.7', ios: { buildNumber: '12' }, android: { versionCode: 12 } };

  it.each(['ios', 'android'])('%s: "Version 2.0.7 (12)" / SR "App version 2.0.7, build 12"', (os) => {
    expect(appVersion(config, os)).toEqual({ text: 'Version 2.0.7 (12)', label: 'App version 2.0.7, build 12' });
  });

  it('no build number → the version alone; no version → null', () => {
    expect(appVersion({ version: '2.0.7' }, 'ios')).toEqual({ text: 'Version 2.0.7', label: 'App version 2.0.7' });
    expect(appVersion({ version: '2.0.7', android: { versionCode: '' } }, 'android').text).toBe('Version 2.0.7');
    expect(appVersion({ version: '2.0.7', ios: { buildNumber: '12' } }, 'web').text).toBe('Version 2.0.7');
    expect(appVersion({}, 'ios')).toBeNull();
    expect(appVersion(null, 'android')).toBeNull();
  });

  it('the real app.config.js gives a version and both build numbers', () => {
    const saved = { ...process.env };
    Object.assign(process.env, { AUTH0_DOMAIN: 'dummy.example.com', AUTH0_CLIENT_ID: 'dummy', AUTH0_AUDIENCE: 'dummy' });
    try {
      jest.isolateModules(() => {
        const real = require('../../../app.config.js');
        const make = typeof real === 'function' ? real : real.default;
        const resolved = typeof make === 'function' ? make({ config: {} }) : real;
        const expo = resolved.expo ?? resolved;
        expect(appVersion(expo, 'ios').text).toBe(`Version ${expo.version} (${expo.ios.buildNumber})`);
        expect(appVersion(expo, 'android').text).toBe(`Version ${expo.version} (${expo.android.versionCode})`);
        expect(appVersion(expo, 'ios').text).not.toMatch(/undefined|null/);
      });
    } finally {
      process.env = saved;
    }
  });
});

describe('serverVersion', () => {
  it('version + a 7-char build → "Server 4.1.0 (8a12bd7)" / SR "Server version 4.1.0, build 8a12bd7"', () => {
    expect(serverVersion({ version: '4.1.0', build: '8a12bd7' })).toEqual({ text: 'Server 4.1.0 (8a12bd7)', label: 'Server version 4.1.0, build 8a12bd7' });
  });

  it.each([undefined, null, '', '  ', 'dev', 'DEV'])('build %p → "Server 4.1.0" only', (build) => {
    expect(serverVersion({ version: '4.1.0', build })).toEqual({ text: 'Server 4.1.0', label: 'Server version 4.1.0' });
  });

  it.each([null, undefined, {}, { build: '8a12bd7' }, { version: '' }])('no version (%p) → null (hidden)', (health) => {
    expect(serverVersion(health)).toBeNull();
  });
});
