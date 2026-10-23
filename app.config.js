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
// Builds handed to anyone (staging testers, production) get the release
// hardening; development and localtest dev clients keep the dev-server bits.
const RELEASE_ENV = APP_ENV === 'production' || APP_ENV === 'staging';

// The Auth0 domain is baked into the native build, so fail early without it.
for (const key of ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID']) {
  if (!env[key]) {
    throw new Error(`[app.config] ${key} is not set. Copy .env.example to .env.${APP_ENV}.`);
  }
}

// Kept in release: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS,
// SCHEDULE_EXACT_ALARM (rest alerts, A2), VIBRATE, WAKE_LOCK and
// MODIFY_AUDIO_SETTINGS (the rest-done beep).
const RELEASE_BLOCKED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'com.google.android.c2dm.permission.RECEIVE',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
  'android.permission.READ_APP_BADGE',
  'com.sec.android.provider.badge.permission.READ',
  'com.sec.android.provider.badge.permission.WRITE',
  'com.htc.launcher.permission.READ_SETTINGS',
  'com.htc.launcher.permission.UPDATE_SHORTCUT',
  'com.sonyericsson.home.permission.BROADCAST_BADGE',
  'com.sonymobile.home.permission.PROVIDER_INSERT_BADGE',
  'com.anddoes.launcher.permission.UPDATE_COUNT',
  'com.majeur.launcher.permission.UPDATE_BADGE',
  'com.huawei.android.launcher.permission.CHANGE_BADGE',
  'com.huawei.android.launcher.permission.READ_SETTINGS',
  'com.huawei.android.launcher.permission.WRITE_SETTINGS',
  'com.oppo.launcher.permission.READ_SETTINGS',
  'com.oppo.launcher.permission.WRITE_SETTINGS',
  'me.everything.badger.permission.BADGE_COUNT_READ',
  'me.everything.badger.permission.BADGE_COUNT_WRITE',
];

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
      // No cloud/device-transfer backup of app data (sign-in state, preferences).
      allowBackup: false,
      // Permissions the app never uses, added by the template (overlay,
      // storage) or by libraries (FCM push, auth0 biometrics, boot receiver,
      // install referrer, launcher badges). Release builds drop them; dev
      // builds keep the overlay for the dev menu.
      blockedPermissions: RELEASE_ENV ? RELEASE_BLOCKED_PERMISSIONS : [],
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
      // Release builds drop the dev client's local-network keys (plugins/withReleaseHardening.js).
      ['./plugins/withReleaseHardening', { enabled: RELEASE_ENV }],
      // Android release builds use the owner's upload key, never the template debug key.
      './plugins/withReleaseSigning',
      // The rest-end alert is Time Sensitive so Siri can announce it (iOS).
      './plugins/withTimeSensitiveNotifications',
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
