#!/usr/bin/env node
// Runs the Maestro suite (or chosen flows) on a SIMULATOR or EMULATOR only.
// Boots the default device if it isn't running, checks the app is installed,
// then pins Maestro to that device with --device, so a phone connected by USB
// or Wi-Fi is never touched.
//
//   node e2e/scripts/run-e2e.js <ios|android> [flow…] [maestro args…]
//   npm run e2e:ios -- W1
//
// A flow is a path or a file-name prefix: `W1`, `04`, `07-trainer`. With none,
// the numbered suite in e2e/maestro runs. Everything from the first `-…`
// argument on goes to `maestro test` unchanged.
//
// Credentials come from .env.e2e.local (MEMBER_* or else PROFILED_*, and
// TRAINER_*) and reach Maestro as MAESTRO_* environment variables, which it
// hands to the flows itself, so they stay off the command line. `-e
// MEMBER_EMAIL=…` still overrides the file and is moved into the environment
// the same way.
//
// Device: E2E_IOS_SIMULATOR (name or UDID, default "Gymido E2E iPhone"),
// E2E_ANDROID_AVD (default Gymido_E2E_Phone).
//
// Whatever this script starts (simulator, DeviceHub, emulator, Metro) it stops
// again when Maestro ends: pass, fail, Ctrl-C or SIGTERM. Anything that was
// already running is left alone. KEEP_DEVICE=1 skips the cleanup.

const { execFileSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const checkEnv = require('./check-env');

const APP_ID = 'com.gymido.app';
const ROOT = path.resolve(__dirname, '../..');
const FLOWS_DIR = path.join(ROOT, 'e2e/maestro');
const DEFAULT_IOS_SIMULATOR = 'Gymido E2E iPhone';
const DEFAULT_ANDROID_AVD = 'Gymido_E2E_Phone';
const DEFAULT_SHARDS = 3;
// Below 4 GB the emulator OOM-kills the hierarchy dump Maestro reads.
const EMULATOR_MEMORY_MB = '6144';
// Crash-hunt flows that must run on the Android release build.
const ANDROID_RELEASE_ONLY = /^W[12]-/;
const METRO_STATUS_URL = 'http://localhost:8081/status';
const DEVICE_HUB_ID = 'com.apple.dt.Devices';
const ENV_FILE = path.join(ROOT, '.env.e2e.local');
// Flow variable → .env.e2e.local keys that can supply it, first one wins. Only
// these are ever passed on: the file also holds admin and Management API keys.
const CREDENTIALS = {
  MEMBER_EMAIL: ['MEMBER_EMAIL', 'PROFILED_EMAIL'],
  MEMBER_PASSWORD: ['MEMBER_PASSWORD', 'PROFILED_PASSWORD'],
  TRAINER_EMAIL: ['TRAINER_EMAIL'],
  TRAINER_PASSWORD: ['TRAINER_PASSWORD'],
};

// ---- pure helpers (unit-tested) -------------------------------------------

function splitArgs(args) {
  const firstOption = args.findIndex((arg) => arg.startsWith('-'));
  const cut = firstOption === -1 ? args.length : firstOption;
  return { selectors: args.slice(0, cut), maestroArgs: args.slice(cut) };
}

// Candidate flow files: the numbered flows and workout/; never subflows/.
function listFlowFiles(flowsDir) {
  return ['', 'workout']
    .map((sub) => path.join(flowsDir, sub))
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.yaml') && name !== 'config.yaml')
        .map((name) => path.join(dir, name)),
    );
}

function resolveFlows(selectors, flowFiles, exists = fs.existsSync) {
  return selectors.map((selector) => {
    if (selector.includes('/') && exists(selector)) {
      return selector;
    }
    const wanted = selector.toLowerCase();
    const matches = flowFiles.filter((file) => path.basename(file).toLowerCase().startsWith(wanted));
    if (matches.length === 1) {
      return matches[0];
    }
    const known = flowFiles.map((file) => path.basename(file, '.yaml')).sort().join(', ');
    throw new Error(
      matches.length
        ? `"${selector}" matches several flows: ${matches.map((f) => path.basename(f)).join(', ')}`
        : `No flow matches "${selector}". Flows: ${known}`,
    );
  });
}

function hasEnv(maestroArgs, key) {
  return maestroArgs.some((arg, i) => {
    const value = arg === '-e' || arg === '--env' ? maestroArgs[i + 1] : arg.replace(/^--env=/, '');
    return typeof value === 'string' && value.startsWith(`${key}=`);
  });
}

// `xcrun simctl list devices -j` → the simulator to use. Matches a UDID or a
// name; among same-named devices prefers a booted one, then the newest iOS.
function pickSimulator(devicesJson, wanted) {
  const candidates = Object.entries(devicesJson.devices || {})
    .filter(([runtime]) => runtime.includes('SimRuntime.iOS-'))
    .flatMap(([runtime, devices]) =>
      devices
        .filter((d) => d.isAvailable !== false && (d.udid === wanted || d.name === wanted))
        .map((d) => ({ ...d, runtime })),
    );
  const version = (runtime) => runtime.replace(/.*iOS-/, '').split('-').map(Number);
  candidates.sort((a, b) => {
    if ((a.state === 'Booted') !== (b.state === 'Booted')) {
      return a.state === 'Booted' ? -1 : 1;
    }
    const [va, vb] = [version(a.runtime), version(b.runtime)];
    return vb[0] - va[0] || (vb[1] || 0) - (va[1] || 0);
  });
  return candidates[0] || null;
}

// `adb devices` → serials of running emulators. Phones (USB serials, Wi-Fi
// host:port) are dropped here so nothing downstream can pick one.
function emulatorSerials(adbDevicesOutput) {
  return adbDevicesOutput
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => /^emulator-\d+$/.test(serial || '') && state === 'device')
    .map(([serial]) => serial);
}

function isDebuggable(dumpsysPackageOutput) {
  return /pkgFlags=\[[^\]]*\bDEBUGGABLE\b/.test(dumpsysPackageOutput);
}

function credentialsFromFile(fileValues) {
  const found = {};
  for (const [name, sources] of Object.entries(CREDENTIALS)) {
    const source = sources.find((key) => fileValues[key]);
    if (source) {
      found[name] = fileValues[source];
    }
  }
  return found;
}

// Pulls `-e NAME=…` / `--env NAME=…` / `--env=NAME=…` for credential names
// (bare or MAESTRO_-prefixed) out of the Maestro args, so they can travel in
// the environment instead of the command line.
function takeCredentialArgs(maestroArgs) {
  const rest = [];
  const explicit = {};
  for (let i = 0; i < maestroArgs.length; i += 1) {
    const arg = maestroArgs[i];
    const separate = (arg === '-e' || arg === '--env') && i + 1 < maestroArgs.length;
    const pair = separate ? maestroArgs[i + 1] : arg.startsWith('--env=') ? arg.slice('--env='.length) : null;
    const name = pair && pair.slice(0, pair.indexOf('=')).replace(/^MAESTRO_/, '');
    if (pair && pair.includes('=') && CREDENTIALS[name]) {
      explicit[name] = pair.slice(pair.indexOf('=') + 1);
      i += separate ? 1 : 0;
    } else {
      rest.push(arg);
    }
  }
  return { rest, explicit };
}

// Credential names the flows reference as ${MAESTRO_NAME}, following runFlow
// files transitively.
function requiredCredentials(flowFiles, read = (file) => fs.readFileSync(file, 'utf8')) {
  const names = new Set();
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    let text;
    try {
      text = read(file);
    } catch {
      return;
    }
    for (const [, name] of text.matchAll(/\$\{MAESTRO_([A-Z_]+)\}/g)) {
      if (CREDENTIALS[name]) {
        names.add(name);
      }
    }
    for (const [, ref] of text.matchAll(/^[\s-]*(?:runFlow|file):\s*["']?([\w./-]+\.yaml)/gm)) {
      visit(path.resolve(path.dirname(file), ref));
    }
  };
  flowFiles.forEach(visit);
  return [...names].sort();
}

function credentialEnv(values) {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [`MAESTRO_${name}`, value]));
}

// Which build to drive, or why the run must stop. `release` = JS embedded.
function planBuild({ platform, release, flows, maestroArgs }) {
  const releaseOnly = flows.filter((flow) => ANDROID_RELEASE_ONLY.test(path.basename(flow)));
  if (platform === 'android' && !release && releaseOnly.length) {
    return { error: 'release-only', flows: releaseOnly };
  }
  return {
    needsMetro: !release,
    extraArgs: release && !hasEnv(maestroArgs, 'RELEASE_BUILD') ? ['-e', 'RELEASE_BUILD=true'] : [],
  };
}

// The suite in config.yaml's flowsOrder, then any numbered flow it doesn't list.
function suiteFlows(flowFiles, configText) {
  const numbered = flowFiles.filter((file) => path.dirname(file) === FLOWS_DIR);
  const order = (configText.split('flowsOrder:')[1] || '')
    .split('\n')
    .map((line) => line.match(/^\s+-\s+(\S+)/))
    .filter(Boolean)
    .map((m) => m[1]);
  const rank = (file) => {
    const i = order.indexOf(path.basename(file, '.yaml'));
    return i === -1 ? order.length : i;
  };
  return [...numbered].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// ---- parallel schedule ----------------------------------------------------
//
// Owner's rule: a flow that signs out or switches accounts must never run while
// another flow uses that account. Every flow that signs in can sign out first
// (ensure-signed-out / ensure-signed-in-as / sign-in-as), and a signed-out flow
// signs out whatever account its device holds, so the schedule is:
//   phase 1, "signed out": flows with no account, spread over the devices;
//   phase 2, "accounts": one lane per account, its flows in suite order on ONE
//   device, so two flows on the same account never overlap.

const ACCOUNT_OF_CREDENTIAL = { MEMBER: 'member', TRAINER: 'trainer' };

function flowAccounts(flowFile, read) {
  const accounts = requiredCredentials([flowFile], read).map((name) => ACCOUNT_OF_CREDENTIAL[name.split('_')[0]]);
  return [...new Set(accounts)].sort();
}

// Two flows may overlap only if neither signs in (both signed out) or they use
// different accounts. A signed-out flow can't overlap an account flow: it
// signs out whatever its device holds.
function flowsConflict(a, b) {
  if (!a.length && !b.length) {
    return false;
  }
  return !a.length || !b.length || a.some((account) => b.includes(account));
}

function leastLoaded(lanes) {
  return lanes.reduce((best, lane, i) => (lane.length < lanes[best].length ? i : best), 0);
}

// flows: suite order. accountsOf(flow) → sorted account list. Returns phases of
// lanes (one lane = one device, run in order); empty phases and lanes dropped.
function scheduleSuite(flows, accountsOf, deviceCount) {
  const signedOut = Array.from({ length: deviceCount }, () => []);
  flows.filter((flow) => !accountsOf(flow).length).forEach((flow) => signedOut[leastLoaded(signedOut)].push(flow));

  // Chains: flows linked by a shared account, kept in suite order.
  const chains = [];
  for (const flow of flows.filter((f) => accountsOf(f).length)) {
    const linked = chains.filter((chain) => chain.some((other) => flowsConflict(accountsOf(other), accountsOf(flow))));
    const merged = linked.flat().concat(flow).sort((x, y) => flows.indexOf(x) - flows.indexOf(y));
    linked.forEach((chain) => chains.splice(chains.indexOf(chain), 1));
    chains.push(merged);
  }
  chains.sort((x, y) => flows.indexOf(x[0]) - flows.indexOf(y[0]));
  const accountLanes = Array.from({ length: deviceCount }, () => []);
  chains.forEach((chain) => accountLanes[leastLoaded(accountLanes)].push(...chain));

  return [
    { name: 'signed out', lanes: signedOut },
    { name: 'accounts', lanes: accountLanes },
  ]
    .map((phase) => ({ ...phase, lanes: phase.lanes.filter((lane) => lane.length) }))
    .filter((phase) => phase.lanes.length);
}

// Every pair of flows that would run at the same time and must not.
function scheduleConflicts(phases, accountsOf) {
  const found = [];
  for (const phase of phases) {
    phase.lanes.forEach((lane, i) =>
      phase.lanes.slice(i + 1).forEach((other) =>
        lane.forEach((a) =>
          other.forEach((b) => {
            if (flowsConflict(accountsOf(a), accountsOf(b))) {
              found.push(`${path.basename(a)} ↔ ${path.basename(b)} (${phase.name})`);
            }
          }),
        ),
      ),
    );
  }
  return found;
}

// Device i of the run: the default one, then "<name> 2" (iOS) / "<name>_2" (AVD).
function deviceName(base, index, platform) {
  if (index === 0) {
    return base;
  }
  return platform === 'ios' ? `${base} ${index + 1}` : `${base}_${index + 1}`;
}

// ---- device plumbing ------------------------------------------------------

function fail(message) {
  const error = new Error(message);
  error.userFacing = true;
  throw error;
}

// What this run started (stopped at the end, newest first) and what it found
// already running (left alone).
const session = { started: [], kept: [], interrupted: null, children: new Set() };

function startedHere(what, stop) {
  session.started.push({ what, stop });
}

function keptRunning(what) {
  session.kept.push(what);
}

async function cleanup() {
  if (session.kept.length) {
    console.log(`run-e2e: left running (already up before this run): ${session.kept.join('; ')}.`);
  }
  if (!session.started.length) {
    return;
  }
  if (process.env.KEEP_DEVICE === '1') {
    console.log(`run-e2e: KEEP_DEVICE=1, leaving running: ${session.started.map((s) => s.what).join('; ')}.`);
    return;
  }
  for (const { what, stop } of session.started.reverse()) {
    try {
      // A stop that returns false decided to leave it running and said why.
      if ((await stop()) !== false) {
        console.log(`run-e2e: stopped ${what}.`);
      }
    } catch (error) {
      console.error(`run-e2e: could not stop ${what}: ${error.message}`);
    }
  }
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, { timeoutMs, intervalMs = 2000, what, ignoreInterrupt = false }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (session.interrupted && !ignoreInterrupt) {
      fail(`Interrupted (${session.interrupted}).`);
    }
    const value = await check();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  return fail(`Timed out after ${Math.round(timeoutMs / 1000)} s waiting for ${what}.`);
}

function androidTool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'Library/Android/sdk');
  const file = path.join(sdk, name === 'adb' ? 'platform-tools/adb' : 'emulator/emulator');
  return fs.existsSync(file) ? file : name;
}

function maestroBinary() {
  const local = path.join(os.homedir(), '.maestro/bin/maestro');
  const onPath = spawnSync('sh', ['-c', 'command -v maestro'], { encoding: 'utf8' }).stdout.trim();
  return onPath || (fs.existsSync(local) ? local : fail('Maestro not found. Install it: curl -fsSL "https://get.maestro.mobile.dev" | bash'));
}

async function metroRunning() {
  try {
    const response = await fetch(METRO_STATUS_URL, { signal: AbortSignal.timeout(3000) });
    return (await response.text()).includes('packager-status:running');
  } catch {
    return false;
  }
}

// A detached child leads its own process group, so the whole tree (npm, expo,
// Metro's workers) can be signalled at once.
function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function ensureMetro() {
  if (await metroRunning()) {
    keptRunning('Metro');
    return;
  }
  const log = path.join(os.tmpdir(), 'gymido-metro.log');
  console.log(`run-e2e: the dev client needs Metro; starting it (log: ${log})…`);
  const out = fs.openSync(log, 'w');
  const metro = spawn('npm', ['start'], { cwd: ROOT, detached: true, stdio: ['ignore', out, out], env: { ...process.env, CI: '1' } });
  metro.unref();
  startedHere('Metro', async () => {
    killGroup(metro.pid, 'SIGTERM');
    await sleep(2000);
    killGroup(metro.pid, 'SIGKILL');
  });
  await waitFor(metroRunning, { timeoutMs: 120000, what: 'Metro to start' });
}

function bootedSimulators() {
  const { devices } = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']));
  return Object.values(devices).flat().map((d) => d.udid);
}

function deviceHubRunning() {
  return spawnSync('osascript', ['-e', `application id "${DEVICE_HUB_ID}" is running`], { encoding: 'utf8' }).stdout.trim() === 'true';
}

function setupIosTools() {
  if (!process.env.DEVELOPER_DIR && run('xcode-select', ['-p']).includes('CommandLineTools')) {
    process.env.DEVELOPER_DIR = '/Applications/Xcode.app/Contents/Developer';
  }
}

function runAsync(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

// The simulators this run uses. Extra ones ("<name> 2", …) are created once,
// FRESH (same model and iOS as the first) and get the app from the first one
// after boot. Not clones: a clone copies the first simulator's Auth0 browser
// cookie and stored login, so two devices would share one Auth0 session and a
// sign-out on one breaks a login in progress on the other.
function resolveIosSimulators(names) {
  const list = () => JSON.parse(run('xcrun', ['simctl', 'list', 'devices', '-j']));
  const base = pickSimulator(list(), names[0]);
  if (!base) {
    fail(
      `No iOS simulator named "${names[0]}". Create it once (newest iOS runtime from \`xcrun simctl list runtimes\`):\n` +
        `  xcrun simctl create "${names[0]}" "iPhone 18 Pro" com.apple.CoreSimulator.SimRuntime.iOS-27-0\n` +
        'or pick another with E2E_IOS_SIMULATOR=<name or UDID>.',
    );
  }
  return names.map((name, i) => {
    if (i === 0) {
      return base;
    }
    const existing = pickSimulator(list(), name);
    if (existing) {
      return existing;
    }
    console.log(`run-e2e: creating simulator "${name}" (fresh ${base.deviceTypeIdentifier.split('.').pop()}, the app is copied from "${base.name}")…`);
    run('xcrun', ['simctl', 'create', name, base.deviceTypeIdentifier, base.runtime]);
    return pickSimulator(list(), name);
  });
}

async function bootIosSimulator(sim) {
  if (sim.quiet) {
    // Re-check after installing; already booted and registered by this run.
  } else if (sim.state === 'Booted') {
    console.log(`run-e2e: iOS simulator "${sim.name}" (${sim.udid}), Booted.`);
    keptRunning(`simulator "${sim.name}"`);
  } else {
    console.log(`run-e2e: iOS simulator "${sim.name}" (${sim.udid}), ${sim.state}.`);
    startedHere(`simulator "${sim.name}"`, async () => {
      // Quitting DeviceHub may already have shut it down.
      if (bootedSimulators().includes(sim.udid)) {
        run('xcrun', ['simctl', 'shutdown', sim.udid]);
      }
    });
  }
  // Boots if needed and waits until the OS has finished booting.
  if ((await runAsync('xcrun', ['simctl', 'bootstatus', sim.udid, '-b'], 300000)) !== 0) {
    fail(`Simulator ${sim.udid} did not finish booting.`);
  }
  let appPath = null;
  try {
    appPath = run('xcrun', ['simctl', 'get_app_container', sim.udid, APP_ID, 'app']).trim();
  } catch {
    return { name: sim.name, udid: sim.udid, missing: `npm run ios -- --device "${sim.name}"` };
  }
  const bundle = path.join(appPath, 'main.jsbundle');
  const release = fs.existsSync(bundle);
  if (release && !sim.quiet && fs.statSync(bundle).mtimeMs < newestAppSourceMtime()) {
    console.warn(`run-e2e: WARNING: the release build on "${sim.name}" is older than the app's latest source change; rebuild it: npm run e2e:ios:release`);
  }
  return { name: sim.name, udid: sim.udid, release, installHint: `npm run ios -- --device "${sim.name}"` };
}

// Newest change to anything that goes into the JS bundle (tests excluded).
function newestAppSourceMtime(root = ROOT) {
  let newest = 0;
  const visit = (file) => {
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      fs.readdirSync(file)
        .filter((name) => name !== '__tests__' && name !== 'node_modules')
        .forEach((name) => visit(path.join(file, name)));
    } else if (!/\.test\.js$/.test(file)) {
      newest = Math.max(newest, stat.mtimeMs);
    }
  };
  ['src', 'index.js', 'App.js', 'app.config.js', 'assets'].map((entry) => path.join(root, entry)).filter((f) => fs.existsSync(f)).forEach(visit);
  return newest;
}

// Xcode 27 renamed Simulator.app to DeviceHub; showing it is cosmetic.
// Quitting DeviceHub shuts down every booted simulator, so at the end it stays
// open while one this run didn't boot is still up.
function openDeviceHub(bootedHere) {
  if (deviceHubRunning()) {
    keptRunning('DeviceHub');
  } else if (spawnSync('open', ['-a', 'DeviceHub']).status === 0) {
    startedHere('DeviceHub', async () => {
      const others = bootedSimulators().filter((udid) => !bootedHere.includes(udid));
      if (others.length) {
        console.log(`run-e2e: left DeviceHub open: quitting it would shut down ${others.length} simulator(s) this run didn't boot.`);
        return false;
      }
      run('osascript', ['-e', `tell application id "${DEVICE_HUB_ID}" to quit`]);
    });
  } else {
    spawnSync('open', ['-a', 'Simulator']);
  }
}

async function prepareIos(names) {
  setupIosTools();
  const sims = resolveIosSimulators(names);
  // DeviceHub must be registered before the simulators so that cleanup (newest
  // first) shuts them down before deciding whether to quit DeviceHub.
  const bootedHere = sims.filter((sim) => sim.state !== 'Booted').map((sim) => sim.udid);
  openDeviceHub(bootedHere);
  const devices = await Promise.all(sims.map(bootIosSimulator));
  // A device without the app gets the first device's build (the same .app).
  const source = devices[0].missing ? null : run('xcrun', ['simctl', 'get_app_container', devices[0].udid, APP_ID, 'app']).trim();
  return Promise.all(
    devices.map(async (device, i) => {
      if (!device.missing || !source || i === 0) {
        return device;
      }
      console.log(`run-e2e: installing the app on "${device.name}" from "${devices[0].name}"…`);
      run('xcrun', ['simctl', 'install', device.udid, source]);
      return bootIosSimulator({ ...sims[i], state: 'Booted', quiet: true });
    }),
  );
}

function avdName(adb, serial) {
  try {
    return run(adb, ['-s', serial, 'emu', 'avd', 'name']).split('\n')[0].trim();
  } catch {
    return null;
  }
}

function avdHome() {
  return process.env.ANDROID_AVD_HOME || path.join(os.homedir(), '.android/avd');
}

// Creates AVD `name` as a copy of `base` (an APFS clone, so it is instant and
// takes no extra space until it diverges), app included. The copy drops lock
// files and the generated hardware-qemu.ini, which hold the base's paths; the
// emulator regenerates it. Its first boot clears the app's and Chrome's data
// (freshAvds), so it doesn't share the base's Auth0 session or stored login.
function cloneAvd(base, name) {
  const home = avdHome();
  const src = path.join(home, `${base}.avd`);
  const dst = path.join(home, `${name}.avd`);
  run('cp', ['-c', '-R', src, dst]);
  for (const entry of fs.readdirSync(dst)) {
    if (entry.endsWith('.lock') || entry === 'hardware-qemu.ini' || entry === 'emu-launch-params.txt') {
      fs.rmSync(path.join(dst, entry), { recursive: true, force: true });
    }
  }
  const config = path.join(dst, 'config.ini');
  fs.writeFileSync(
    config,
    fs
      .readFileSync(config, 'utf8')
      .replace(/^AvdId=.*$/m, `AvdId=${name}`)
      .replace(/^avd\.ini\.displayname=.*$/m, `avd.ini.displayname=${name}`),
  );
  fs.writeFileSync(
    path.join(home, `${name}.ini`),
    fs
      .readFileSync(path.join(home, `${base}.ini`), 'utf8')
      .replace(/^path=.*$/m, `path=${dst}`)
      .replace(/^path\.rel=.*$/m, `path.rel=avd/${name}.avd`),
  );
}

const freshAvds = new Set();

async function startAndroidEmulator(avd, adb, findSerial) {
  let serial = findSerial(avd);
  if (serial) {
    console.log(`run-e2e: Android emulator "${avd}" already running as ${serial}.`);
    keptRunning(`emulator "${avd}" (${serial})`);
  } else {
    const emulator = androidTool('emulator');
    const log = path.join(os.tmpdir(), `gymido-emulator-${avd}.log`);
    console.log(`run-e2e: starting emulator "${avd}" (${EMULATOR_MEMORY_MB} MB RAM; log: ${log})…`);
    const out = fs.openSync(log, 'a');
    const proc = spawn(emulator, ['-avd', avd, '-memory', EMULATOR_MEMORY_MB, '-no-snapshot-load'], {
      detached: true,
      stdio: ['ignore', out, out],
    });
    proc.unref();
    // Until adb sees it, the only handle is the process; afterwards `emu kill`
    // shuts it down cleanly.
    const stop = { serial: null };
    startedHere(`emulator "${avd}"`, async () => {
      if (stop.serial) {
        spawnSync(adb, ['-s', stop.serial, 'emu', 'kill'], { stdio: 'ignore' });
        await waitFor(() => !emulatorSerials(run(adb, ['devices'])).includes(stop.serial), {
          timeoutMs: 30000,
          intervalMs: 1000,
          what: `${stop.serial} to shut down`,
          ignoreInterrupt: true,
        }).catch(() => killGroup(proc.pid, 'SIGKILL'));
      } else {
        killGroup(proc.pid, 'SIGKILL');
      }
    });
    serial = await waitFor(() => findSerial(avd), { timeoutMs: 180000, what: `emulator "${avd}" to appear in adb` });
    stop.serial = serial;
  }
  await waitFor(
    () => {
      try {
        return run(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed']).trim() === '1';
      } catch {
        return false;
      }
    },
    { timeoutMs: 300000, what: `${serial} to finish booting` },
  );
  // Draw-time crashes hide when the screen is off: keep it awake and unlocked.
  // System animations off: shorter settle waits between steps (test device only).
  const animationsOff = ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'].map((key) => [
    'settings',
    'put',
    'global',
    key,
    '0',
  ]);
  for (const args of [['svc', 'power', 'stayon', 'true'], ['input', 'keyevent', 'KEYCODE_WAKEUP'], ['wm', 'dismiss-keyguard'], ...animationsOff]) {
    spawnSync(adb, ['-s', serial, 'shell', ...args], { stdio: 'ignore' });
  }
  if (freshAvds.has(avd)) {
    console.log(`run-e2e: clearing the copied app and Chrome data on "${avd}" (its own Auth0 session)…`);
    for (const pkg of [APP_ID, 'com.android.chrome']) {
      spawnSync(adb, ['-s', serial, 'shell', 'pm', 'clear', pkg], { stdio: 'ignore' });
    }
  }

  let dumpsys = '';
  try {
    dumpsys = run(adb, ['-s', serial, 'shell', 'dumpsys', 'package', APP_ID]);
  } catch {
    // Treated as not installed below.
  }
  if (!dumpsys.includes(`Package [${APP_ID}]`)) {
    return {
      name: avd,
      udid: serial,
      missing: `release (needed for W1/W2): ${androidReleaseHint(serial)}\n    dev client: npm run android -- --device ${avd}`,
    };
  }
  return { name: avd, udid: serial, release: !isDebuggable(dumpsys), installHint: androidReleaseHint(serial) };
}

async function prepareAndroid(avds) {
  const adb = androidTool('adb');
  const findSerial = (avd) => emulatorSerials(run(adb, ['devices'])).find((serial) => avdName(adb, serial) === avd);
  const known = run(androidTool('emulator'), ['-list-avds']).split('\n').map((name) => name.trim());
  if (!known.includes(avds[0])) {
    fail(`No Android AVD named "${avds[0]}" (\`emulator -list-avds\`). Create it in Android Studio, or set E2E_ANDROID_AVD=<name>.`);
  }
  for (const avd of avds.slice(1).filter((name) => !known.includes(name))) {
    if (findSerial(avds[0])) {
      fail(`"${avd}" doesn't exist yet and is copied from "${avds[0]}", which must be shut down for that. Shut it down, or run with E2E_SHARDS=1.`);
    }
    console.log(`run-e2e: creating AVD "${avd}" (a copy of "${avds[0]}", app included)…`);
    cloneAvd(avds[0], avd);
    freshAvds.add(avd);
  }
  return Promise.all(avds.map((avd) => startAndroidEmulator(avd, adb, findSerial)));
}

function androidReleaseHint(serial) {
  return (
    '(cd android && APP_ENV=development NODE_ENV=production ./gradlew assembleRelease) && ' +
    `adb -s ${serial} install -r android/app/build/outputs/apk/release/app-release.apk`
  );
}

function spawnMaestro(maestro, args, env, logFile) {
  return new Promise((resolve) => {
    const out = logFile ? fs.openSync(logFile, 'w') : null;
    const child = spawn(maestro, args, { stdio: out ? ['ignore', out, out] : 'inherit', cwd: ROOT, env });
    session.children.add(child);
    const done = (code) => {
      session.children.delete(child);
      if (out) {
        fs.closeSync(out);
      }
      resolve(code);
    };
    child.on('error', (error) => {
      console.error(`run-e2e: could not start Maestro: ${error.message}`);
      done(1);
    });
    child.on('exit', (code, signal) => done(code ?? (signal ? 128 + (os.constants.signals[signal] || 0) : 1)));
  });
}

// The line of a failed flow's log that says why, for the summary.
function failureReason(logFile) {
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
  return (lines.reverse().find((line) => /FAILED|Assertion|not found|Error|Exception/.test(line)) || 'see log').trim().slice(0, 160);
}

// Runs one lane (a device's flows, in order), one Maestro run per flow so the
// order is exact and each flow reports on its own.
async function runLane(lane, device, ctx) {
  const results = [];
  for (const flow of lane) {
    if (session.interrupted) {
      break;
    }
    const name = path.basename(flow, '.yaml');
    const logFile = path.join(ctx.logDir, `${name}.log`);
    const started = Date.now();
    const args = ['test', '-p', ctx.platform, '--device', device.udid, ...device.extraArgs, ...ctx.maestroArgs];
    if (device.driverReady) {
      args.push('--no-reinstall-driver');
    }
    // Parallel runs started in the same second would share one
    // ~/.maestro/tests/<time> folder; give each flow its own.
    // One file per run, so Maestro doesn't pick up config.yaml (platform
    // settings such as disableAnimations) by itself.
    args.push('--config', path.relative(ROOT, path.join(FLOWS_DIR, 'config.yaml')));
    args.push('--debug-output', path.join(ctx.logDir, name), path.relative(ROOT, flow));
    const code = await spawnMaestro(ctx.maestro, args, ctx.env, logFile);
    device.driverReady = true;
    const secs = Math.round((Date.now() - started) / 1000);
    const verdict = code === 0 ? 'PASS' : 'FAIL';
    console.log(`run-e2e: [${device.name}] ${verdict} ${name} (${secs} s)${code === 0 ? '' : ` — ${failureReason(logFile)}; log: ${logFile}`}`);
    results.push({ name, code, secs, device: device.name });
  }
  return results;
}

function printSchedule(phases, devices) {
  phases.forEach((phase, i) => {
    const lanes = phase.lanes.map((lane, j) => `${devices[j].name}: ${lane.map((f) => path.basename(f, '.yaml').slice(0, 2)).join(' → ')}`);
    console.log(`run-e2e: phase ${i + 1} (${phase.name}): ${lanes.join(' | ')}`);
  });
}

async function main(argv) {
  const platform = argv[2];
  if (platform !== 'ios' && platform !== 'android') {
    fail('Usage: node e2e/scripts/run-e2e.js <ios|android> [flow…] [maestro args…]');
  }
  if (checkEnv.main([argv[0], argv[1]]) !== 0) {
    return 1;
  }
  const { selectors, maestroArgs: rawArgs } = splitArgs(argv.slice(3));
  const flowFiles = listFlowFiles(FLOWS_DIR);
  const flows = resolveFlows(selectors, flowFiles);
  // The suite (no flow named) is the numbered flows only, in config.yaml order.
  const suite = flows.length ? flows : suiteFlows(flowFiles, fs.readFileSync(path.join(FLOWS_DIR, 'config.yaml'), 'utf8'));
  const { rest: maestroArgs, explicit } = takeCredentialArgs(rawArgs);
  const fileValues = fs.existsSync(ENV_FILE) ? require('dotenv').parse(fs.readFileSync(ENV_FILE)) : {};
  const credentials = { ...credentialsFromFile(fileValues), ...explicit };
  const required = Object.fromEntries(requiredCredentials(suite).map((name) => [name, CREDENTIALS[name]]));
  if (checkEnv.checkRequired(required, credentials) !== 0) {
    return 1;
  }
  const maestro = maestroBinary();

  // Named flows run on one device, as given; the suite is spread over
  // E2E_SHARDS devices (default 3; 1 = one device, Maestro's own ordering).
  const shards = flows.length ? 1 : Math.max(1, Number.parseInt(process.env.E2E_SHARDS || String(DEFAULT_SHARDS), 10) || 1);
  const accountsOf = (flow) => flowAccounts(flow);
  const phases = shards > 1 ? scheduleSuite(suite, accountsOf, shards) : null;
  const deviceCount = phases ? Math.max(...phases.map((phase) => phase.lanes.length)) : 1;
  if (phases) {
    const conflicts = scheduleConflicts(phases, accountsOf);
    if (conflicts.length) {
      fail(`Internal: the parallel schedule would overlap flows on one account: ${conflicts.join(', ')}`);
    }
  }

  const base = platform === 'ios' ? process.env.E2E_IOS_SIMULATOR || DEFAULT_IOS_SIMULATOR : process.env.E2E_ANDROID_AVD || DEFAULT_ANDROID_AVD;
  const names = Array.from({ length: deviceCount }, (_, i) => deviceName(base, i, platform));
  const devices = platform === 'ios' ? await prepareIos(names) : await prepareAndroid(names);
  const missing = devices.filter((device) => device.missing);
  if (missing.length) {
    fail(
      `The app (${APP_ID}) is not installed on ${missing.map((d) => `"${d.name}"`).join(', ')}. Install it, then re-run:\n` +
        missing.map((d) => `  ${d.name}:\n    ${d.missing}`).join('\n'),
    );
  }
  for (const device of devices) {
    const plan = planBuild({ platform, release: device.release, flows: suite, maestroArgs });
    if (plan.error === 'release-only') {
      fail(
        `${plan.flows.map((f) => path.basename(f)).join(', ')} must run on the Android RELEASE build, ` +
          `but ${device.name} has the dev client. Install the release APK, then re-run:\n  ${device.installHint}`,
      );
    }
    Object.assign(device, plan);
    console.log(`run-e2e: ${device.release ? 'release build' : 'dev client'} on ${device.name} (${device.udid}).`);
  }
  if (devices.some((device) => device.needsMetro)) {
    await ensureMetro();
  }
  if (session.interrupted) {
    fail(`Interrupted (${session.interrupted}).`);
  }
  // The tenant domain (not a secret) for login.yaml's self-heal, which opens
  // Auth0's logout endpoint when a leftover browser session hides the form.
  const appEnvFile = path.join(ROOT, `.env.${process.env.APP_ENV || 'development'}`);
  const auth0Domain = fs.existsSync(appEnvFile) ? require('dotenv').parse(fs.readFileSync(appEnvFile)).AUTH0_DOMAIN : undefined;
  const env = { ...process.env, ...credentialEnv(credentials), ...(auth0Domain ? { MAESTRO_AUTH0_DOMAIN: auth0Domain } : {}) };

  if (!phases) {
    const args = ['test', '-p', platform, '--device', devices[0].udid, ...devices[0].extraArgs, ...maestroArgs];
    args.push(...(flows.length ? flows.map((f) => path.relative(ROOT, f)) : [path.relative(ROOT, FLOWS_DIR)]));
    return spawnMaestro(maestro, args, env, null);
  }

  printSchedule(phases, devices);
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gymido-e2e-'));
  const ctx = { platform, maestro, maestroArgs, env, logDir };
  const results = [];
  const runStart = Date.now();
  for (const [i, phase] of phases.entries()) {
    if (session.interrupted) {
      break;
    }
    const phaseStart = Date.now();
    const laneResults = await Promise.all(phase.lanes.map((lane, j) => runLane(lane, devices[j], ctx)));
    results.push(...laneResults.flat());
    console.log(`run-e2e: phase ${i + 1} (${phase.name}) done in ${Math.round((Date.now() - phaseStart) / 1000)} s.`);
  }
  const failed = results.filter((r) => r.code !== 0);
  console.log(
    `run-e2e: ${results.length - failed.length}/${suite.length} passed on ${devices.length} devices in ${Math.round((Date.now() - runStart) / 1000)} s` +
      `${failed.length ? `; failed: ${failed.map((r) => r.name).join(', ')}` : ''}. Logs: ${logDir}`,
  );
  return failed.length || results.length < suite.length ? 1 : 0;
}

if (require.main === module) {
  // Ctrl-C reaches Maestro directly (same terminal process group); SIGTERM is
  // passed on. Either way the run ends and cleanup() follows.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      if (session.interrupted) {
        return;
      }
      session.interrupted = signal;
      console.error(`run-e2e: ${signal}, stopping…`);
      for (const child of session.children) {
        child.kill(signal);
      }
    });
  }
  main(process.argv)
    .catch((error) => {
      console.error(`run-e2e: ${error.userFacing ? error.message : error.stack}`);
      return 1;
    })
    .then(async (code) => {
      await cleanup();
      process.exit(session.interrupted && code === 0 ? 128 + os.constants.signals[session.interrupted] : code);
    });
}

module.exports = {
  splitArgs,
  listFlowFiles,
  resolveFlows,
  hasEnv,
  pickSimulator,
  emulatorSerials,
  isDebuggable,
  planBuild,
  suiteFlows,
  flowAccounts,
  flowsConflict,
  scheduleSuite,
  scheduleConflicts,
  deviceName,
  newestAppSourceMtime,
  DEFAULT_IOS_SIMULATOR,
  DEFAULT_SHARDS,
  credentialsFromFile,
  takeCredentialArgs,
  requiredCredentials,
  credentialEnv,
  session,
  startedHere,
  keptRunning,
  cleanup,
};
