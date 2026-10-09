# Mobile (gymido-native) — state snapshot
_Snapshot 2026-10-09. Expo SDK 57, RN 0.86.3 (New Architecture, Hermes), Xcode 27. Code is the source of truth._

## Current Task
- RN test round against `gymido/docs/RN-TEST-PLAN.md`, on MY devices only: AVD Gymido_E2E_Phone (emulator-5560;
  now has the RELEASE APK, debug-keystore signed, not the dev client), sim "Gymido E2E iPhone"
  (1D58D2E5-E586-4218-920E-BB7F68B7A2D4, debug dev client via Metro), tablet AVD + iPad sim for tablet cases.
  Pixel_API_36 is the owner's: off-limits.
- NEXT (PM order): crash hunt (PM briefs it) → A1 tray counts → A2 → Android lock screen → error boundary
  → Android network → thumbnails → tablet/rotation.
- Next for me: W1/W2 re-check after the harness changes; A2 first-install diagnosis (below; waiting on the owner's go).

## Done 2026-10-08 (all verified unless marked)
- iOS 05 FIXED (PageLayout keyboardShouldPersistTaps="handled"); keyboard-up confirm PASS. Flow 07 PASS (blank
  trainer landing fix verified). asad has a profile + active plan "3-day split".
- W1 + W2 PASS on Android (W2 on release) and iOS (debug client), all captured.
- App fixes: buttons/pickers/set actions dismiss the keyboard (web blur); rest bubble "−" inside the ring;
  completion popup no longer dropped on iOS (one instance across session → hub); exercise nav to §19.8 + web values
  (44pt segments, outside rings, inset track, gradient fill scaleX + 300 ms ease-out, swipe-up opens the sheet).
  Nav visuals checked by screenshot on both platforms; swipe-up probe PASS on iOS and Android.
- A2 "Not now" harness branch PASS on Android after `pm clear` (offer on rest 1, never returned).
- E2E: env pre-flight script (e2e/scripts/check-env.js, runs in npm e2e:*), W1/W2 harness made reliable.
- Commits by the OWNER, pushed: be0a301 (shell), abd0fdc (buttons/pickers), 5f7c776 (workout runtime),
  be7f783 (env check), 1200cb2 (W1/W2 harness). Jest 498/498 at commit time.

## Open: A2 first-install run (2026-10-08, uninstall + reinstall release APK, captured W1)
- Observed (verified): NO OS notification prompt at any rest; the exact-alarm offer appeared on REST 1 and never came
  back (rests 2–4 skipped); the flow itself completed (maestro exit 0, all 4 sections + discard). POST_NOTIFICATIONS was NOT granted right after the reinstall and was granted=true during
  the run without any "Allow" tap. Pass criterion NOT met (no OS prompt, so prompt→later-offer order untested).
- Lead (inferred, check first): release runs use a bare `- launchApp` (e2e/maestro/subflows/launch-app.yaml:10) and
  Maestro grants all permissions on launch by default → a harness artifact, not an app bug. To prove it: dumpsys before
  vs after launchApp; then set `permissions: { notifications: unset }` (or all: deny) on launchApp for this test and
  re-run ONCE (W1 cap 12 min). Pass = OS prompt on rest 1 (Allow), the offer on a LATER rest, Not now, no return.
- `pm clear` does NOT reset POST_NOTIFICATIONS on this API 36 AVD; use uninstall + reinstall for first-install tests.

## Open items / spec gaps
- Notification "Don't Allow" path (rest timer still works, no alerts): later test item; frontend to add to the plan.
- iOS run wrapper (scratchpad/captured-run-ios.sh) has NO stall watchdog yet (Android one does); add before next iOS run.
- iOS Live Activity visuals, bar colours, VoiceOver: not automatable on the simulator (mark ⛔SIM, owner-verified 09-28).

## Known Issues
- App icon is Expo's placeholder → lock-screen mark uses SF Symbol `timer`; Android small icon is a white square.
- Exercise thumbnails fail on some plan days (Drive chain) — unresolved (in the round).
- Dev-client-only cold-start race ("RNSModule … FabricUIManager null") — not in release.
- Android dev client: the Expo floating tools button covers "All (N)"; use the RELEASE build for flows that tap it.
- Maestro saves -e values (credentials) in plain text in ~/.maestro/tests/*/commands.json; cleanup = the owner's call.
- .env.e2e.local also holds AUTH0_MGMT_* (not mine; never use).

## Repo State
- Branch `feature/plans-page` at 1200cb2. UNCOMMITTED (2026-10-09; full commit command sent to PM): run-e2e + tests,
  check-env checkRequired, MAESTRO_* flow vars, ensure-signed-in-as (ensure-signed-in.yaml DELETED), config.yaml
  executionOrder, docs. Jest 538/538. Plus `.claude/` and .gradle noise.

## E2E harness status (2026-10-09 end of day, all UNCOMMITTED; FINAL commit command with PM)
- Final parallel runs PASS: iOS 7/7 in 223 s (was ~8 min), Android 7/7 in 181 s (was ~7 min); N=3, 2 form logins,
  3 cold launches (01/02/03), 0 restarts in phase 2. Jest 556/556.
- Phase 1 = signed-out flows side by side; phase 2 = one device per account, in order (owner's rule). Extra devices:
  fresh iOS sims "Gymido E2E iPhone 2/3" (app copied from the first; NOT simctl clone: shared Auth0 session) and AVD
  copies Gymido_E2E_Phone_2/_3 (app+Chrome data cleared on first boot). Fresh sims ask "Open in Gymido?" per link.
- Speed rules: a false `when: visible` (or `notVisible` on a present element) waits ~7 s, not configurable in 2.10 →
  positive checks for the common path, flags, nested gates. disableAnimations via config (passed with --config in
  parallel runs) + Android animation scales 0. iOS skips eraseText on the fresh form; Android keeps it.
- iOS E2E simulators now have the RELEASE build (`npm run e2e:ios:release`, ~1–2 min; ad-hoc signed, Keychain OK);
  run-e2e warns when it is older than the app sources.
- 04/07 pass REQUIRE_FORM=true; self-heal (cancel → /v2/logout in the device browser → reopen) is UNEXERCISED.
- W1/W2 not re-run since the subflow restructure: run each once before relying on them.
- I printed reza's credentials into my own transcript once (raw commands.json dump); reported to the owner.

## run-e2e (npm run e2e:ios|android [flow prefix] [maestro args])
- Boots "Gymido E2E iPhone" / AVD Gymido_E2E_Phone (6 GB) if needed (E2E_IOS_SIMULATOR / E2E_ANDROID_AVD override),
  never a phone (--device from simctl / emulator-* serials only), detects release vs dev client (auto RELEASE_BUILD,
  starts Metro), refuses W1/W2 on an Android dev client, stops what it started at the end (KEEP_DEVICE=1 skips).
- Accounts: ensure-signed-in-as (ACCOUNT=member|trainer + LOGIN_*), detects trainer by trainer-only UI (trainer tabs /
  Workspace switch on Settings); member rig (reza) verified to have no trainer role. Order: 01–03 → 04,05,06 → 07.
- Credentials: read from .env.e2e.local (MEMBER_* else PROFILED_*, TRAINER_*; nothing else), passed as MAESTRO_* env
  (flows reference ${MAESTRO_…}); -e MEMBER_EMAIL=… overrides and is moved into env. Direct `maestro test` now needs
  MAESTRO_* exported, not -e. Verified 10-09: Maestro still saves typed values in ~/.maestro (commands.json + log).
- Verified 10-09: quitting DeviceHub shuts down ALL booted simulators → script only quits it when no foreign sim is up.
- Emulator now comes up as emulator-5554 when the script starts it (not 5560); use the serial the script prints.

## PM questions answered 2026-10-09
- Test stack: Jest 29.7 + jest-expo 57, RNTL 14, Maestro 2.10; no Detox/MSW/CI. Detox assessment (verified with sources):
  can't drive Auth0 system-browser login on either platform, RN 0.86 outside its 0.77–0.84 range, Xcode 27 Device Hub
  break open (wix/Detox#4978) → recommended staying on Maestro.

## Rules
- The OWNER runs all commits; I only prepare `git commit -m … -m … -- <paths>` commands (author nmemarcoding,
  no Co-Authored-By or any trailer). Never commit or push myself.
- Approvals: gymido-pm says owner approvals come through the PM. My bootstrap says native deps, Auth0 and scope
  changes need the owner's direct approval in my window. UNRESOLVED — the owner hasn't answered in my window;
  until they do, ask in my window for those three categories.
- Read only my own area's code (gymido-native + the RN docs). NEVER frontend/ or backend/ code, not even read-only;
  questions about other areas → gymido-pm.
- Native matches web exactly; deviations only as numbered owner overrides. "Always fix": a real bug found by a test
  is fixed in the APP; harness fixes only for harness problems.
- Test runs: one run per approval; on failure stop, find the cause (from video/screenshots), fix, ONE confirm run,
  report. Caps ≈1.5× normal (W1 12 min, W2 5 min, probes 3 min; new flow 1.5× its first clean run); hitting a cap =
  failure. Stall watchdog: kill if no step completes for 2 min (deliberate waits: their length + 30 s).
  After repeated failures the next run is CAPTURED (screen recording started AFTER sign-in + takeScreenshot at key
  steps); recordings stay out of git.
- Pings to gymido-pm: run START, each SECTION on longer flows, END; stuck on anything >3 min → tell the PM at once.
- E2E runs against the PROD API (workoutapi.nimamemarzadeh.com, via .env.development) with the rigs asad (TRAINER_*)
  and reza (PROFILED_*, passed as MEMBER_*): owner-approved. Junk data on rig accounts needs no cleanup. Never a
  real user's account. Never print rig values; run `node e2e/scripts/check-env.js` before any direct maestro run.

## Tools (scratchpad: /private/tmp/claude-501/-Users-nimamemarzadeh-Desktop-coding-gymido-native/9984845a-ca2a-417b-a895-121cb024c20e/scratchpad — session-specific, may not survive)
- captured-run.sh (Android: CAP=, WATCHDOG=, EXTRA_E="-e RELEASE_BUILD=true"), captured-run-ios.sh, follow-run.py
  (log follower for Monitor), extract-frames (AVFoundation frame grabber: `extract-frames <mp4> <outdir> <secs…>`),
  probe-swipe-up.yaml. Recordings + screenshots: scratchpad/rec/<run>/ (w1-and-4, w2-and-4, w1-ios-7, w2-ios-4,
  swipe-*, a2-and-1, a2-first-install …). If gone, rebuild the wrappers from this description.
- Release APK: `cd android && APP_ENV=development NODE_ENV=production ./gradlew assembleRelease` (no .env.production;
  debug keystore); install with adb -s emulator-5560 only.

## Important Files
- `src/features/workout/` (WorkoutScreen, runtime/SessionRuntime, SessionShell, NavSegment, Overlays, ExerciseStage,
  useRestTimer), `src/shared/time/` (restAlerts, restCountdown, exactAlarmOffer), `modules/rest-countdown/`
- `plugins/` (withRestCountdownWidget, withoutPushCapability — keep LAST, withSceneLifecycle, withForcedLightTheme)
- `e2e/maestro/` (subflows/log-next-set, launch-app, discard-session; workout/W1, W2), `e2e/scripts/check-env.js`,
  `COMMANDS.md`, `app.config.js`
