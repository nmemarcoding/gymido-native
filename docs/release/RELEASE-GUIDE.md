# Gymido mobile — release guide (owner)

> Paths: the repo is at `~/Desktop/coding/gymido-native`. Android is built in a throwaway worktree, `~/Desktop/coding/gymido-all/worktrees/gymido-native-release-<ver>`; the APK and its `NOTES.md` are kept in `~/Desktop/coding/gymido-all/releases/<ver>/`, and the worktree is removed afterwards. iOS is run from the main checkout.

Build ref: the release SHA (`<sha>`) on `main`. `<ver>` is `version` in `app.config.js`; `<build>` is its iOS `buildNumber`, equal to the Android `versionCode`. Don't copy the numbers here. Android's `npm run apk` always regenerates `android/`; every iOS release prebuild regenerates `ios/` (`--clean`).

---

## 0. Android upload key: REQUIRED before any public/Play Store release (not needed for internal test builds now)

**For now (no public release yet):** `npm run apk` signs internal test builds with the public debug key and prints "INTERNAL TEST BUILD: signed with the public debug key. Not for public distribution." You don't need a key today.

**Before any public release:** create the upload key below. `npm run apk` then uses it automatically. The raw gradle path never silently uses the debug key: without the key, it stops with "Release build without the Gymido upload key…" unless `GYMIDO_ALLOW_DEBUG_SIGNING=1` is set.

1. **Create the keystore.** keytool asks for a password and your name. Use **the same password** for the store and the key (PKCS12 requires that).

   ```sh
   mkdir -p ~/gymido-keys && chmod 700 ~/gymido-keys
   /opt/homebrew/opt/openjdk@17/bin/keytool -genkeypair -v -storetype PKCS12 \
     -keystore ~/gymido-keys/gymido-upload.keystore \
     -alias gymido-upload -keyalg RSA -keysize 2048 -validity 10000
   chmod 600 ~/gymido-keys/gymido-upload.keystore
   ```

2. **Add these four lines to `~/.gradle/gradle.properties`** (create the file if it's missing). Then `chmod 600 ~/.gradle/gradle.properties`.

   ```properties
   GYMIDO_UPLOAD_STORE_FILE=/Users/<your-user>/gymido-keys/gymido-upload.keystore
   GYMIDO_UPLOAD_STORE_PASSWORD=<the password>
   GYMIDO_UPLOAD_KEY_ALIAS=gymido-upload
   GYMIDO_UPLOAD_KEY_PASSWORD=<the same password>
   ```

   This file lives in your home folder, never in the repo. Don't commit it, paste it or share it.

3. > ⚠️ **BACK UP THE KEY NOW.** Store `gymido-upload.keystore` and its password together in your password manager or an encrypted backup.
   > **If you lose either one, you can never ship an update to installed apps.** On the Play Store that means publishing under a **new app id** and losing every existing install. (Play App Signing can reset a lost upload key, but only if you enrolled in it beforehand.)

---

## 1. Android: build the APK

```sh
cd ~/Desktop/coding/gymido-native && git fetch && \
  git worktree add --detach ~/Desktop/coding/gymido-all/worktrees/gymido-native-release-<ver> <sha>
cd ~/Desktop/coding/gymido-all/worktrees/gymido-native-release-<ver> && npm ci && npm run apk
```

What `npm run apk` does:
- picks JDK 17 (`/usr/libexec/java_home -v 17`) and the Android SDK by itself. The machine's default JDK 25 fails in CMake, so a raw Gradle `assembleRelease` needs `JAVA_HOME=$(/usr/libexec/java_home -v 17)`;
- writes `.env.production` from the public values if it's missing;
- always regenerates `android/` for production, so a dev prebuild never leaks into a release;
- signs the build (see §0);
- copies the APK to the worktree's `builds/gymido-release-<date>.apk`.

Then, by hand:
1. Keep the APK and write its notes:
   ```sh
   mkdir -p ~/Desktop/coding/gymido-all/releases/<ver>
   cp builds/gymido-release-<date>.apk ~/Desktop/coding/gymido-all/releases/<ver>/gymido-<ver>-<build>.apk
   ```
   `releases/<ver>/NOTES.md` records the release SHA, the changes, known issues, the APK's sha256 and the checks done.
2. Remove the worktree (build output is several GB):
   `cd ~/Desktop/coding/gymido-native && git worktree remove ~/Desktop/coding/gymido-all/worktrees/gymido-native-release-<ver>`

Install: `adb install -r ~/Desktop/coding/gymido-all/releases/<ver>/gymido-<ver>-<build>.apk` on the phone connected by USB (USB debugging on), or on a running emulator. (`npm run apk -- --install` in the worktree builds and installs in one go.) A newer release signed with the same key updates in place and keeps the sign-in.

If a **dev build** of Gymido is on the phone, the signatures differ and the install is refused: `adb uninstall com.gymido.app` first. Uninstalling clears the app's sign-in.

> **Local-test Release builds** (APP_ENV `localtest-*`, used for QA on the test stack) allow plain HTTP to reach the
> local test API (`withLocalTestCleartext`). Never share or install a localtest APK outside the test stack; store builds
> are always `production` (HTTPS only).

## 2. (reference) Check the APK

- Signer: `~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs <apk>`. Internal builds show `CN=Android Debug`; with your upload key it shows your name.
- **Version check:** `~/Library/Android/sdk/build-tools/36.0.0/aapt2 dump badging <apk> | grep versionCode` must match `version` / `versionCode` in `app.config.js`. Use your installed build-tools version in the path (`ls ~/Library/Android/sdk/build-tools`). On the phone after installing: `adb shell dumpsys package com.gymido.app | grep -E 'versionCode|versionName'`.

## 3. iOS: install on your iPhone (free Apple ID team)

Bundle IDs your personal team will register:
- the app: **`com.gymido.app`**;
- the Live Activity extension: **`com.gymido.app.RestCountdown`**.

**What decides "release":** the Xcode **build configuration**. A Release-configuration build never shows the Expo dev launcher. Debug always opens the "Development servers" screen.

### Mobile prepares (every release)

`~/Desktop/coding/gymido-native` is the release checkout (dev work happens in worktrees):
1. Fast-forward it on `main` to `<sha>`; `npm ci` if the lockfile changed.
2. `APP_ENV=production npx expo prebuild --platform ios --clean`.
3. Set the Gymido scheme's **Run** action to **Release**: `prebuild --clean` resets it to Debug.
4. Check that Info.plist shows `<ver>` (`<build>`).

### Owner steps

1. **Delete an old dev build from the iPhone** (long-press Gymido → Remove App). The dev build uses the same bundle ID. A newer release over an older one installs in place and keeps the sign-in.
2. Open `~/Desktop/coding/gymido-native/ios/Gymido.xcworkspace`.
3. Set your signing team:
   1. In the left sidebar, select the **Gymido** project.
   2. Select the **Gymido** target → **Signing & Capabilities** → set **Team** to your personal team.
   3. Do the same for the **RestCountdownWidget** target.
4. Check **Product → Scheme → Edit Scheme… → Run → Info**: **Build Configuration** is **Release**.
5. **Version check:** **Gymido** target → **General** → **Identity** shows `<ver>` and `<build>`.
6. Pick your iPhone as the run destination (top bar), then **Product → Run (⌘R)**.
   - The first time, the iPhone may ask you to trust the developer: Settings → General → VPN & Device Management → your Apple ID → Trust.

**Check:**
- **Correct:** the app opens straight to the Gymido "Log in / Sign up" card.
- **Wrong (still a Debug build):** a "Development servers" screen or a grey Tools gear. Redo step 4.

### Terminal alternative (same result)

```sh
cd ~/Desktop/coding/gymido-native && APP_ENV=production npx expo run:ios --device --configuration Release
```

### Notes
- With a free Apple ID, the app **expires after 7 days**. Rebuild with the same steps to reinstall; your data stays on the server.
- Release builds talk to the **production** API (`https://workoutapi.nimamemarzadeh.com`), so sign in with your real account.
- **Siri "Announce Notifications" for the rest alert (locked phone, AirPods/CarPlay)** needs a **paid** Apple Developer account: free (personal) teams can't sign the Time Sensitive capability. With a paid team, prebuild with `GYMIDO_IOS_TIME_SENSITIVE=1 APP_ENV=production npx expo prebuild --platform ios --clean`. The spoken cue while the app is open works on any team.

## 4. Per-release verification

Each release's checks (manifest, permissions, signing, smoke launch) are recorded in `releases/<ver>/NOTES.md`. What they check: release builds carry no dev-server keys, only the Android permissions `app.config.js` allows, `allowBackup=false`, no cleartext traffic, the JS bundle embedded (no Metro) and no push entitlement.

## Testing rest alerts on your phone

- **Locked-phone buzz:** test it **without AirPods**. With AirPods or headphones connected, iOS plays the notification sound (and Siri) in your ears and may skip the phone's haptic. That's expected platform behaviour.
- **App open at the rest end:** you get the beep, the spoken line (if on) and a buzz (if "Vibrate on rest end" is on).
- **Phone locked or on the home screen, with AirPods:** Siri can announce "Rest complete" if Announce Notifications is on for Gymido.
