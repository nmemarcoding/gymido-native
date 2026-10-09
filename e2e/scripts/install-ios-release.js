#!/usr/bin/env node
// Builds the iOS RELEASE app (JS bundled, no Metro) against the development
// tenant and installs it on every E2E simulator ("Gymido E2E iPhone", " 2",
// " 3", … up to E2E_SHARDS), so `npm run e2e:ios` drives the release build.
// Simulator builds are signed ad hoc by Xcode, which the Keychain accepts; no
// Apple team or device signing is involved.
//
//   npm run e2e:ios:release
//
// Simulators that don't exist yet are skipped: run-e2e creates them and copies
// the app from the first one. Rebuild after JS changes; run-e2e warns when the
// installed release build is older than the app's latest source change.

const { execFileSync, spawnSync } = require('child_process');

const { pickSimulator, deviceName, DEFAULT_IOS_SIMULATOR, DEFAULT_SHARDS } = require('./run-e2e');

const APP_ID = 'com.gymido.app';

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function simulators() {
  return JSON.parse(run('xcrun', ['simctl', 'list', 'devices', '-j']));
}

function main() {
  process.env.DEVELOPER_DIR = process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer';
  const base = process.env.E2E_IOS_SIMULATOR || DEFAULT_IOS_SIMULATOR;
  const count = Math.max(1, Number.parseInt(process.env.E2E_SHARDS || String(DEFAULT_SHARDS), 10) || 1);
  const first = pickSimulator(simulators(), base);
  if (!first) {
    console.error(`install-ios-release: no simulator named "${base}".`);
    return 1;
  }
  const bootedBefore = new Set(
    Object.values(simulators().devices)
      .flat()
      .filter((d) => d.state === 'Booted')
      .map((d) => d.udid),
  );

  console.log(`install-ios-release: building Release and installing it on "${first.name}" (several minutes)…`);
  const build = spawnSync('npm', ['run', 'ios', '--', '--configuration', 'Release', '--device', first.udid, '--no-bundler'], {
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    console.error('install-ios-release: the Release build failed (see above).');
    return build.status || 1;
  }
  const app = run('xcrun', ['simctl', 'get_app_container', first.udid, APP_ID, 'app']).trim();

  for (let i = 1; i < count; i += 1) {
    const sim = pickSimulator(simulators(), deviceName(base, i, 'ios'));
    if (!sim) {
      continue;
    }
    if (sim.state !== 'Booted') {
      spawnSync('xcrun', ['simctl', 'bootstatus', sim.udid, '-b'], { stdio: 'ignore' });
    }
    run('xcrun', ['simctl', 'install', sim.udid, app]);
    console.log(`install-ios-release: installed on "${sim.name}".`);
  }

  // Leave the machine as we found it: shut down what this script booted.
  for (const d of Object.values(simulators().devices).flat()) {
    if (d.state === 'Booted' && d.name.startsWith(base) && !bootedBefore.has(d.udid)) {
      run('xcrun', ['simctl', 'shutdown', d.udid]);
    }
  }
  console.log('install-ios-release: done. `npm run e2e:ios` now uses the release build (no Metro).');
  return 0;
}

if (require.main === module) {
  process.exit(main());
}
