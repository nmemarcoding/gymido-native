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

// T-90 addendum: the second line "Server 4.1.0 (8a12bd7)" from GET /health's
// data.version + data.build. "dev" (non-CI images) or a missing build drops
// to "Server 4.1.0"; no version → null (hidden).
export function serverVersion(health) {
  const version = present(health?.version);
  if (!version) {
    return null;
  }
  const raw = present(health?.build);
  const build = raw && raw.toLowerCase() !== 'dev' ? raw : null;
  return build
    ? { text: `Server ${version} (${build})`, label: `Server version ${version}, build ${build}` }
    : { text: `Server ${version}`, label: `Server version ${version}` };
}
