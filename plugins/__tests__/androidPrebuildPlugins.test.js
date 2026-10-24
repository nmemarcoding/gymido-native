const { applyReleaseSigning } = require('../withReleaseSigning');

// The Expo SDK 57 template's app/build.gradle signing section.
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('withReleaseSigning', () => {
  const result = applyReleaseSigning(TEMPLATE);

  it('signs release with its own config and keeps debug on the debug key', () => {
    expect(result).toMatch(/release \{\s*if \(findProperty\('GYMIDO_UPLOAD_STORE_FILE'\)\)/);
    expect(result).toMatch(/release \{\s*\/\/ Caution![^]*?signingConfig\(findProperty\('GYMIDO_UPLOAD_STORE_FILE'\) \? signingConfigs\.release : signingConfigs\.debug\)/);
    expect(result).toMatch(/debug \{\s*signingConfig signingConfigs\.debug/);
    expect(result.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
  });

  it('fails release tasks closed without the key, unless debug signing is explicitly allowed (internal builds)', () => {
    expect(result).toContain("it.name.contains('Release')");
    expect(result).toContain('throw new GradleException');
    expect(result).toContain("System.getenv('GYMIDO_ALLOW_DEBUG_SIGNING') == '1'");
    expect(result).toContain('INTERNAL TEST BUILD: signed with the public debug key. Not for public distribution.');
  });

  it('is idempotent and refuses an unknown template', () => {
    expect(applyReleaseSigning(result)).toBe(result);
    expect(() => applyReleaseSigning('android {}')).toThrow(/no longer matches/);
  });
});
