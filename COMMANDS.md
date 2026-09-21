# Commands

Every command needed to work on this project, copy-paste ready. Keep it current: if you add a script or hit a command someone else would need, add it here in the same change.

Versions in the "verify" column are what this project is developed against.

---

## Prerequisites

| Tool | Verify | Expected |
|---|---|---|
| Node | `node -v` | v24.x (see `.nvmrc`) |
| npm | `npm -v` | 11.x |
| Xcode (iOS) | `xcodebuild -version` | Xcode 26+ |
| iOS simulator runtime | `xcrun simctl list runtimes \| grep iOS` | at least one iOS runtime |
| CocoaPods (iOS) | `pod --version` | 1.17+ |
| JDK 17 (Android) | `java -version` | 17.x — newer JDKs break the Gradle build |
| Android SDK | `ls "$ANDROID_HOME"` | platform 36, build-tools 36, emulator |
| Android emulator image | `$ANDROID_HOME/emulator/emulator -list-avds` | at least one AVD |
| Watchman (optional) | `watchman --version` | any |
| Maestro (E2E only) | `maestro --version` | 2.10+ |

Install what's missing:

```bash
brew install cocoapods watchman openjdk@17          # iOS pods, file watching, Android JDK
brew install --cask android-commandlinetools        # Android SDK tooling
curl -fsSL "https://get.maestro.mobile.dev" | bash  # Maestro (installs to ~/.maestro)
```

Environment variables these tools need (add to `~/.zshrc`):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$HOME/.maestro/bin:$PATH
```

Point the command line at Xcode (needed once; `xcodebuild` and `xcrun simctl` fail without it):

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # needs your password
```

No sudo? Export this in every shell instead — same effect, not persistent:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

---

## First-time setup

```bash
git clone https://github.com/nmemarcoding/gymido-native.git
cd gymido-native
npm install                      # installs JS dependencies
cp .env.example .env.development # then fill in the values
```

`.env.development` must contain `API_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`. Ask the team for the dev values — **never commit real values**; every `.env.*` except `.env.example` is gitignored.

Build and install the native app once before anything else works (the app uses a dev client, not Expo Go):

```bash
npm run ios       # iOS simulator
npm run android   # Android emulator
```

---

## Running the app

```bash
npm start                  # Metro for the dev client (development env)
npm run ios                # build, install and launch on the iOS simulator
npm run android            # build, install and launch on an Android emulator
```

Target a specific device:

```bash
npx expo run:ios --device "iPhone 17 Pro"        # requires that simulator to exist
npx expo run:android --device Pixel_API_36       # requires that AVD to exist
```

Start a simulator/emulator by hand first if you want one running before the build:

```bash
xcrun simctl boot "iPhone 17 Pro"                                   # iOS
$ANDROID_HOME/emulator/emulator -avd Pixel_API_36 -memory 6144      # Android, see note below
```

Once the native app is installed, day-to-day JS work only needs Metro (`npm start`); rebuild only after changing native dependencies or `app.config.js`.

### Physical devices

```bash
npx expo run:android --device            # pick your USB device; needs USB debugging enabled
```

iOS needs a signing identity. A **free personal Apple ID team** is enough for a test build on your own device; that build expires after 7 days.

One-time — Mac: Xcode → Settings → Accounts → add your Apple ID. Phone: connect by USB, unlock, tap **Trust This Computer**, then Settings → Privacy & Security → **Developer Mode** → on → restart.

```bash
xcrun devicectl list devices                                       # device UDID
defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier   # your Team ID
```

`npx expo run:ios --device <udid>` fails with "No code signing certificates are available to use" until a certificate exists — it checks for one rather than creating it. This creates it and installs:

```bash
cd ios && xcodebuild -workspace Gymido.xcworkspace -scheme Gymido \
  -configuration Release -destination "id=<udid>" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=<teamid> CODE_SIGN_STYLE=Automatic \
  -derivedDataPath /tmp/gymido-device && cd ..

xcrun devicectl device install app --device <udid> \
  /tmp/gymido-device/Build/Products/Release-iphoneos/Gymido.app
```

Requires the phone unlocked and connected. After installing, trust the certificate on the phone: Settings → General → **VPN & Device Management**. The app will not launch before that. See `e2e/scripts/ios-offline-real-device.md` for the offline test this build is used for.

---

## Building

```bash
npm run native:clean       # regenerate ios/ and android/ from app.config.js, reinstall pods
```

Run that after changing `app.config.js`, adding a config plugin, or adding/removing a native dependency. `ios/` and `android/` are generated and gitignored — never hand-edit them.

Release builds (JS embedded, no Metro needed at runtime):

```bash
npx cross-env APP_ENV=production expo run:ios --configuration Release
npx cross-env APP_ENV=production expo run:android --variant release
```

A release build for real iOS hardware or the App Store requires signing (see above). EAS Build is not configured in this repo.

---

## Testing

```bash
npm test                   # Jest unit + screen tests (React Native Testing Library)
npm test -- --watch        # re-run on change
npm test -- src/features/plans   # one feature's tests
npm run doctor             # expo-doctor: dependency and config checks
```

Jest runs in `America/Los_Angeles` (`jest.globalSetup.js`) so the UTC-date and timestamp parity tests mean the same thing on every machine. Screen tests mock HTTP at the Axios client (`src/test/mockApi.js`) with spec-shaped payloads (`src/test/planFixtures.js`); animations run on the reduce-motion path by default (`jest.setup.js`).

E2E smoke tests (Maestro). **Requires Metro running (`npm start`), the dev client installed, and a booted device:**

```bash
npm run e2e:android -- -e MEMBER_EMAIL=<email> -e MEMBER_PASSWORD=<password>
npm run e2e:ios     -- -e MEMBER_EMAIL=<email> -e MEMBER_PASSWORD=<password>
```

Single flow, or a specific device:

```bash
maestro test -p android e2e/maestro/01-welcome-no-auto-redirect.yaml
maestro test --udid <simulator-udid> e2e/maestro/02-login-opens-universal-login.yaml
```

Role-landing flows (07-09) each need their own account. Source the env file so secrets stay off the command line:

```bash
set -a && . ./.env.e2e.local && set +a
maestro test -p android e2e/maestro/07-trainer-role-landing.yaml \
  -e TRAINER_EMAIL="$TRAINER_EMAIL" -e TRAINER_PASSWORD="$TRAINER_PASSWORD"
maestro test -p android e2e/maestro/08-admin-role-landing.yaml \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD"
maestro test -p android e2e/maestro/09-deactivated-account.yaml \
  -e DEACTIVATED_EMAIL="$DEACTIVATED_EMAIL" -e DEACTIVATED_PASSWORD="$DEACTIVATED_PASSWORD"
```

The Android emulator needs at least 4 GB of RAM or Maestro reads an empty view hierarchy and every assertion fails while the app is fine:

```bash
emulator -avd Pixel_API_36 -memory 6144 -no-snapshot-load
```

Credentials live in `.env.e2e.local` (gitignored) — treat that file as **live admin credentials**, not just test config. It currently has no `MEMBER_*` entries, so flows 04-06 need the member password supplied separately. See `e2e/maestro/README.md` for what each flow covers and a troubleshooting table.

Offline refresh behaviour:

```bash
./e2e/scripts/offline-refresh-check.sh android   # real offline via emulator airplane mode
./e2e/scripts/offline-refresh-check.sh ios       # APPROXIMATION only — see the script header
```

There is no lint or typecheck step in this project: it is plain JavaScript with no ESLint config.

---

## Environment switching

`APP_ENV` selects which `.env.<APP_ENV>` file `app.config.js` reads. The npm scripts set it:

```bash
npm start                  # development
npm run start:staging      # staging
npm run start:production   # production
```

Any other command:

```bash
npx cross-env APP_ENV=staging expo start --dev-client
npx cross-env APP_ENV=staging expo run:ios
```

Inspect what the app will actually receive:

```bash
npx cross-env APP_ENV=staging expo config --type public
```

`API_SERVER_TZ` (optional) is the zone backend timestamps are reinterpreted in (web parity, RN-SPEC-time §1.3). Unset means no reinterpretation, except `staging` and `production`, which default to `America/Los_Angeles` to match the web builds.

**Changing `AUTH0_DOMAIN` requires a native rebuild** (`npm run native:clean`), because the config plugin bakes the callback scheme into the native projects. Changing `API_BASE_URL` only needs a Metro restart.

---

## Troubleshooting

Commands worth reaching for, in rough order of how often they help.

```bash
sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch   # after an Xcode major upgrade; devicectl, simctl and pods all fail until this is done
```

```bash
npx expo start --clear                                   # restart Metro with a cleared cache
lsof -ti tcp:8081 -sTCP:LISTEN | xargs kill              # free port 8081 when Metro says it is in use
watchman watch-del-all                                   # Metro not seeing file edits
rm -rf node_modules && npm ci                            # dependency state looks wrong
npm run native:clean                                     # native build broken, pods stale, plugin changes not applied
```

Android:

```bash
$ANDROID_HOME/emulator/emulator -avd Pixel_API_36 -memory 6144   # REQUIRED for UI tests: the default 2 GB AVD
                                                                 # OOM-kills the hierarchy dump Maestro reads, and
                                                                 # every assertion fails while the app looks fine
adb devices                                              # emulator not detected
adb kill-server && adb start-server                      # adb wedged ("device offline")
adb emu kill                                             # stop a stuck emulator, then relaunch it
$ANDROID_HOME/emulator/emulator -avd Pixel_API_36 -no-snapshot-load   # cold boot a corrupted emulator state
adb reverse tcp:8081 tcp:8081                            # let the emulator reach Metro on localhost
adb logcat -d | grep ReactNativeJS                       # JS errors from the device
cd android && ./gradlew clean && cd ..                   # Gradle build cache problems
```

iOS:

```bash
xcrun simctl list devices booted                         # which simulators are running
xcrun simctl erase "iPhone 17 Pro"                       # reset a simulator to factory state (requires it shut down)
xcrun simctl shutdown "iPhone 17 Pro"                    # free memory used by an idle simulator
xcrun simctl io "iPhone 17 Pro" screenshot shot.png      # capture the screen
cd ios && pod install && cd ..                           # pods out of sync after a dependency change
```

Dev client opening to the Expo launcher screen instead of the app:

```bash
# Android — open the dev-client deep link directly (10.0.2.2 is the host from the emulator)
adb shell am start -a android.intent.action.VIEW \
  -d "exp+gymido-native://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" com.gymido.app

# iOS simulator
xcrun simctl openurl booted "exp+gymido-native://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

---

## Keeping this file current

Treat a stale command here as documentation debt. If you add an npm script, a test runner, or a setup step, update this file in the same change.
