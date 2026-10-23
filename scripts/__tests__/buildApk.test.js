const { apkName, hasUploadKey, pickInstallTarget } = require('../build-apk');

describe('apkName', () => {
  const date = new Date(2026, 9, 9, 7, 5);

  test('one build a day is named by the date', () => {
    expect(apkName(date)).toBe('gymido-release-2026-10-09.apk');
  });

  test('a second build that day gets the time, so nothing is overwritten', () => {
    expect(apkName(date, (name) => name === 'gymido-release-2026-10-09.apk')).toBe('gymido-release-2026-10-09-0705.apk');
  });
});

describe('pickInstallTarget', () => {
  test('prefers a USB device over a running emulator', () => {
    const out = 'List of devices attached\nemulator-5554\tdevice\n1A2B3C\tdevice\n';
    expect(pickInstallTarget(out)).toBe('1A2B3C');
  });

  test('falls back to an emulator, skips unauthorized/offline ones, and returns null when none is ready', () => {
    expect(pickInstallTarget('List of devices attached\n1A2B3C\tunauthorized\nemulator-5556\tdevice\n')).toBe('emulator-5556');
    expect(pickInstallTarget('List of devices attached\n\n')).toBeNull();
  });
});

describe('hasUploadKey', () => {
  test('reads the upload key from gradle.properties or the Gradle env property', () => {
    expect(hasUploadKey({}, 'GYMIDO_UPLOAD_STORE_FILE=/Users/me/gymido-keys/gymido-upload.keystore\n')).toBe(true);
    expect(hasUploadKey({ ORG_GRADLE_PROJECT_GYMIDO_UPLOAD_STORE_FILE: '/k' }, '')).toBe(true);
    expect(hasUploadKey({}, '# GYMIDO_UPLOAD_STORE_FILE=\norg.gradle.jvmargs=-Xmx2g\n')).toBe(false);
  });
});
