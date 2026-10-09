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

**The rest countdown (O13).** The build signs two targets: the app (`com.gymido.app`) and its Lock Screen widget extension `RestCountdownWidget` (`com.gymido.app.RestCountdown`). The free team signs both because neither has an App Group or push entitlement; `plugins/__tests__/restCountdownPrebuild.test.js` fails if a config change ever adds one. On the phone, the first rest countdown shows iOS's own "allow Live Activities" choice under it; it stops once answered. If Live Activities are off (Settings → Gymido), the countdown is skipped quietly and the rest alert still arrives. The simulator can't draw Lock Screen Live Activities, so check the card on a real phone.

A free team can register only 10 new App IDs per 7 days, and each bundle ID above counts once. **Moving to a paid Apple Developer account for release:** bundle IDs are unique across teams, so the personal team's registrations of `com.gymido.app` and `com.gymido.app.RestCountdown` may have to lapse or be removed before the paid team can register them.

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

The iOS simulator runs Live Activities but never draws the Lock Screen, so the rest countdown's card is checked by snapshot instead: `npm run snapshot:rest-countdown` (needs Xcode) renders `plugins/restCountdown/RestCountdownCardView.swift` — the file the widget itself uses — to PNGs in `/tmp/gymido-rest-countdown` and checks the gold field, the navy ink and the exact copy (OCR). It can't check the progress bar's fill (ImageRenderer can't draw the platform ProgressView), the system Lock Screen compositing or VoiceOver.

Two guard tests run as part of `npm test`: `src/test/importGraph.test.js` walks every import from `index.js` the way Metro bundles it, so a renamed or deleted module fails in Jest instead of in a release build; `plugins/__tests__/restCountdownPrebuild.test.js` runs a real `expo prebuild` into a temporary folder (a few seconds) and checks the signing-sensitive output.

Jest runs in `America/Los_Angeles` (`jest.globalSetup.js`) so the UTC-date and timestamp parity tests mean the same thing on every machine. Screen tests mock HTTP at the Axios client (`src/test/mockApi.js`) with spec-shaped payloads (`src/test/planFixtures.js`); animations run on the reduce-motion path by default (`jest.setup.js`).

**iOS simulator builds for E2E must be signed.** `npm run ios` / `expo run:ios` sign the simulator app ad-hoc, which is enough. A hand-built `xcodebuild … CODE_SIGNING_ALLOWED=NO` app can't use the keychain, so login ends on "Sign-in failed … Failed to store credentials in the Keychain." When building with `xcodebuild` for a simulator, target it by id (`-destination 'platform=iOS Simulator,id=<udid>'`) and leave signing at its default.

### Run the E2E tests yourself (Maestro)

One command per platform:

```bash
npm run e2e:ios
npm run e2e:android
npm run e2e:android -- W1      # one flow: W1, W2, 04, 07-trainer… (file-name prefix)
```

It boots the test simulators/emulators, checks the app is installed, reads the test accounts from `.env.e2e.local`, runs the suite on several devices in parallel (never a phone on USB or Wi-Fi) and afterwards shuts down whatever it started.

- **Parallel:** the whole suite runs on 3 devices by default (`E2E_SHARDS=2`, or `E2E_SHARDS=1` for the old single-device run). Phase 1 runs the signed-out flows (01–03) side by side; phase 2 gives each account one device and runs its flows in order (member: 04 → 05 → 06; trainer: 07), so two tests never use the same account at the same time and every sign-out happens with nobody else on that account. A named flow (`-- 04`) always runs on one device. Extra devices are created once: "Gymido E2E iPhone 2/3" fresh with the app copied from the first simulator, `Gymido_E2E_Phone_2/_3` as copies of the first AVD with the app's and Chrome's data cleared, so every device has its own Auth0 session. Each flow's log is in the folder the summary line prints.
- **New tests that sign out or switch accounts:** give them the account they use (member or trainer) and put them LAST in that account's group in `e2e/maestro/config.yaml`; a Jest guard fails if any flow could overlap another on the same account.

- **One-time setup:** Maestro installed (above); `.env.e2e.local` in the repo root; the app installed on the test device. If the app is missing, the script stops and prints the exact build/install command (`npm run ios -- --device "Gymido E2E iPhone"`, or the release APK for Android).
- **Accounts and order:** each flow names its account (member or trainer) and reuses the session when that account is already signed in, so a full run logs in once per account: the suite runs signed-out flows (01–03), then member (04 real login, 05, 06 signs out), then trainer (07 real login). New flows go into their account's group in `e2e/maestro/config.yaml`. The member flows use `MEMBER_EMAIL`/`MEMBER_PASSWORD`, or `PROFILED_EMAIL`/`PROFILED_PASSWORD` when those aren't set; flow 07 uses `TRAINER_EMAIL`/`TRAINER_PASSWORD`. Only these four keys are read, never the admin or Management API ones. They reach Maestro as `MAESTRO_*` environment variables, not on the command line. If a flow needs one that's missing, the run stops and names it. `-e MEMBER_EMAIL=…` (etc.) overrides the file for one run.
- **Devices:** iOS uses the simulator "Gymido E2E iPhone" (iOS 27), Android the AVD `Gymido_E2E_Phone` (started with 6 GB RAM). Use another with `E2E_IOS_SIMULATOR=<name or UDID>` / `E2E_ANDROID_AVD=<name>`.
- **Dev client vs release:** the script detects which build is installed. A release build runs with `RELEASE_BUILD=true` automatically; for the dev client it starts Metro if it isn't running. W1/W2 on Android need the release APK, and the script refuses the dev client for them.
- **iOS release build (the E2E default):** `npm run e2e:ios:release` builds the Release app (JS bundled, no Metro, development tenant, ad-hoc signed by Xcode; no Apple team needed) and installs it on every E2E simulator, in about 1–2 minutes. Run it again after JS changes: `npm run e2e:ios` warns when the installed release build is older than the app's latest source change. A dev client installed with `npm run ios` still works as before (slower: Metro plus a bundle reload per launch).
- **Cleanup:** when Maestro ends (pass, fail, Ctrl-C or SIGTERM) the script stops whatever it started: the simulator, DeviceHub, the emulator, Metro. Anything that was already running stays up, and the script prints one line saying so. `KEEP_DEVICE=1 npm run e2e:ios` leaves everything running for debugging. The exit code is Maestro's.
- **Plain-text copies:** Maestro itself records the typed email and password in `~/.maestro/tests/*/commands.json` and `maestro.log` ("Inputting text: …"), however they are passed. Delete old runs there if that matters.

The script first runs `node e2e/scripts/check-env.js`, which fails if a value in `.env.e2e.local` has leading/trailing whitespace, a CR or quotes (it prints key names only). A stray space after the trainer email once made Auth0 answer "Wrong email or password". Run it yourself before a direct `maestro test`.

Running `maestro test` by hand, the flows read `MAESTRO_MEMBER_EMAIL` / `MAESTRO_MEMBER_PASSWORD` / `MAESTRO_TRAINER_EMAIL` / `MAESTRO_TRAINER_PASSWORD` from the environment (Maestro passes `MAESTRO_*` variables to flows itself):

```bash
maestro test --udid <simulator-udid> e2e/maestro/02-login-opens-universal-login.yaml
set -a && . ./.env.e2e.local && set +a
MAESTRO_TRAINER_EMAIL="$TRAINER_EMAIL" MAESTRO_TRAINER_PASSWORD="$TRAINER_PASSWORD" \
  maestro test -p android e2e/maestro/07-trainer-role-landing.yaml
```

The Android emulator needs at least 4 GB of RAM or Maestro reads an empty view hierarchy and every assertion fails while the app is fine (the script passes this itself):

```bash
emulator -avd Gymido_E2E_Phone -memory 6144 -no-snapshot-load
```

`.env.e2e.local` is gitignored; treat it as **live admin credentials**, not just test config. `PROFILED_*` is an owner-shared account **with a profile**: flows 05/06 (Settings is only reachable inside the app shell) and anything past Create Profile need it. See `e2e/maestro/README.md` for what each flow covers and a troubleshooting table.

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
