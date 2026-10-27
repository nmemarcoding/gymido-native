#!/usr/bin/env node
// Prod-safety guard for device runs (Maestro flows, shot tools). Before any
// automation drives the app, check that the INSTALLED app (and, for a dev
// client, the Metro manifest) talks to a local test API on gymido_testdb.
// Allowlist, not a denylist: anything that is not localhost / 127.0.0.1 /
// 10.0.2.2 on :8080 (QA's test stack) or :8091 (owner preview) is refused,
// including a missing value.
//
//   node e2e/scripts/apiGuard.js <emulator-serial | simulator-udid> [--metro <port>]
//
// Exit 0 = safe; 3 = refused (never run the flow); 2 = usage error.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_ID = 'com.gymido.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);
const LOCAL_PORTS = new Set(['8080', '8091']);

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

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function installedConfig(device) {
  if (/^emulator-\d+$/.test(device)) {
    const apk = run('adb', ['-s', device, 'shell', 'pm', 'path', APP_ID]).split('\n')[0].replace('package:', '').trim();
    if (!apk) {
      return null;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apiguard-'));
    try {
      run('adb', ['-s', device, 'pull', apk, path.join(tmp, 'app.apk')]);
      return run('unzip', ['-p', path.join(tmp, 'app.apk'), 'assets/app.config']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  const container = run('xcrun', ['simctl', 'get_app_container', device, APP_ID]).trim();
  return fs.readFileSync(path.join(container, 'EXConstants.bundle', 'app.config'), 'utf8');
}

function metroManifest(port, platform) {
  return run('curl', ['-s', '--max-time', '10', '-H', `expo-platform: ${platform}`, '-H', 'accept: application/expo+json,application/json', `http://localhost:${port}/`]);
}

function main(argv) {
  const [device, flag, port] = argv;
  if (!device || (flag && (flag !== '--metro' || !/^\d+$/.test(port ?? '')))) {
    console.error('usage: apiGuard.js <emulator-serial | simulator-udid> [--metro <port>]');
    return 2;
  }
  const sources = [['installed app', () => installedConfig(device)]];
  if (flag) {
    sources.push([`Metro :${port}`, () => metroManifest(port, device.startsWith('emulator-') ? 'android' : 'ios')]);
  }
  for (const [name, read] of sources) {
    let text = null;
    try {
      text = read();
    } catch {
      text = null;
    }
    const result = checkApiBase(text ? apiBaseFromConfig(text) : null);
    if (!result.ok) {
      console.error(`API guard: REFUSED on ${device} (${name}: ${result.reason})`);
      return 3;
    }
    console.log(`API guard: OK on ${device} (${name}: ${result.host})`);
  }
  return 0;
}

module.exports = { checkApiBase, apiBaseFromConfig };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
