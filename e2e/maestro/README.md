# Auth smoke tests (Maestro)

UI smoke tests for the Login & Sign Up flow, run against the dev client on an iOS simulator or Android emulator.


## Login walkthrough (recorded by hand, 29 Sep 2026)

Every login, sign-out and cancel step in these flows comes from this walkthrough. It was recorded by driving each platform ONE step at a time (a tap, then a hierarchy dump and a screenshot) with no flow running. The shared subflows use only elements seen here: `open-login-page`, `login`, `sign-out`, `cancel-universal-login`, `confirm-ios-logout`. If Auth0 or the OS changes a screen, re-record that step and update the subflow; don't patch around it.

### Android (Pixel 8 emulator, API 36, Chrome Custom Tab)

| # | Screen | Elements present (accessibility tree) | Action | Next screen after |
|---|---|---|---|---|
| 1 | Welcome | `welcome-log-in`, `welcome-sign-up` (+ the dev client's "Tools" bubble) | tap `welcome-log-in` | the Custom Tab; fields exposed in **~6 s** |
| 2 | Auth0 login (Custom Tab) | Chrome: `com.android.chrome:id/close_button` ("Close tab"), `com.android.chrome:id/url_bar` ("gymido-dev.us.auth0.com"). Page: ids **`username`**, **`password`**; texts "Continue", "Reset password", "Sign up", "Continue with Google" | tap `username`, type; tap `password`, type; Back (hide keyboard); tap "Continue" | the app, **~11 s** |
| 3 | Landing, trainer rig | `app-root`, `coming-soon-TrainerDashboardTab`, "Coaching", `tab-bar`, `tab-TrainerDashboardTab` / `…ClientsTab` / `…PlansTab` / `…ProfileTab` | — | — |
| 4 | Sign-out path | Profile tab → `mobile-mode-switch` ("Personal" / "Trainer") → tap "Personal" → member tabs (`tab-WorkoutTab` … `tab-SettingsTab`, `home-screen`) → `tab-SettingsTab` → `settings-sign-out` (visible without scrolling on a Pixel 8) | tap `settings-sign-out` | Welcome in **~4 s**; the Auth0 session is cleared (the next login shows the form) |
| 5 | Cancelled login | as step 2 | tap `close_button` | Welcome in **~5 s**; the app logs `USER_CANCELLED` |

Watch-outs: Chrome exposes a password field's typed VALUE in the tree, so never print hierarchy dumps from a filled form. A Custom Tab reopened in the same Chrome process can keep a stale page tree; wait on `url_bar` instead. If a previous run left the Auth0 session behind, step 2 is Auth0's "Authorize App" consent page (Decline / Accept).

### iOS (iPhone 17 Pro simulator, iOS 27, ASWebAuthenticationSession)

| # | Screen | Elements present | Action | Next |
|---|---|---|---|---|
| 0 | Dev client only | system prompt `Open in “Gymido”?` (Cancel / Open) on a deep link; on a fresh install the dev menu opens (close button id `xmark`) | tap "Open"; tap `xmark` | Welcome |
| 1 | Welcome | `welcome-log-in`, `welcome-sign-up` | tap `welcome-log-in` | system sheet |
| 2 | System sheet | `“Gymido” Wants to Use “gymido-dev.us.auth0.com” to Sign In` (Cancel / Continue) | tap "Continue" | Auth0 page |
| 3 | Auth0 login (web-auth sheet) | toolbar: id `Close` ("Cancel"), id `URL` ("gymido-dev.us.auth0.com"). Page: **no field ids**; labels "Email address", "Password"; texts "Continue", "Continue with Google", "Sign up" | tap "Email address", type; tap "Password", type; tap "Continue" (the keyboard's "Done"/`Return` need not be touched) | the app |
| 3b | Consent (after a surviving Auth0 session) | "Authorize Gymido Native (iOS/Android)", "Accept" | tap "Accept" | the app |
| 4 | Landing, trainer rig | `app-root`, `coming-soon-TrainerDashboardTab`, "Coaching" | — | — |
| 5 | Sign-out | the same path as Android step 4, then the SAME system sheet as step 2, for the logout | tap "Continue" | Welcome |
| 6 | Cancelled login | step 3 | tap id `Close` (or "Cancel" on the step-2 sheet) | Welcome |

**iOS simulator builds must be SIGNED** (ad-hoc is enough; `expo run:ios` does it). An unsigned build (`CODE_SIGNING_ALLOWED=NO`) cannot use the keychain, and login ends on "Sign-in failed … Failed to store credentials in the Keychain."

## Prerequisites

- Maestro: `curl -fsSL "https://get.maestro.mobile.dev" | bash` (needs JDK 17 on `PATH`)
- **An Android emulator with at least 4 GB RAM.** Start it with `emulator -avd <name> -memory 6144`, or set `hw.ramSize` in the AVD's `config.ini`. On the default 2 GB the system runs out of memory and the view-hierarchy dump that Maestro relies on is killed, so flows fail with "Assertion is false: id: … is visible" even though the app is fine.
- The dev client installed on the device: `npm run ios` / `npm run android`
- Metro running: `npm start`
- A member test account in the Auth0 dev tenant
- For flow 07, the trainer test account. Credentials live in gitignored `.env.e2e.local`; that file holds **live admin credentials**, so never commit or quote it.

## Running

```bash
export PATH="$HOME/.maestro/bin:$PATH"

# Whole suite, in order (flows run alphabetically and share session state)
maestro test -p android e2e/maestro \
  -e MEMBER_EMAIL=<email> -e MEMBER_PASSWORD=<password>

# Single flow on a specific device
maestro test --udid <simulator-udid> e2e/maestro/02-login-opens-universal-login.yaml

# Trainer role-landing flow (07). Source the gitignored env file rather than typing secrets.
set -a && . ./.env.e2e.local && set +a
maestro test -p android e2e/maestro/07-trainer-role-landing.yaml \
  -e TRAINER_EMAIL="$TRAINER_EMAIL" -e TRAINER_PASSWORD="$TRAINER_PASSWORD"
```

Never commit credentials. Pass them with `-e`, from your shell or `.env.e2e.local`.

## Flows

| Flow | Checks |
|---|---|
| `01-welcome-no-auto-redirect` | Signed-out cold start shows Welcome and does not open Auth0 |
| `02-login-opens-universal-login` | Log in opens hosted Universal Login; cancelling returns to Welcome |
| `03-decline-limiter` | 2 cancels recover silently, the 3rd within 60s shows Sign-in failed |
| `04-login-lands-signed-in` | Login succeeds and lands on the screen the landing rules choose |
| `05-change-password-validation` | Length and mismatch errors, on submit only |
| `06-sign-out` | Sign out returns to Welcome |
| `07-trainer-role-landing` | A trainer's RBAC role reaches the app; profile gate decides the landing |

`subflows/` holds shared steps: `launch-dev-client`, `ensure-signed-out`, `ensure-signed-in`, `sign-in-as`, `dismiss-browser-interstitials`, and `cancel-universal-login`, which differs per platform.

`login` takes **`LOGIN_EMAIL` / `LOGIN_PASSWORD`**, not `MEMBER_*`, so any account can drive it; callers map their own fixture in via `runFlow: {file, env}`. `sign-in-as` wraps the whole cold-start-to-signed-in sequence the same way and leaves the app on whatever the landing rules chose, because that is what flows 07-09 assert.

On a freshly booted Android emulator, Chrome shows first-run and promo dialogs that cover the Custom Tab, so the Auth0 login form never becomes visible. `dismiss-browser-interstitials` clears them with conditional taps and is a no-op afterwards.

Flows launch through `subflows/launch-dev-client.yaml`, which opens the dev-client deep link. Plain `launchApp` stops at the Expo dev launcher screen and never loads the bundle. Against a release build with JS embedded, replace that subflow's body with `- launchApp` and Metro is no longer needed.

Every flow establishes its own state — `ensure-signed-out` or `ensure-signed-in` — so they can run in any order and individually. Maestro does **not** run files alphabetically (an observed order was 04, 06, 01, 03, 02, 05), so flows must never depend on a previous one having run.

Flows that sign in need `-e MEMBER_EMAIL=… -e MEMBER_PASSWORD=…`; that now includes 05 and 06, which log in if no session exists.

## Notes

- Flows target `testID`s (`welcome-log-in`, `settings-sign-out`, …) rather than display text, except on Auth0's hosted page, which the app doesn't control.
- On the hosted page, "is the login page up?" is anchored on **"Continue with Google"**, never on the email field. Two traps sit behind that:
  - Maestro matches text as a **full-string** regex, and Auth0 renders field labels with a trailing space (`"Email address "`), so `"Email address"` never matches — and as an `assertNotVisible` it passes vacuously.
  - Chrome does not reliably expose the web form's *field* nodes (`resource-id="username"`) in the accessibility tree, even while the page is plainly rendered; surrounding links and buttons are always exposed. Waiting on the field produced failures on a working page.
- `login` taps only elements recorded in the walkthrough below: the field ids on Android, the field labels on iOS. There are no screen-position taps.
- `05` never submits a valid password, so a smoke run can't change the test account.
- Not covered here: the offline refresh check (see `e2e/scripts/`).

## The profile gate outranks the role rules

`resolveLanding` checks `meErrored`, then `profileMissing`, before any role rule:

| Account | Landing |
|---|---|
| trainer (the `TRAINER_*` E2E rig) | Trainer workspace, Dashboard |

**Admin accounts are out of scope for native testing** (owner ruling, 28 Sep 2026): the native
app has no admin surface ([O1]; trainers and clients only), so no flow drives an admin account.
The O1 rule itself (an admin-role user gets the plain member app) is covered by the role unit
tests (`resolveLanding.test.js`, `roles.test.js`).

Flow 07 also leaves state behind: an interactive trainer login sets the stored workspace to
`trainer`, and that survives sign-out by design (`workspacePreference.js`). Harmless, because the
landing rules only read the workspace for users who hold the trainer role.

## Why these flows look the way they do

Four environment traps cost real debugging time while writing this suite. Each one produced a failure that looked like an app bug but wasn't. If a flow starts failing again, check these before suspecting the app.

| Symptom | Cause | What the flows do about it |
|---|---|---|
| Flow fails on `id: app-root`, app looks fine by hand | A Custom Tab left half-open by the previous flow swallows the dev-client deep link, so the app never mounts. Four Chrome processes survived a full suite run. | `launch-dev-client` stops Chrome (Android), presses Home, then retries the deep link twice |
| Flow fails waiting for the email field while the Auth0 page is plainly on screen | Chrome exposes the hosted page's links and buttons in the accessibility tree, but **not** the form field nodes (`resource-id="username"`, the `"Email address "` label) until the page is interacted with | `open-login-page` waits on Chrome's `url_bar`, then (bounded) for the `username` id; see the walkthrough |
| A text selector never matches, or a negative assertion passes for the wrong reason | Maestro matches text as a **full-string** regex, and Auth0 renders labels with a trailing space (`"Email address "`) | Hosted-page steps use ids or `.*…*.` patterns; negative assertions use `"Continue with Google"` |
| Every assertion fails, hierarchy looks empty | The emulator ran out of memory and `uiautomator dump` was OOM-killed (exit 137) — see the RAM prerequisite above | Run the emulator with `-memory 6144` |
| Blank screen with only the dev-client gear right after a relaunch, sometimes followed by a native crash (SIGSEGV on `mqt_v_js`, stack in `MountingCoordinator::pullTransaction`) | A **dev-client** race: the bundle starts before native modules are installed (`[runtime not ready]: … 'EventEmitter' of undefined`) when a flow kills the app and relaunches it through the dev-client deep link within seconds. **Release builds don't have it**: 10× cold launches each of the Android release APK and the iOS Release build were clean (28–29 Sep 2026) | Treat it as harness noise on the dev client; judge crashes on release builds (`-e RELEASE_BUILD=true`) |
| Login flows time out on the hosted page while a hosted page IS on screen | It's Auth0's **"Authorize App"** consent screen (Decline / Accept), not the login form: a previous flow left the Auth0 browser session behind. `ensure-signed-out` used to take its wipe fallback for the trainer rig (Trainer workspace, no Settings tab), which skips `clearSession` | `sign-out` switches to the Personal workspace and signs out through the UI; `login` accepts the consent screen if it appears |
| **iOS only:** login flows time out on the hosted page, which never appears | The system consent sheet (`“Gymido” Wants to Use “gymido-dev.us.auth0.com” to Sign In`) is still up. A condition of `"Wants to Use"` never matches that full title — the same full-string-regex trap as above | `dismiss-browser-interstitials` matches `".*Wants to Use.*"` and taps Continue |
| **iOS only:** `Couldn't hide the keyboard` | `hideKeyboard` has no standard dismiss action against the hosted page's web inputs | `hideKeyboard` is scoped to Android in `login` and flow 05 |

A flow that opens and cancels the browser repeatedly (`03-decline-limiter`) hits the first two traps far more often than a single-login flow, so it is the first place a browser-state regression shows up.
