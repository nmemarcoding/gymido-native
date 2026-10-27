# Fastest test playbook (gymido-native)

Updated 2026-10-23. Follow it in every session. The measurements came from local speed reports (not in the repo).

## 1. Pick the cheapest check that proves the change

| Change | Check | Typical time |
|---|---|---|
| Pure logic, formatters, API params | `npx jest --findRelatedTests <changed src files>` | ~1 s |
| Before reporting or committing anything | `npx jest` (full) | ~3 s |
| Code that has to compile (imports, new screens) | `expo export --platform android` and `--platform ios` (dummy AUTH0 env) | ~1 min each |
| One screen's look or behaviour | ONE Maestro flow per device, both devices in parallel, warm session | ~20–25 s |
| A parity pack (several screens) | One flow per account that takes all the shots | ~25–60 s |
| Native change (packages, app.config plugins/permissions, modules/rest-countdown, the widget plugin, AUTH0_DOMAIN) | prebuild + dev-client rebuild, then flows | rebuild only for these |

Everything under `src/`, the e2e YAML, and `extra` values (API URL) is JS-only. These never need a native rebuild.

## 2. Warm start, once per sitting

1. Leave the sims and emulator running between sittings. Never close them.
2. Start **one Metro for both devices**. Don't use `CI=1`, because CI mode turns off file watching. Use `</dev/null` to keep it non-interactive:
   `APP_ENV=localtest-ios npx expo start --dev-client --port 8081 </dev/null`
   - `src/shared/config/env.js` rewrites `localhost` to `10.0.2.2` on Android for `localtest*` envs, so the emulator reaches the same API.
   - The Android-only Metro (`localtest-android`) is no longer needed.
   - Add `--clear` only after changes to dependencies, babel or metro config, or app.config plugins.
3. Edits now hot-reload. Don't restart Metro after code edits.

## 3. Run flows fast

- **Reuse the signed-in session.** Pass `-e EXPECT_NAME=".*<name>.*"` (`mamad`, `Arash`) to any flow that uses `subflows/sign-in-as.yaml`.
  - If that member is already signed in, the sign-out and Auth0 login are skipped and the flow starts on Today.
  - That saves about 60 s on Android and about 90 s on iOS per flow.
  - Member accounts only. Trainer (asad) flows still sign in cold.
- **Run Android and iOS in parallel** on the same Metro. Owner directive: parallel is allowed inside my slot.
  - Start both `e2e/scripts/maestro-guarded.sh <id> …` with `&`, then `wait` (never plain `maestro test`).
  - Never run two write flows on the same account at the same time.
  - Write flows run once, on one device.
- **Group shots by account.** Take all of an account's screenshots in one flow rather than one flow per check.
- **Soft relaunch** is the default in `subflows/launch-dev-client.yaml`: the deep link reloads the running app.
  - `HARD_RELAUNCH=true` kills the app first; use it only after a native rebuild or a crash.
  - The launch has ONE bounded retry and no loops.
- **Tapping near the bottom:** the floating tab bar covers the bottom of the page. Use `scrollUntilVisible … centerElement: true` before tapping anything that might sit under it.
- **Stop after two failures.** Read `~/.maestro/tests/<run>/<flow>/screenshots/*` and `commands.json` (statuses) to diagnose. Never loop.

## 3a. Test credentials: never left in Maestro output (rule since 23 Oct)

- **iOS sign-in (T-29):** use `e2e/scripts/ios-safe-sign-in.sh <udid> <ACCOUNT>`. It types in stages (email + one probe character, erase, password, submit), checks the form between stages with `e2e/scripts/ios-login-check.py` (PASS/FAIL only), passes credentials as `MAESTRO_LOGIN_*` env vars (never `-e`), purges Maestro's output after every stage and byte-sweeps at the end. A failed check cancels the login sheet. Never screenshot the filled form or the Profile screen (it shows the account email); diagnose from the hierarchy instead.

Maestro writes every `-e` value, passwords included, into its own `maestro.log` and `commands.json`, under `--test-output-dir` and `~/.maestro/tests`. On 23 Oct a sweep found 355 such files going back to 21 Oct, and a failure screenshot that showed a password typed into the wrong field.

- **Don't pass a password with `-e` unless the run deletes those files straight away.** A local runner script (not in the repo) runs `find <output> ~/.maestro/tests \( -name maestro.log -o -name commands.json \) -delete` after every flow.
  - If you can find a way to give Maestro the value without logging it (reading the env file inside a script, or a Maestro redaction option), confirm it actually works before relying on it. Until then, delete after every run.
- **Member flows:** with a warm session (`EXPECT_NAME`) no password is typed. Still pass it only when a cold sign-in is possible.
- **Parity packs get named screenshots only.** Never copy `step-*` or failure screenshots: they show whatever was on screen, including the login form.
- **Selectors on the Auth0 form:** never use a loose text regex. `".*Password.*"` matches the iOS keyboard's "Passwords" autofill button. Tap fields by id (`username`, `password`).
- **Check after a sweep:** byte-scan text files for the env values (print paths only), then OCR the screenshots (`ocrtool`, macOS Vision, offline), and delete every hit.

## 4. Device quirks

- **Android:** keep the emulator animation scales at 0. The app then sees reduce motion, so the shimmer is hidden.
  - To film animations, set the scales to 1 for that one capture, grab frames with an `adb exec-out screencap -p` loop, and restore 0.
  - Maestro waits forever on looping animations, so don't use it for those frames.
- **iOS:**
  - `hideKeyboard` fails on the number pad (it has no return key). Tap a visible button instead.
  - With the simulator's hardware keyboard connected, iOS draws no soft keyboard. Turn it off for keyboard shots.
  - The grey gear is the dev client's Tools button (dev-only). On a fresh simulator the dev menu also opens its intro sheet at launch, which blocks `launch-dev-client`.
    - Fix both once per simulator (and again after the app is reinstalled): `e2e/scripts/ios-skip-dev-menu-intro.sh <udid>...` (T-39). The dev menu still opens with ⌃⌘Z.
- **Slow API shots (skeletons):**
  - Use a local delay proxy (a ~10-line Node script, not in the repo: forward :8090 → :8080 and hold each response ~4 s) and set `API_BASE_URL` to `:8090` temporarily in the gitignored localtest env. ALWAYS restore it afterwards.
  - The emulator's GPRS throttle doesn't slow 10.0.2.2.
- **Maestro output:** parallel runs that start in the same second share one `~/.maestro/tests/<ts>/` folder, as `<flow>` and `<flow>-2`. Tell them apart by screenshot width (Android 1080, iOS 1206).

## 5. Measured (same flows, before → after)

| What | Before | After |
|---|---|---|
| b4-home, Android (mamad) | 81 s (cold sign-in) | 19 s (session reuse) |
| b4-home, iOS (arash) | ~106 s (cold sign-in) | 21 s (session reuse) |
| Both devices | ~187 s + ~20–30 s Metro restart to switch platform | **21 s** in parallel, one Metro |
| b4 re-shoots, both devices | ~3.5 min serial | 24 s in parallel |
| Code edit → device | Metro restart (~20 s) + reload | hot reload, no restart |
| Cold iOS sign-in (wrong account signed in) | ~106 s | ~111 s (not yet optimised) |

## 6. Not done yet (next speed steps)

- **Cold path:** gate the sign-out probes in `ensure-signed-out` (trainer, placeholder, account-unavailable checks cost about 7 s each when false) and the Android `notVisible` login fallbacks.
  - Expected saving: about 20–35 s per cold sign-in.
  - Proposed YAML is in `speed/maestro/proposed-subflows/`; it is untested.
- **iOS Auth0 sheet:** about 40 s per login of slow taps and typing. Session reuse avoids most of it.

## 7. If taps "complete" but nothing happens

In dev builds, any `console.error` (especially at startup) opens the LogBox overlay, which swallows every tap for 30–50 s. Check Metro's log for `ERROR` lines first, and fix the error instead of retrying. Example (23 Oct): an Android notification channel with `sound: 'default'` (expo treats it as a custom file name).
