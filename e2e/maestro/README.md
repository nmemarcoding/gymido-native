# Auth smoke tests (Maestro)

UI smoke tests for the Login & Sign Up flow, run against the dev client on an iOS simulator or Android emulator.

## Prerequisites

- Maestro: `curl -fsSL "https://get.maestro.mobile.dev" | bash` (needs JDK 17 on `PATH`)
- **An Android emulator with at least 4 GB RAM.** Start it with `emulator -avd <name> -memory 6144`, or set `hw.ramSize` in the AVD's `config.ini`. On the default 2 GB the system runs out of memory and the view-hierarchy dump that Maestro relies on is killed, so flows fail with "Assertion is false: id: … is visible" even though the app is fine.
- The dev client installed on the device: `npm run ios` / `npm run android`
- Metro running: `npm start`
- A member test account in the Auth0 dev tenant
- For flows 07-09, the trainer / admin / deactivated test accounts. Credentials live in gitignored `.env.e2e.local`; that file holds **live admin credentials**, so never commit or quote it.

## Running

```bash
export PATH="$HOME/.maestro/bin:$PATH"

# Whole suite, in order (flows run alphabetically and share session state)
maestro test -p android e2e/maestro \
  -e MEMBER_EMAIL=<email> -e MEMBER_PASSWORD=<password>

# Single flow on a specific device
maestro test --udid <simulator-udid> e2e/maestro/02-login-opens-universal-login.yaml

# Role-landing flows (07-09). Source the gitignored env file rather than typing secrets.
set -a && . ./.env.e2e.local && set +a
maestro test -p android e2e/maestro/07-trainer-role-landing.yaml \
  -e TRAINER_EMAIL="$TRAINER_EMAIL" -e TRAINER_PASSWORD="$TRAINER_PASSWORD"
maestro test -p android e2e/maestro/08-admin-role-landing.yaml \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD"
maestro test -p android e2e/maestro/09-deactivated-account.yaml \
  -e DEACTIVATED_EMAIL="$DEACTIVATED_EMAIL" -e DEACTIVATED_PASSWORD="$DEACTIVATED_PASSWORD"
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
| `08-admin-role-landing` | An admin's role reaches the app and mobile gives them no admin surface |
| `09-deactivated-account` | A backend-deactivated user gets Account unavailable, not Home |

`subflows/` holds shared steps: `launch-dev-client`, `ensure-signed-out`, `ensure-signed-in`, `sign-in-as`, `dismiss-browser-interstitials`, and `cancel-universal-login`, which differs per platform.

`fill-login-form` takes **`LOGIN_EMAIL` / `LOGIN_PASSWORD`**, not `MEMBER_*`, so any account can drive it; callers map their own fixture in via `runFlow: {file, env}`. `sign-in-as` wraps the whole cold-start-to-signed-in sequence the same way and leaves the app on whatever the landing rules chose, because that is what flows 07-09 assert.

On a freshly booted Android emulator, Chrome shows first-run and promo dialogs that cover the Custom Tab, so the Auth0 login form never becomes visible. `dismiss-browser-interstitials` clears them with conditional taps and is a no-op afterwards.

Flows launch through `subflows/launch-dev-client.yaml`, which opens the dev-client deep link. Plain `launchApp` stops at the Expo dev launcher screen and never loads the bundle. Against a release build with JS embedded, replace that subflow's body with `- launchApp` and Metro is no longer needed.

Every flow establishes its own state — `ensure-signed-out` or `ensure-signed-in` — so they can run in any order and individually. Maestro does **not** run files alphabetically (an observed order was 04, 06, 01, 03, 02, 05), so flows must never depend on a previous one having run.

Flows that sign in need `-e MEMBER_EMAIL=… -e MEMBER_PASSWORD=…`; that now includes 05 and 06, which log in if no session exists.

## Notes

- Flows target `testID`s (`welcome-log-in`, `settings-sign-out`, …) rather than display text, except on Auth0's hosted page, which the app doesn't control.
- On the hosted page, "is the login page up?" is anchored on **"Continue with Google"**, never on the email field. Two traps sit behind that:
  - Maestro matches text as a **full-string** regex, and Auth0 renders field labels with a trailing space (`"Email address "`), so `"Email address"` never matches — and as an `assertNotVisible` it passes vacuously.
  - Chrome does not reliably expose the web form's *field* nodes (`resource-id="username"`) in the accessibility tree, even while the page is plainly rendered; surrounding links and buttons are always exposed. Waiting on the field produced failures on a working page.
- `fill-login-form` taps the fields by id when they are exposed and falls back to their on-screen position when they are not.
- `05` never submits a valid password, so a smoke run can't change the test account.
- Not covered here: the offline refresh check (see `e2e/scripts/`).

## The profile gate outranks the role rules

Verified on Android 2026-09-17. `resolveLanding` checks `profileMissing` **before** any role
rule, so a signed-in user with no backend profile lands on Onboarding regardless of role:

| Account | Role claim reaching the app | Landing |
|---|---|---|
| trainer | `Roles: Trainer` | Onboarding |
| admin | `Roles: admin` | Onboarding |
| deactivated | n/a — `meErrored` is checked first | Account unavailable |

Two consequences for anyone reading these flows:

- **The role claim is proven, the role *landing* is not.** The trainer and admin accounts were
  created through the Management API and have no profile, so `GET /profile` 404s. Flows 07 and 08
  assert the `Roles: …` line — that is the real thing under test, since it proves the tenant Action
  populates `https://gymido.app/roles`. Asserting `Trainer dashboard` or `Home` would have been
  asserting the profile gate instead.
- **KNOWN GAP: the trainer→TrainerDashboard and admin→Home branches cannot be reached from the
  app at all today.** They need an account *with* a profile, and `OnboardingScreen` is still a
  placeholder with no profile-creation form, so nothing can get past the gate. `resolveLanding.test.js`
  covers both branches in unit form. Revisit 07 and 08 when onboarding ships.

Flow 07 also leaves state behind: an interactive trainer login sets the stored workspace to
`trainer`, and that survives sign-out by design (`workspacePreference.js`). Harmless, because the
landing rules only read the workspace for users who hold the trainer role.

## Why these flows look the way they do

Four environment traps cost real debugging time while writing this suite. Each one produced a failure that looked like an app bug but wasn't. If a flow starts failing again, check these before suspecting the app.

| Symptom | Cause | What the flows do about it |
|---|---|---|
| Flow fails on `id: app-root`, app looks fine by hand | A Custom Tab left half-open by the previous flow swallows the dev-client deep link, so the app never mounts. Four Chrome processes survived a full suite run. | `launch-dev-client` stops Chrome (Android), presses Home, then retries the deep link twice |
| Flow fails waiting for the email field while the Auth0 page is plainly on screen | Chrome exposes the hosted page's links and buttons in the accessibility tree, but **not** the form field nodes (`resource-id="username"`, the `"Email address "` label) until the page is interacted with | Waits anchor on `"Continue with Google"`; `fill-login-form` taps fields by id when present and falls back to screen position |
| A text selector never matches, or a negative assertion passes for the wrong reason | Maestro matches text as a **full-string** regex, and Auth0 renders labels with a trailing space (`"Email address "`) | Hosted-page steps use ids or `.*…*.` patterns; negative assertions use `"Continue with Google"` |
| Every assertion fails, hierarchy looks empty | The emulator ran out of memory and `uiautomator dump` was OOM-killed (exit 137) — see the RAM prerequisite above | Run the emulator with `-memory 6144` |
| **iOS only:** login flows time out on the hosted page, which never appears | The system consent sheet (`“Gymido” Wants to Use “gymido-dev.us.auth0.com” to Sign In`) is still up. A condition of `"Wants to Use"` never matches that full title — the same full-string-regex trap as above | `dismiss-browser-interstitials` matches `".*Wants to Use.*"` and taps Continue |
| **iOS only:** `Couldn't hide the keyboard` | `hideKeyboard` has no standard dismiss action against the hosted page's web inputs | `hideKeyboard` is scoped to Android in `fill-login-form` and flow 05 |

A flow that opens and cancels the browser repeatedly (`03-decline-limiter`) hits the first two traps far more often than a single-login flow, so it is the first place a browser-state regression shows up.
