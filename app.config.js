const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// localtest-* point a dev client at a local API (gitignored .env files):
// Android emulators reach the host at 10.0.2.2, iOS simulators at localhost.
const APP_ENVS = ['development', 'staging', 'production', 'localtest-android', 'localtest-ios'];
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
      // app-shell O2: iPhone portrait, iPad all four and split view.
      requireFullScreen: false,
      infoPlist: {
        UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
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
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    // Registers the {bundleId}.auth0 callback scheme on both platforms.
    // The rest-countdown widget is RN-SPEC-time O13 (modules/rest-countdown).
    // expo-audio + expo-notifications: the rest-done sound and O4 alerts
    // (RN-SPEC-time §7.2, O4); the notification icon is the monochrome mark.
    plugins: [
      ['react-native-auth0', { domain: env.AUTH0_DOMAIN }],
      // Playback of a short foreground beep only: no microphone, no
      // background audio (each default would add a store-review flag).
      ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }],
      ['expo-notifications', { icon: './assets/android-icon-monochrome.png', color: '#f4b400' }],
      './plugins/withRestCountdownWidget',
      // iOS 27 scene life cycle (plugins/withSceneLifecycle.js).
      './plugins/withSceneLifecycle',
      // LAST: strips expo-notifications' push entitlement after every other
      // mod (a free Apple team can't sign aps-environment; local
      // notifications don't need it). See plugins/withoutPushCapability.js.
      './plugins/withoutPushCapability',
    ],
    // Read at runtime through src/shared/config/env.js. Not secret.
    // Unset values are left undefined (omitted): Expo serializes null as {}.
    extra: {
      appEnv: APP_ENV,
      apiBaseUrl: env.API_BASE_URL || undefined,
      auth0: {
        domain: env.AUTH0_DOMAIN || undefined,
        clientId: env.AUTH0_CLIENT_ID || undefined,
        audience: env.AUTH0_AUDIENCE || undefined,
      },
    },
  },
};
