# Gymido mobile 1.0.1 — release guide (owner)

> Paths assume the repo is cloned at `~/Desktop/coding/gymido-native` and the release checkout lives at `~/gymido-release`. Adjust them to your machine.

Build ref: the tag `1.0.1` (it points at the 1.0.1 merge on `main`). Version 1.0.1, iOS build number 2, Android versionCode 2. Build in a separate checkout, so your dev setup (dev client, localtest env) stays untouched.

1.0.1 changes the build numbers in `app.config.js` (native config). Android's `npm run apk` always regenerates `android/`; for iOS, step 3.2 below ALWAYS regenerates `ios/` from the tag.

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

## 1. Android: build and install the APK (one command)

Do this once, to make the release checkout:

```sh
cd ~/Desktop/coding/gymido-native && git fetch --tags && git worktree add --detach ~/gymido-release 1.0.1
```

Then, for each build:

```sh
cd ~/gymido-release && git fetch --tags && git checkout --detach 1.0.1 && npm ci && npm run apk -- --install
```

What `npm run apk` does:
- picks JDK 17 and the Android SDK by itself;
- writes `.env.production` from the public values if it's missing;
- always regenerates `android/` for production, so a dev prebuild never leaks into a release;
- signs the build (see §0);
- copies the APK to `~/gymido-release/builds/gymido-release-<date>.apk`.

`--install` installs it on the phone connected by USB (USB debugging on), or on a running emulator if no phone is connected.

If a **dev build** of Gymido is on the phone, the signatures differ and the install is refused. The script says so and gives the command: `adb uninstall com.gymido.app`. Uninstalling clears the app's sign-in.

## 2. (reference) Check the APK

- Signer: `~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs ~/gymido-release/builds/<file>.apk`. Internal builds show `CN=Android Debug`; with your upload key it shows your name.
- Install by hand: `adb install -r ~/gymido-release/builds/<file>.apk`
- **Version check (1.0.1):** `~/Library/Android/sdk/build-tools/36.0.0/aapt2 dump badging ~/gymido-release/builds/<file>.apk | grep versionCode` must show `versionCode='2'` and `versionName='1.0.1'`. Use your installed build-tools version in the path (list them with `ls ~/Library/Android/sdk/build-tools`). On the phone after installing: `adb shell dumpsys package com.gymido.app | grep -E 'versionCode|versionName'`.

## 3. iOS: install on your iPhone (free Apple ID team)

Bundle IDs your personal team will register:
- the app: **`com.gymido.app`**;
- the Live Activity extension: **`com.gymido.app.RestCountdown`**.

**What decides "release":** the Xcode **build configuration**. A Release-configuration build never shows the Expo dev launcher. Xcode's **Run** action uses **Debug** unless you change it, and Debug always opens the "Development servers" screen.

### Steps

1. **Delete the old app from the iPhone** (long-press Gymido → Remove App). The dev build uses the same bundle ID.
2. **ALWAYS regenerate the iOS project from the tag**, even if `~/gymido-release/ios` exists: an `ios/` left from 1.0.0 still says Version 1.0.0 / Build 1.
   ```sh
   cd ~/gymido-release && git fetch --tags && git checkout --detach 1.0.1 && npm ci && APP_ENV=production npx expo prebuild --clean
   ```
   `prebuild --clean` resets the Xcode project, so steps 4 and 5 (Team on both targets, Run = Release) must be redone every time.
3. Open **ONLY** this workspace: `open ~/gymido-release/ios/Gymido.xcworkspace`
   - **Not** `gymido-native/ios`: that's the dev project.
4. Set your signing team:
   1. In the left sidebar, select the **Gymido** project.
   2. Select the **Gymido** target → **Signing & Capabilities** → set **Team** to your personal team.
   3. Do the same for the **RestCountdownWidget** target.
5. Set Release for Run:
   1. Open **Product → Scheme → Edit Scheme…**
   2. Choose **Run** (left) → **Info** tab → set **Build Configuration** to **Release**.
   3. Click **Close**.
6. **Version check:** select the **Gymido** target → **General** → **Identity**: **Version 1.0.1**, **Build 2**. Anything else means step 2 didn't run on the tag; redo it.
7. Pick your iPhone as the run destination (top bar), then **Product → Run (⌘R)**.
   - The first time, the iPhone may ask you to trust the developer: Settings → General → VPN & Device Management → your Apple ID → Trust.

**Check:**
- **Correct:** the app opens straight to the Gymido "Log in / Sign up" card.
- **Wrong (still a Debug build):** a "Development servers" screen or a grey Tools gear. Redo step 5.

### Terminal alternative (same result)

After step 2 (the prebuild from the tag):

```sh
cd ~/gymido-release && APP_ENV=production npx expo run:ios --device --configuration Release
```

### Notes
- With a free Apple ID, the app **expires after 7 days**. Rebuild with the same steps to reinstall; your data stays on the server.
- This build talks to the **production** API, so sign in with your real account.

## Updating an installed release build to a newer commit

Use this when only app code changed (no new packages or native config). Reuse `~/gymido-release`:

```sh
cd ~/gymido-release && git fetch --tags && git checkout --detach 1.0.1 && git log --oneline -1
```

- **iOS:** same workspace and scheme (Run = Release), then ⌘R with the iPhone selected. It installs over the old build and keeps your sign-in. Terminal alternative:
  `cd ~/gymido-release && APP_ENV=production npx expo run:ios --device --configuration Release`
- **Android:** `cd ~/gymido-release && npm run apk -- --install`. It's signed with the same key as before, so it updates in place.

### When the update adds native code (a new package or config plugin)

Example: `2413e95`, spoken rest alerts (`expo-speech`).

```sh
cd ~/gymido-release && git fetch --tags && git checkout --detach 1.0.1 && npm ci && APP_ENV=production npx expo prebuild --clean
```

- **iOS:** `prebuild --clean` regenerates the Xcode project, so redo these steps:
  1. Open `~/gymido-release/ios/Gymido.xcworkspace`.
  2. Set **Team** on **both** targets, **Gymido** and **RestCountdownWidget** (Signing & Capabilities).
  3. Product → Scheme → Edit Scheme… → Run → **Release**.
  4. Press ⌘R.
- **Android:** `npm run apk -- --install` (it always regenerates `android/`).

**Siri "Announce Notifications" for the rest alert (locked phone, AirPods/CarPlay)** needs a **paid** Apple Developer account: free (personal) teams can't sign the Time Sensitive capability. With a paid team, prebuild with `GYMIDO_IOS_TIME_SENSITIVE=1 APP_ENV=production npx expo prebuild --clean`.

The spoken cue while the app is open works on any team.

## 4. What was verified (23 Oct 2026, on a clean copy of `3d546cd`)

**Android:**
- `assembleRelease` with JDK 17 and `APP_ENV=production`:
  - **without** a key, it fails with the message above (fail closed);
  - **with** a key, it produces a signed APK.
- The APK's permissions are exactly: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, VIBRATE, WAKE_LOCK, MODIFY_AUDIO_SETTINGS.
- `allowBackup=false`, and cleartext traffic is off.

**iOS:**
- `xcodebuild -configuration Release -sdk iphoneos` (unsigned) passes.
- The Info.plist has strict ATS only: no background modes, no local-network keys, no push entitlement.
- The Live Activity extension is embedded, and the JS bundle is built into the app (no Metro).

**Not verified by me:** signing and installing on your own iPhone. That needs your Apple ID and device. The command is the standard Expo one, and the extension-team fallback is listed above.

**Before installing:**
- The build talks to the **production** API (`https://workoutapi.nimamemarzadeh.com`), so sign in with your real account.
- Clean up afterwards with `git worktree remove ~/gymido-release` from the main repo. Build output is several GB, and the disk was nearly full today.

## Testing rest alerts on your phone

- **Locked-phone buzz:** test it **without AirPods**. With AirPods or headphones connected, iOS plays the notification sound (and Siri) in your ears and may skip the phone's haptic. That's expected platform behaviour.
- **App open at the rest end:** you get the beep, the spoken line (if on) and a buzz (if "Vibrate on rest end" is on).
- **Phone locked or on the home screen, with AirPods:** Siri can announce "Rest complete" if Announce Notifications is on for Gymido.
