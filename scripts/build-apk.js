#!/usr/bin/env node
// One command for a RELEASE APK (production API and Auth0, JS embedded, no
// Metro). Re-typed from the 21 Oct build's script (read as reference only),
// now for release use.
//
//   npm run apk                    build → builds/gymido-release-<date>.apk
//   npm run apk -- --install       …and install it (USB device first, else a
//                                  running emulator)
//   npm run apk -- --clean         regenerate android/ first (prebuild --clean)
//
// Signing: the owner's upload key when GYMIDO_UPLOAD_* is set (in
// ~/.gradle/gradle.properties). Otherwise, FOR NOW (no public release yet,
// owner decision 23 Oct 2026), the public debug key with a loud warning; the
// raw gradle path still fails closed without GYMIDO_ALLOW_DEBUG_SIGNING=1.
//
// Sets JAVA_HOME to JDK 17 and ANDROID_HOME when they aren't, writes
// .env.production from .env.example's public values when it is missing, and
// generates android/ when it doesn't exist (it is gitignored).

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APK = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
const BUILDS = path.join(ROOT, 'builds');
const DEBUG_KEY_WARNING = 'INTERNAL TEST BUILD: signed with the public debug key. Not for public distribution.';

// builds/gymido-release-2026-10-09.apk; a second build that day gets the time.
function apkName(date, taken = () => false) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const base = `gymido-release-${day}.apk`;
  return taken(base) ? `gymido-release-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.apk` : base;
}

// `adb devices` output → the serial to install on: a USB device first, else
// a running emulator; null when there is none.
function pickInstallTarget(adbDevicesOutput) {
  const ready = adbDevicesOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
  return ready.find((serial) => !serial.startsWith('emulator-')) ?? ready[0] ?? null;
}

// True when the owner's upload key is configured for Gradle.
function hasUploadKey(env, gradleProperties) {
  return Boolean(env.ORG_GRADLE_PROJECT_GYMIDO_UPLOAD_STORE_FILE) || /^\s*GYMIDO_UPLOAD_STORE_FILE\s*=\s*\S/m.test(gradleProperties);
}

function javaMajor(javaHome) {
  const out = spawnSync(path.join(javaHome, 'bin/java'), ['-version'], { encoding: 'utf8' });
  const match = `${out.stderr}${out.stdout}`.match(/version "(\d+)/);
  return match ? Number(match[1]) : null;
}

function run(cmd, args, options) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    console.error(`apk: \`${cmd} ${args.join(' ')}\` failed.`);
    process.exit(result.status || 1);
  }
}

function readFileOr(file, fallback) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

function main(argv) {
  const env = { ...process.env, APP_ENV: 'production' };
  if (!env.JAVA_HOME || javaMajor(env.JAVA_HOME) !== 17) {
    try {
      env.JAVA_HOME = execFileSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' }).trim();
    } catch {
      console.error('apk: JDK 17 not found (`/usr/libexec/java_home -v 17`). Install it: brew install openjdk@17');
      return 1;
    }
  }
  env.ANDROID_HOME = env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk');
  console.log(`apk: JDK ${env.JAVA_HOME}`);

  const envFile = path.join(ROOT, '.env.production');
  if (!fs.existsSync(envFile)) {
    const publicValues = readFileOr(path.join(ROOT, '.env.example'), '')
      .split('\n')
      .filter((line) => /^(API_BASE_URL|AUTH0_DOMAIN|AUTH0_CLIENT_ID|AUTH0_AUDIENCE)=/.test(line));
    fs.writeFileSync(envFile, `${publicValues.join('\n')}\n`);
    console.log('apk: wrote .env.production from .env.example (public values only).');
  }

  if (argv.includes('--clean') || !fs.existsSync(path.join(ROOT, 'android'))) {
    console.log('apk: generating android/ (production)…');
    run('npx', ['expo', 'prebuild', '--clean', '--platform', 'android'], { cwd: ROOT, env });
  }

  const gradleProperties = readFileOr(path.join(os.homedir(), '.gradle/gradle.properties'), '');
  if (hasUploadKey(env, gradleProperties)) {
    console.log('apk: signing with the upload key from ~/.gradle/gradle.properties.');
  } else {
    env.GYMIDO_ALLOW_DEBUG_SIGNING = '1';
    console.warn(`apk: ${DEBUG_KEY_WARNING}`);
  }

  console.log('apk: building the release APK (production)…');
  run('./gradlew', ['assembleRelease'], { cwd: path.join(ROOT, 'android'), env: { ...env, NODE_ENV: 'production' } });

  fs.mkdirSync(BUILDS, { recursive: true });
  const target = path.join(BUILDS, apkName(new Date(), (name) => fs.existsSync(path.join(BUILDS, name))));
  fs.copyFileSync(APK, target);
  console.log(`apk: done → ${path.relative(ROOT, target)}`);

  if (argv.includes('--install')) {
    const adb = path.join(env.ANDROID_HOME, 'platform-tools/adb');
    const serial = pickInstallTarget(execFileSync(adb, ['devices'], { encoding: 'utf8' }));
    if (!serial) {
      console.error('apk: no device to install on. Connect the phone with USB debugging on (or start an emulator), then: adb install -r ' + target);
      return 1;
    }
    const result = spawnSync(adb, ['-s', serial, 'install', '-r', target], { encoding: 'utf8' });
    const output = `${result.stdout}${result.stderr}`;
    if (result.status !== 0 || /Failure/.test(output)) {
      if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(output)) {
        console.error(
          `apk: ${serial} has Gymido installed with a different signature (e.g. a dev build). Uninstall it first (this clears the app's data and sign-in):\n  adb -s ${serial} uninstall com.gymido.app\nthen run: npm run apk -- --install`
        );
      } else {
        console.error(`apk: install on ${serial} failed:\n${output.trim()}`);
      }
      return 1;
    }
    console.log(`apk: installed on ${serial}.`);
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { apkName, hasUploadKey, pickInstallTarget };
