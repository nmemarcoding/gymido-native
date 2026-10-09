const path = require('path');

const {
  splitArgs,
  listFlowFiles,
  resolveFlows,
  hasEnv,
  pickSimulator,
  emulatorSerials,
  isDebuggable,
  planBuild,
} = require('../run-e2e');

const FLOWS_DIR = path.resolve(__dirname, '../../maestro');

describe('splitArgs', () => {
  test('flow selectors stop at the first option; the rest goes to maestro', () => {
    expect(splitArgs(['W1', '04', '-e', 'A=1', 'W2'])).toEqual({ selectors: ['W1', '04'], maestroArgs: ['-e', 'A=1', 'W2'] });
  });

  test('no arguments → whole suite, no maestro args', () => {
    expect(splitArgs([])).toEqual({ selectors: [], maestroArgs: [] });
  });
});

describe('listFlowFiles + resolveFlows', () => {
  const files = listFlowFiles(FLOWS_DIR);

  test('lists numbered and workout flows, never subflows or config', () => {
    const names = files.map((f) => path.relative(FLOWS_DIR, f));
    expect(names).toEqual(expect.arrayContaining(['01-welcome-no-auto-redirect.yaml', 'workout/W1-rest-paths.yaml']));
    expect(names.some((n) => n.startsWith('subflows/') || n === 'config.yaml')).toBe(false);
  });

  test.each([
    ['W1', 'workout/W1-rest-paths.yaml'],
    ['w2', 'workout/W2-sheet-and-finish.yaml'],
    ['04', '04-login-lands-signed-in.yaml'],
  ])('%s → %s', (selector, expected) => {
    expect(resolveFlows([selector], files)).toEqual([path.join(FLOWS_DIR, expected)]);
  });

  test('an existing path is passed through', () => {
    expect(resolveFlows(['e2e/maestro/x.yaml'], files, () => true)).toEqual(['e2e/maestro/x.yaml']);
  });

  test('unknown or ambiguous selectors fail with the choices', () => {
    expect(() => resolveFlows(['W9'], files)).toThrow(/No flow matches "W9"\. Flows: .*W1-rest-paths/);
    expect(() => resolveFlows(['0'], files)).toThrow(/matches several flows/);
  });
});

describe('hasEnv', () => {
  test.each([
    [['-e', 'RELEASE_BUILD=false'], true],
    [['--env', 'RELEASE_BUILD=true'], true],
    [['--env=RELEASE_BUILD=true'], true],
    [['-e', 'MEMBER_EMAIL=x'], false],
  ])('%j → %s', (args, expected) => {
    expect(hasEnv(args, 'RELEASE_BUILD')).toBe(expected);
  });
});

describe('pickSimulator', () => {
  const ios = (version) => `com.apple.CoreSimulator.SimRuntime.iOS-${version}`;
  const json = {
    devices: {
      [ios('26-5')]: [{ name: 'Gymido E2E iPhone', udid: 'OLD', state: 'Shutdown', isAvailable: true }],
      [ios('27-0')]: [
        { name: 'Gymido E2E iPhone', udid: 'NEW', state: 'Shutdown', isAvailable: true },
        { name: 'Other', udid: 'OTHER', state: 'Booted', isAvailable: true },
        { name: 'Broken', udid: 'GONE', state: 'Shutdown', isAvailable: false },
      ],
      'com.apple.CoreSimulator.SimRuntime.watchOS-12-0': [{ name: 'Gymido E2E iPhone', udid: 'WATCH', state: 'Booted' }],
    },
  };

  test('by name: newest iOS runtime, never another OS', () => {
    expect(pickSimulator(json, 'Gymido E2E iPhone').udid).toBe('NEW');
  });

  test('a booted same-named simulator wins over a newer runtime', () => {
    const booted = { devices: { ...json.devices, [ios('26-5')]: [{ ...json.devices[ios('26-5')][0], state: 'Booted' }] } };
    expect(pickSimulator(booted, 'Gymido E2E iPhone').udid).toBe('OLD');
  });

  test('by UDID; unavailable or missing → null', () => {
    expect(pickSimulator(json, 'OTHER').name).toBe('Other');
    expect(pickSimulator(json, 'GONE')).toBeNull();
    expect(pickSimulator(json, 'Nope')).toBeNull();
  });
});

describe('emulatorSerials', () => {
  test('keeps booted emulators only; USB and Wi-Fi phones are dropped', () => {
    const output = [
      'List of devices attached',
      'emulator-5560\tdevice',
      'emulator-5554\toffline',
      'R58M123ABC\tdevice',
      '192.168.1.20:5555\tdevice',
      'adb-R58M123ABC-xyz._adb-tls-connect._tcp\tdevice',
      '',
    ].join('\n');
    expect(emulatorSerials(output)).toEqual(['emulator-5560']);
  });
});

describe('isDebuggable', () => {
  test('reads the DEBUGGABLE package flag', () => {
    expect(isDebuggable('    pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]')).toBe(true);
    expect(isDebuggable('    pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]\n  flags=[ DEBUGGABLE ]')).toBe(false);
  });
});

describe('planBuild', () => {
  const W1 = path.join(FLOWS_DIR, 'workout/W1-rest-paths.yaml');
  const F04 = path.join(FLOWS_DIR, '04-login-lands-signed-in.yaml');

  test('Android W1/W2 on the dev client stops the run', () => {
    expect(planBuild({ platform: 'android', release: false, flows: [F04, W1], maestroArgs: [] })).toEqual({
      error: 'release-only',
      flows: [W1],
    });
  });

  test('a release build adds RELEASE_BUILD=true unless it was passed', () => {
    expect(planBuild({ platform: 'android', release: true, flows: [W1], maestroArgs: [] })).toEqual({
      needsMetro: false,
      extraArgs: ['-e', 'RELEASE_BUILD=true'],
    });
    expect(planBuild({ platform: 'ios', release: true, flows: [], maestroArgs: ['-e', 'RELEASE_BUILD=true'] }).extraArgs).toEqual([]);
  });

  test('the dev client needs Metro; iOS W1 on the dev client is allowed', () => {
    expect(planBuild({ platform: 'ios', release: false, flows: [W1], maestroArgs: [] })).toEqual({ needsMetro: true, extraArgs: [] });
  });
});

describe('cleanup', () => {
  const { session, startedHere, keptRunning, cleanup } = require('../run-e2e');
  let logs;

  beforeEach(() => {
    session.started = [];
    session.kept = [];
    delete process.env.KEEP_DEVICE;
    logs = [];
    jest.spyOn(console, 'log').mockImplementation((line) => logs.push(line));
    jest.spyOn(console, 'error').mockImplementation((line) => logs.push(line));
  });

  afterEach(() => jest.restoreAllMocks());

  test('stops what it started, newest first, and names what it left running', async () => {
    const order = [];
    startedHere('simulator "S"', async () => order.push('simulator'));
    startedHere('Metro', async () => order.push('metro'));
    keptRunning('DeviceHub');
    await cleanup();
    expect(order).toEqual(['metro', 'simulator']);
    expect(logs[0]).toBe('run-e2e: left running (already up before this run): DeviceHub.');
  });

  test('one failed stop does not skip the rest', async () => {
    const stopped = jest.fn();
    startedHere('simulator "S"', stopped);
    startedHere('Metro', async () => {
      throw new Error('gone');
    });
    await cleanup();
    expect(stopped).toHaveBeenCalled();
    expect(logs).toContain('run-e2e: could not stop Metro: gone');
  });

  test('a stop that returns false is not reported as stopped', async () => {
    startedHere('DeviceHub', async () => false);
    await cleanup();
    expect(logs).toEqual([]);
  });

  test('KEEP_DEVICE=1 stops nothing', async () => {
    const stop = jest.fn();
    process.env.KEEP_DEVICE = '1';
    startedHere('emulator "E"', stop);
    await cleanup();
    expect(stop).not.toHaveBeenCalled();
    expect(logs).toEqual(['run-e2e: KEEP_DEVICE=1, leaving running: emulator "E".']);
  });
});

describe('credentials', () => {
  const { credentialsFromFile, takeCredentialArgs, requiredCredentials, credentialEnv } = require('../run-e2e');

  test('MEMBER_* falls back to PROFILED_*; admin and Management API keys are never picked up', () => {
    const file = {
      PROFILED_EMAIL: 'p@x.co',
      PROFILED_PASSWORD: 'pp',
      TRAINER_EMAIL: 't@x.co',
      TRAINER_PASSWORD: 'tp',
      ADMIN_PASSWORD: 'admin',
      AUTH0_MGMT_CLIENT_SECRET: 'mgmt',
    };
    expect(credentialsFromFile(file)).toEqual({
      MEMBER_EMAIL: 'p@x.co',
      MEMBER_PASSWORD: 'pp',
      TRAINER_EMAIL: 't@x.co',
      TRAINER_PASSWORD: 'tp',
    });
    expect(credentialsFromFile({ ...file, MEMBER_EMAIL: 'm@x.co' }).MEMBER_EMAIL).toBe('m@x.co');
  });

  test('explicit -e credentials leave the args; other -e values stay', () => {
    expect(
      takeCredentialArgs(['-e', 'MEMBER_EMAIL=a=b', '--env=MAESTRO_TRAINER_PASSWORD=x', '-e', 'RELEASE_BUILD=true', '--format', 'junit']),
    ).toEqual({
      rest: ['-e', 'RELEASE_BUILD=true', '--format', 'junit'],
      explicit: { MEMBER_EMAIL: 'a=b', TRAINER_PASSWORD: 'x' },
    });
  });

  test('required names follow runFlow references, and only credential names count', () => {
    const files = {
      '/f/04.yaml': '- runFlow:\n    file: subflows/login.yaml\n    env:\n      LOGIN_EMAIL: ${MAESTRO_MEMBER_EMAIL}\n',
      '/f/W1.yaml': '- runFlow: ../f/subflows/in.yaml\n',
      '/f/subflows/in.yaml': '- runFlow: in.yaml\n          LOGIN_PASSWORD: ${MAESTRO_MEMBER_PASSWORD}\n',
      '/f/subflows/login.yaml': '- inputText: ${LOGIN_EMAIL}\n- evalScript: ${MAESTRO_OTHER}\n',
    };
    const read = (file) => {
      if (!(file in files)) throw new Error('missing');
      return files[file];
    };
    expect(requiredCredentials(['/f/04.yaml'], read)).toEqual(['MEMBER_EMAIL']);
    expect(requiredCredentials(['/f/W1.yaml'], read)).toEqual(['MEMBER_PASSWORD']);
  });

  test.each([
    ['01', []],
    ['02', []],
    ['03', []],
    ['04', ['MEMBER_EMAIL', 'MEMBER_PASSWORD']],
    ['05', ['MEMBER_EMAIL', 'MEMBER_PASSWORD']],
    ['06', ['MEMBER_EMAIL', 'MEMBER_PASSWORD']],
    ['07', ['TRAINER_EMAIL', 'TRAINER_PASSWORD']],
    ['W1', ['MEMBER_EMAIL', 'MEMBER_PASSWORD']],
    ['W2', ['MEMBER_EMAIL', 'MEMBER_PASSWORD']],
  ])('the real flow %s needs %j', (selector, expected) => {
    expect(requiredCredentials(resolveFlows([selector], listFlowFiles(FLOWS_DIR)))).toEqual(expected);
  });

  test('values reach Maestro MAESTRO_-prefixed', () => {
    expect(credentialEnv({ MEMBER_EMAIL: 'a' })).toEqual({ MAESTRO_MEMBER_EMAIL: 'a' });
  });
});

describe('config.yaml flowsOrder', () => {
  const fs = require('fs');
  const { requiredCredentials: needs } = require('../run-e2e');
  const config = fs.readFileSync(path.join(FLOWS_DIR, 'config.yaml'), 'utf8');
  const order = config
    .slice(config.indexOf('flowsOrder:'))
    .split('\n')
    .slice(1)
    .map((line) => line.match(/^\s+-\s+(\S+)/))
    .filter(Boolean)
    .map((m) => m[1]);
  const suite = listFlowFiles(FLOWS_DIR).filter((file) => path.dirname(file) === FLOWS_DIR);

  test('lists every numbered flow exactly once', () => {
    expect([...order].sort()).toEqual(suite.map((file) => path.basename(file, '.yaml')).sort());
  });

  test('groups flows by account: signed out, then member, then trainer', () => {
    const rank = (name) => {
      const creds = needs([path.join(FLOWS_DIR, `${name}.yaml`)]);
      return creds.some((c) => c.startsWith('TRAINER_')) ? 2 : creds.length ? 1 : 0;
    };
    const ranks = order.map(rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('flow launch policy', () => {
  const fs = require('fs');

  test('only ensure-app-running, the sign-out fallback, 01 (cold start) and 03 (in-memory limiter) launch the app directly', () => {
    const dirs = [FLOWS_DIR, path.join(FLOWS_DIR, 'workout'), path.join(FLOWS_DIR, 'subflows')];
    const callers = dirs
      .flatMap((dir) => fs.readdirSync(dir).filter((n) => n.endsWith('.yaml')).map((n) => path.join(dir, n)))
      .filter((file) => /^[\s-]*(?:runFlow|file):\s*["']?[\w./-]*\blaunch-app\.yaml/m.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(FLOWS_DIR, file))
      .sort();
    expect(callers).toEqual([
      '01-welcome-no-auto-redirect.yaml',
      '03-decline-limiter.yaml',
      'subflows/ensure-app-running.yaml',
      'subflows/ensure-signed-out.yaml',
    ]);
  });
});

describe('parallel schedule', () => {
  const fs = require('fs');
  const { suiteFlows, flowAccounts, flowsConflict, scheduleSuite, scheduleConflicts, deviceName } = require('../run-e2e');
  const suite = suiteFlows(listFlowFiles(FLOWS_DIR), fs.readFileSync(path.join(FLOWS_DIR, 'config.yaml'), 'utf8'));
  const accountsOf = (flow) => flowAccounts(flow);
  const names = (phases) => phases.map((p) => ({ name: p.name, lanes: p.lanes.map((l) => l.map((f) => path.basename(f, '.yaml').slice(0, 2))) }));

  test('the suite follows config.yaml order', () => {
    expect(suite.map((f) => path.basename(f, '.yaml').slice(0, 2))).toEqual(['01', '02', '03', '04', '05', '06', '07']);
  });

  test.each([
    [[], [], false],
    [[], ['member'], true],
    [['member'], ['member'], true],
    [['member'], ['trainer'], false],
    [['member', 'trainer'], ['trainer'], true],
  ])('flowsConflict(%j, %j) = %s', (a, b, expected) => {
    expect(flowsConflict(a, b)).toBe(expected);
  });

  test('3 devices: signed-out flows spread, then the member chain beside the trainer', () => {
    expect(names(scheduleSuite(suite, accountsOf, 3))).toEqual([
      { name: 'signed out', lanes: [['01'], ['02'], ['03']] },
      { name: 'accounts', lanes: [['04', '05', '06'], ['07']] },
    ]);
  });

  test('2 devices', () => {
    expect(names(scheduleSuite(suite, accountsOf, 2))).toEqual([
      { name: 'signed out', lanes: [['01', '03'], ['02']] },
      { name: 'accounts', lanes: [['04', '05', '06'], ['07']] },
    ]);
  });

  test.each([1, 2, 3, 4, 6])('owner rule holds with %i devices: no flow overlaps another on its account', (n) => {
    const phases = scheduleSuite(suite, accountsOf, n);
    expect(scheduleConflicts(phases, accountsOf)).toEqual([]);
    expect(phases.flatMap((p) => p.lanes.flat()).sort()).toEqual([...suite].sort());
  });

  test('a flow that ends the session (06 signs out) runs after every other flow on its account', () => {
    const lanes = scheduleSuite(suite, accountsOf, 3).flatMap((p) => p.lanes);
    const memberLane = lanes.find((lane) => lane.some((f) => path.basename(f).startsWith('06')));
    expect(memberLane.filter((f) => accountsOf(f).includes('member')).map((f) => path.basename(f).slice(0, 2)).pop()).toBe('06');
    expect(lanes.filter((lane) => lane !== memberLane).flat().some((f) => accountsOf(f).includes('member'))).toBe(false);
  });

  test('the guard catches an overlap', () => {
    const fake = { a: ['member'], b: ['member'], c: [] };
    const phases = [{ name: 'x', lanes: [['a'], ['b', 'c']] }];
    expect(scheduleConflicts(phases, (f) => fake[f])).toEqual(['a ↔ b (x)', 'a ↔ c (x)']);
  });

  test('extra devices are named after the first', () => {
    expect(deviceName('Gymido E2E iPhone', 0, 'ios')).toBe('Gymido E2E iPhone');
    expect(deviceName('Gymido E2E iPhone', 1, 'ios')).toBe('Gymido E2E iPhone 2');
    expect(deviceName('Gymido_E2E_Phone', 2, 'android')).toBe('Gymido_E2E_Phone_3');
  });
});

describe('newestAppSourceMtime (stale release-build warning)', () => {
  const fs = require('fs');
  const os = require('os');
  const { newestAppSourceMtime } = require('../run-e2e');

  test('newest bundle input wins; tests and node_modules are ignored', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const touch = (rel, secs) => {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'x');
      fs.utimesSync(file, secs, secs);
    };
    touch('src/a.js', 1000);
    touch('app.config.js', 2000);
    touch('src/__tests__/a.test.js', 9000);
    touch('src/b.test.js', 9000);
    touch('src/node_modules/x.js', 9000);
    expect(newestAppSourceMtime(root)).toBe(2000 * 1000);
  });
});
