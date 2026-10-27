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

// Review f97f2ba M1: on a dev client the runtime API comes from METRO's
// manifest, not the embedded app.config, so the Metro check is the default
// (:8081) and a dev client can never skip it.
const { main, installedConfig, deviceKind } = require('./apiGuard');

const LOCAL = JSON.stringify({ extra: { apiBaseUrl: 'http://10.0.2.2:8080' } });
const PROD = JSON.stringify({ extra: { apiBaseUrl: 'https://workoutapi.nimamemarzadeh.com' } });
const MANIFEST = (url) => JSON.stringify({ extra: { expoClient: { extra: { apiBaseUrl: url } } } });
const UDID = '9953C354-61F2-4C92-A615-3797BA67FA61';

function deps({ config = LOCAL, embedded = false, manifest = MANIFEST('http://10.0.2.2:8080') } = {}) {
  const calls = { metro: [] };
  return {
    calls,
    readInstalled: () => ({ config, embedded }),
    metroManifest: (port, platform) => {
      calls.metro.push([port, platform]);
      if (manifest instanceof Error) {
        throw manifest;
      }
      return manifest;
    },
    log: () => {},
    error: () => {},
  };
}

describe('deviceKind', () => {
  it('emulators and simulator UDIDs only; physical serials are unsupported', () => {
    expect(deviceKind('emulator-5554')).toBe('android');
    expect(deviceKind(UDID)).toBe('ios');
    expect(deviceKind('R58M12ABCDE')).toBe('unsupported');
    expect(deviceKind('00008110-001A2B3C4D5E801E')).toBe('unsupported');
  });
});

describe('main()', () => {
  it('dev client: checks Metro on :8081 by default', () => {
    const d = deps();
    expect(main(['emulator-5554'], d)).toBe(0);
    expect(d.calls.metro).toEqual([['8081', 'android']]);
  });

  it('dev client with --no-metro: REFUSED (the embedded config is not what it runs)', () => {
    const d = deps();
    expect(main(['emulator-5554', '--no-metro'], d)).toBe(3);
    expect(d.calls.metro).toEqual([]);
  });

  it('dev client whose Metro serves a prod API: REFUSED, even with a local embedded config', () => {
    expect(main([UDID], deps({ manifest: MANIFEST('https://workoutapi.nimamemarzadeh.com') }))).toBe(3);
  });

  it('dev client with Metro down or unreadable: REFUSED', () => {
    expect(main(['emulator-5554'], deps({ manifest: new Error('connection refused') }))).toBe(3);
    expect(main(['emulator-5554'], deps({ manifest: '' }))).toBe(3);
  });

  it('--metro <port> checks that port', () => {
    const d = deps();
    expect(main([UDID, '--metro', '8097'], d)).toBe(0);
    expect(d.calls.metro).toEqual([['8097', 'ios']]);
  });

  it('Release (embedded bundle): the embedded config is the runtime API; Metro is not needed', () => {
    const d = deps({ embedded: true, manifest: new Error('no Metro') });
    expect(main(['emulator-5554'], d)).toBe(0);
    expect(main(['emulator-5554', '--no-metro'], d)).toBe(0);
    expect(d.calls.metro).toEqual([]);
  });

  it('a prod embedded config is REFUSED for Release and dev client alike', () => {
    expect(main(['emulator-5554'], deps({ config: PROD, embedded: true }))).toBe(3);
    expect(main(['emulator-5554'], deps({ config: PROD }))).toBe(3);
  });

  it('unknown build kind (embedded null) is treated as a dev client', () => {
    const d = deps({ embedded: null });
    expect(main(['emulator-5554', '--no-metro'], d)).toBe(3);
  });

  it('physical device serials: REFUSED with a clear reason (simulators/emulators only)', () => {
    const messages = [];
    const d = { ...deps(), error: (m) => messages.push(m) };
    expect(main(['R58M12ABCDE'], d)).toBe(3);
    expect(messages.join(' ')).toMatch(/physical device/i);
  });

  it('no app installed: REFUSED', () => {
    expect(main(['emulator-5554'], { ...deps(), readInstalled: () => ({ config: null, embedded: null }) })).toBe(3);
  });

  it('usage errors exit 2', () => {
    expect(main([], deps())).toBe(2);
    expect(main(['emulator-5554', '--metro'], deps())).toBe(2);
    expect(main(['emulator-5554', '--metro', 'x'], deps())).toBe(2);
    expect(main(['emulator-5554', '--bogus'], deps())).toBe(2);
  });
});

describe('installedConfig (command runner injected)', () => {
  it('Android: pulls the APK, reads assets/app.config and spots the embedded bundle', () => {
    const run = jest.fn((cmd, args) => {
      if (cmd === 'adb' && args.includes('path')) return 'package:/data/app/x/base.apk\n';
      if (cmd === 'adb') return '';
      if (cmd === 'unzip' && args[0] === '-p') return LOCAL;
      if (cmd === 'unzip' && args[0] === '-l') return '  4117468  01-01-1981 01:01   assets/index.android.bundle\n';
      throw new Error(`unexpected ${cmd}`);
    });
    expect(installedConfig('emulator-5554', { run })).toEqual({ config: LOCAL, embedded: true });
  });

  it('Android dev client: no bundle in the APK → embedded false', () => {
    const run = jest.fn((cmd, args) => {
      if (cmd === 'adb' && args.includes('path')) return 'package:/data/app/x/base.apk\n';
      if (cmd === 'unzip' && args[0] === '-p') return LOCAL;
      if (cmd === 'unzip' && args[0] === '-l') return '  100  assets/app.config\n';
      return '';
    });
    expect(installedConfig('emulator-5554', { run })).toEqual({ config: LOCAL, embedded: false });
  });

  it('Android without the app: config null', () => {
    const run = jest.fn(() => '');
    expect(installedConfig('emulator-5554', { run })).toEqual({ config: null, embedded: null });
  });

  it('iOS: reads EXConstants.bundle/app.config and checks for main.jsbundle', () => {
    const run = jest.fn(() => '/apps/Gymido.app\n');
    const files = { '/apps/Gymido.app/EXConstants.bundle/app.config': LOCAL };
    const fsLike = {
      readFileSync: (p) => {
        if (!(p in files)) throw new Error('ENOENT');
        return files[p];
      },
      existsSync: (p) => p === '/apps/Gymido.app/main.jsbundle',
    };
    expect(installedConfig(UDID, { run, fs: fsLike })).toEqual({ config: LOCAL, embedded: true });
    expect(installedConfig(UDID, { run, fs: { ...fsLike, existsSync: () => false } })).toEqual({ config: LOCAL, embedded: false });
  });
});
