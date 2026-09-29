const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const APP_ENVS = ['development', 'staging', 'production'];
const APP_ENV = process.env.APP_ENV || 'development';

if (!APP_ENVS.includes(APP_ENV)) {
  throw new Error(`Unknown APP_ENV "${APP_ENV}". Expected one of: ${APP_ENVS.join(', ')}.`);
}

// Parse the env file into a local object instead of process.env. Expo CLI
// preloads .env.development into process.env on its own, which would otherwise
// shadow staging/production values. Falls back to process.env (e.g. CI).
function loadEnv(appEnv) {
  const file = path.resolve(__dirname, `.env.${appEnv}`);
  if (fs.existsSync(file)) {
    return dotenv.parse(fs.readFileSync(file));
  }
  console.warn(`[app.config] ${path.basename(file)} not found, reading config from process.env.`);
  return process.env;
}

const env = loadEnv(APP_ENV);

// Web parity (RN-SPEC-time §1.3): every web build loads .env.production, so
// every non-development native build reinterprets backend timestamps as
// Los Angeles wall-clock. Only local development leaves it unset.
const API_SERVER_TZ_DEFAULTS = { staging: 'America/Los_Angeles', production: 'America/Los_Angeles' };

// The Auth0 domain is baked into the native build, so fail early without it.
for (const key of ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID']) {
  if (!env[key]) {
    throw new Error(`[app.config] ${key} is not set. Copy .env.example to .env.${APP_ENV}.`);
  }
}

module.exports = {
  expo: {
    name: 'Gymido',
    slug: 'gymido-native',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.gymido.app',
      supportsTablet: true,
      // Owner decision O2: phones stay portrait (from `orientation` above);
      // iPads rotate to any orientation.
      infoPlist: {
        'UISupportedInterfaceOrientations~ipad': [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationPortraitUpsideDown',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
      },
    },
    android: {
      package: 'com.gymido.app',
      // RN-SPEC-profile-create §10: the window resizes for the keyboard.
      softwareKeyboardLayoutMode: 'resize',
      // A2: exact rest alerts, offered once. Never USE_EXACT_ALARM, which Play
      // restricts to alarm-clock and calendar apps.
      permissions: ['android.permission.SCHEDULE_EXACT_ALARM'],
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    // Registers the {bundleId}.auth0 callback scheme on both platforms.
    plugins: [
      ['react-native-auth0', { domain: env.AUTH0_DOMAIN }],
      './plugins/withForcedLightTheme',
      './plugins/withSceneLifecycle',
      // O13: the rest countdown's widget extension (iOS Lock Screen). No App
      // Group, no push, no entitlements at all.
      './plugins/withRestCountdownWidget',
      // Keep in this position. Plugin order decides which entitlements mod runs
      // first, so a moved or new plugin can bring aps-environment back (the
      // removed expo-widgets did); restCountdownPrebuild.test.js checks it.
      './plugins/withoutPushCapability',
    ],
    // Read at runtime through src/shared/config/env.js. Not secret.
    // Unset values are left undefined (omitted): Expo serializes null as {}.
    extra: {
      eas: {
        projectId: '5135bb59-a3be-4a09-93cb-057c12fe0506',
      },
      appEnv: APP_ENV,
      apiBaseUrl: env.API_BASE_URL || undefined,
      apiServerTz: env.API_SERVER_TZ || API_SERVER_TZ_DEFAULTS[APP_ENV] || undefined,
      auth0: {
        domain: env.AUTH0_DOMAIN || undefined,
        clientId: env.AUTH0_CLIENT_ID || undefined,
        audience: env.AUTH0_AUDIENCE || undefined,
      },
    },
  },
};
