import Constants from 'expo-constants';
import { Platform } from 'react-native';

const present = (value) => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());

// T-90 (UX spec): Profile's footer "Version 2.0.7 (12)", read at runtime from
// the app config (app.config.js `version` + ios.buildNumber /
// android.versionCode). A missing build drops to "Version 2.0.7"; no version
// at all → null (the line is hidden), never "undefined".
// `label` is the screen-reader text: "App version 2.0.7, build 12".
export function appVersion(config = Constants.expoConfig, os = Platform.OS) {
  const version = present(config?.version);
  if (!version) {
    return null;
  }
  const build = present(os === 'ios' ? config?.ios?.buildNumber : os === 'android' ? config?.android?.versionCode : null);
  return build
    ? { text: `Version ${version} (${build})`, label: `App version ${version}, build ${build}` }
    : { text: `Version ${version}`, label: `App version ${version}` };
}

// T-90 addendum (owner): the second line is the server's BUILD only,
// "Server 8a12bd7" from GET /health data.build (its version is hard-coded, so
// it is not shown). "dev" (non-CI images) or a missing build → null (hidden).
export function serverVersion(health) {
  const build = present(health?.build);
  if (!build || build.toLowerCase() === 'dev') {
    return null;
  }
  return { text: `Server ${build}`, label: `Server build ${build}` };
}
