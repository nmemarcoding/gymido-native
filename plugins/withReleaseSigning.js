// Release signing for Android. The template signs release builds with
// debug.keystore, a key that ships with every React Native template, so anyone
// could sign an "update" of com.gymido.app with it and take over the app's
// data. This plugin gives the release build its own signing config, read from
// Gradle properties the owner keeps outside the repo (~/.gradle/gradle.properties):
//
//   GYMIDO_UPLOAD_STORE_FILE=/absolute/path/to/gymido-upload.keystore
//   GYMIDO_UPLOAD_STORE_PASSWORD=…
//   GYMIDO_UPLOAD_KEY_ALIAS=gymido-upload
//   GYMIDO_UPLOAD_KEY_PASSWORD=…
//
// Fail closed: any :app release task stops with an error when the key isn't
// configured, instead of falling back to the debug key. Debug builds are
// unchanged.
//
// Internal test builds only (owner decision, 23 Oct 2026; no public release
// yet): GYMIDO_ALLOW_DEBUG_SIGNING=1 (Gradle property or environment, set by
// `npm run apk`) signs a release build with the debug key, with a loud
// warning. Never for a public/Play Store build.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (findProperty('GYMIDO_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('GYMIDO_UPLOAD_STORE_FILE'))
                storePassword findProperty('GYMIDO_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('GYMIDO_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('GYMIDO_UPLOAD_KEY_PASSWORD')
            }
        }`;

const FAIL_CLOSED = `
// Gymido: release builds need the owner's upload key (plugins/withReleaseSigning.js).
def gymidoAllowDebugSigning = findProperty('GYMIDO_ALLOW_DEBUG_SIGNING') == '1' || System.getenv('GYMIDO_ALLOW_DEBUG_SIGNING') == '1'
gradle.taskGraph.whenReady { graph ->
    def releaseTask = graph.allTasks.any { it.project == project && it.name.contains('Release') }
    if (releaseTask && !findProperty('GYMIDO_UPLOAD_STORE_FILE')) {
        if (!gymidoAllowDebugSigning) {
            throw new GradleException('Release build without the Gymido upload key. Set GYMIDO_UPLOAD_STORE_FILE, GYMIDO_UPLOAD_STORE_PASSWORD, GYMIDO_UPLOAD_KEY_ALIAS and GYMIDO_UPLOAD_KEY_PASSWORD in ~/.gradle/gradle.properties.')
        }
        logger.warn('INTERNAL TEST BUILD: signed with the public debug key. Not for public distribution.')
    }
}
`;

function applyReleaseSigning(gradle) {
  if (gradle.includes('GYMIDO_UPLOAD_STORE_FILE')) {
    return gradle;
  }
  const debugConfig = /(signingConfigs \{\s*debug \{[^}]*\})/;
  const releaseUsesDebug = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;
  if (!debugConfig.test(gradle) || !releaseUsesDebug.test(gradle)) {
    throw new Error('withReleaseSigning: app/build.gradle no longer matches the template; update the plugin');
  }
  return (
    gradle
      .replace(debugConfig, `$1${RELEASE_SIGNING}`)
      .replace(releaseUsesDebug, "$1signingConfig(findProperty('GYMIDO_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug)") + FAIL_CLOSED
  );
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = applyReleaseSigning(mod.modResults.contents);
    return mod;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;
