#!/usr/bin/env node
// Prod-safety guard for device runs (Maestro flows, shot tools). Before any
// automation drives the app, check that the API it will ACTUALLY use is a
// local test API on gymido_testdb. Allowlist, not a denylist: anything that is
// not localhost / 127.0.0.1 / 10.0.2.2 on :8080 (QA's test stack) or :8091
// (owner preview) is refused, including a missing or unreadable value.
//
// Where the runtime API comes from:
//   Release (the JS bundle is embedded in the APK / .app): the embedded
//     app.config. Metro is not involved.
//   Dev client (no embedded bundle): the manifest Metro serves, NOT the
//     embedded app.config. So Metro is ALWAYS checked (default :8081, the
//     port the flows open); --no-metro is refused for a dev client. A build
//     whose kind can't be read counts as a dev client.
//
//   node e2e/scripts/apiGuard.js <emulator-serial | simulator-udid> [--metro <port> | --no-metro]
//
// Exit 0 = safe; 3 = refused (never run the flow); 2 = usage error.
//
// Residual (not covered): the dev client can be pointed at a different Metro
// after the check (dev menu, or a deep link to another port), and app code
// could override the configured URL at runtime. Flows open Metro on :8081;
// when a run uses another port, pass --metro <that port>.
const { execFileSync } = require('child_process');
const nodeFs = require('fs');
const os = require('os');
const path = require('path');

const APP_ID = 'com.gymido.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);
const LOCAL_PORTS = new Set(['8080', '8091']);
const DEFAULT_METRO_PORT = '8081';
const UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

function checkApiBase(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, reason: 'no API base in the app config' };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'unreadable API base' };
  }
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    return { ok: false, reason: `${parsed.hostname} is not a local test API` };
  }
  if (!LOCAL_PORTS.has(parsed.port)) {
    return { ok: false, reason: `port ${parsed.port || '(default)'} is not 8080 or 8091` };
  }
  return { ok: true, host: parsed.host };
}

// An embedded app.config ({ extra }) or a dev-server manifest
// ({ extra: { expoClient: { extra } } }); a multipart manifest falls back to
// the first "apiBaseUrl" value in the text.
function apiBaseFromConfig(text) {
  try {
    const json = JSON.parse(text);
    return json?.extra?.apiBaseUrl ?? json?.extra?.expoClient?.extra?.apiBaseUrl ?? null;
  } catch {
    const match = /"apiBaseUrl"\s*:\s*"([^"]*)"/.exec(String(text));
    return match ? match[1] : null;
  }
}

// Emulators and simulators only (owner rule): a physical phone is never a target.
function deviceKind(device) {
  if (/^emulator-\d+$/.test(device)) {
    return 'android';
  }
  return UDID.test(device) ? 'ios' : 'unsupported';
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// { config: app.config text | null, embedded: true (Release) | false (dev client) | null (unknown) }
function installedConfig(device, { run: exec = run, fs = nodeFs } = {}) {
  if (deviceKind(device) === 'android') {
    const apk = exec('adb', ['-s', device, 'shell', 'pm', 'path', APP_ID]).split('\n')[0].replace('package:', '').trim();
    if (!apk) {
      return { config: null, embedded: null };
    }
    const tmp = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'apiguard-'));
    const local = path.join(tmp, 'app.apk');
    try {
      exec('adb', ['-s', device, 'pull', apk, local]);
      const config = exec('unzip', ['-p', local, 'assets/app.config']) || null;
      const embedded = /assets\/index\.android\.bundle/.test(exec('unzip', ['-l', local]));
      return { config, embedded };
    } finally {
      nodeFs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  const container = exec('xcrun', ['simctl', 'get_app_container', device, APP_ID]).trim();
  if (!container) {
    return { config: null, embedded: null };
  }
  let config = null;
  try {
    config = fs.readFileSync(path.join(container, 'EXConstants.bundle', 'app.config'), 'utf8');
  } catch {
    config = null;
  }
  return { config, embedded: fs.existsSync(path.join(container, 'main.jsbundle')) };
}

function metroManifest(port, platform) {
  return run('curl', ['-s', '--max-time', '10', '-H', `expo-platform: ${platform}`, '-H', 'accept: application/expo+json,application/json', `http://localhost:${port}/`]);
}

function parseArgs(argv) {
  const [device, ...rest] = argv;
  if (!device) {
    return null;
  }
  if (rest.length === 0) {
    return { device, metroPort: null, noMetro: false };
  }
  if (rest.length === 1 && rest[0] === '--no-metro') {
    return { device, metroPort: null, noMetro: true };
  }
  if (rest.length === 2 && rest[0] === '--metro' && /^\d+$/.test(rest[1])) {
    return { device, metroPort: rest[1], noMetro: false };
  }
  return null;
}

const SYSTEM = {
  readInstalled: (device) => installedConfig(device),
  metroManifest,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
};

function main(argv, deps = SYSTEM) {
  const args = parseArgs(argv);
  if (!args) {
    deps.error('usage: apiGuard.js <emulator-serial | simulator-udid> [--metro <port> | --no-metro]');
    return 2;
  }
  const { device, metroPort, noMetro } = args;
  const refuse = (reason) => {
    deps.error(`API guard: REFUSED on ${device} (${reason})`);
    return 3;
  };
  const kind = deviceKind(device);
  if (kind === 'unsupported') {
    return refuse('not an emulator serial or simulator UDID; physical devices are never test targets');
  }

  let installed;
  try {
    installed = deps.readInstalled(device);
  } catch {
    installed = { config: null, embedded: null };
  }
  const embeddedResult = checkApiBase(installed.config ? apiBaseFromConfig(installed.config) : null);
  if (!embeddedResult.ok) {
    return refuse(`installed app: ${embeddedResult.reason}`);
  }
  deps.log(`API guard: OK on ${device} (installed app: ${embeddedResult.host})`);

  const devClient = installed.embedded !== true;
  if (!devClient && !metroPort) {
    deps.log(`API guard: Release build on ${device}; the embedded config is the runtime API`);
    return 0;
  }
  if (devClient && noMetro) {
    return refuse('dev client: its runtime API comes from Metro, so --no-metro is not allowed');
  }
  const port = metroPort ?? DEFAULT_METRO_PORT;
  let manifest = null;
  try {
    manifest = deps.metroManifest(port, kind);
  } catch {
    manifest = null;
  }
  const metroResult = checkApiBase(manifest ? apiBaseFromConfig(manifest) : null);
  if (!metroResult.ok) {
    return refuse(`Metro :${port}: ${metroResult.reason}`);
  }
  deps.log(`API guard: OK on ${device} (Metro :${port}: ${metroResult.host})`);
  return 0;
}

module.exports = { checkApiBase, apiBaseFromConfig, deviceKind, installedConfig, main };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
