# Mobile agent — working notes and handover

The mobile (React Native) agent's durable notes: how the work runs, the rules it follows, and where the current state lives. Credentials, emails and personal data are deliberately left out.

## Where to find the current state

- **Version and build numbers:** `app.config.js`. History: `git log` on `main`.
- **Each release:** `~/Desktop/coding/gymido-all/releases/<ver>/NOTES.md` (release SHA, changes, known issues, checks), next to its APK.
- **Open work:** the PM's work tracker (T-xx IDs).
- **Build and install:** [docs/release/RELEASE-GUIDE.md](../release/RELEASE-GUIDE.md).

## How the work runs

- **Specs:** features are built from the web repo's `docs/RN-SPEC-*.md`. Rule: exact web parity, bugs included, unless a dated change or an owner override says otherwise. The web code itself is never read. Spec questions go through the PM.
- **Design source:** UI comes from Claude Design; `src/shared/theme/tokens.js` maps 1:1 to its tokens. UX design changes get a dev impact check (PRES vs LOGIC) before they're built.
- **Approvals:** owner decisions arrive through the PM session. Every block gets a parity pack (simulator/emulator screenshots, both platforms) and frontend's sign-off before commit.
- **Branches:** `main` is the only long-lived branch (since 29 Oct 2026). Work on a short feature branch off `main`, in its own worktree; never on `main` directly.
- **Commits:**
  - Commit and push your own feature branch freely (author nmemarcoding, own paths only, no co-author trailer).
  - Before a commit: `npm ci`, the full Jest suite through the Jest gate, and `expo export` for Android and iOS.
  - Merges into `main` happen only after review (and UX/QA where they apply) plus the owner's go, relayed by the PM.
- **Parallel rule:** every client or trainer feature ships on mobile and web together; done means both are signed off.
- **Shared test stack:** local API only (never production), simulators and emulators only (never the owner's phone). Several agents may use it at once, each with its own test account; nobody starts, stops or restarts the :8080 API while another agent is using it (the first user starts it, the last stops it, and tells the PM). The Mac device limits apply.
  - Release the slot at safe points, with no flows running.
  - Stop after about two failures and diagnose; no retry loops.
- **Driving flows:** plain `maestro test` is forbidden. Only `e2e/scripts/maestro-guarded.sh` or the sign-in scripts drive flows; they run `e2e/scripts/apiGuard.js` (local test API only). `maestro hierarchy` is fine.
- **Old backup** (`~/Desktop/coding/gymido-all/backups/reset-20261021`): read as text only. Never run, require or import anything from it, and credit any parts that were ported.

## Releases

- The owner installs; mobile prepares the builds and the exact paths ([RELEASE-GUIDE](../release/RELEASE-GUIDE.md)).
- **Android:** built in a throwaway release worktree; the APK and its `NOTES.md` are kept in `~/Desktop/coding/gymido-all/releases/<ver>/`. Internal builds are signed with the debug key; the upload key is REQUIRED before any public release.
- **iOS:** `~/Desktop/coding/gymido-native` is the release checkout. Mobile fast-forwards it on `main` to the release, prebuilds `ios/` for production and checks Info.plist; the owner sets Team and presses Run. Dev work never happens in that checkout.
- `prebuild --clean` resets the scheme's Run action to Debug (Debug opens the dev launcher): set Run = Release after every release prebuild.
- Android Release needs JDK 17. `npm run apk` finds it itself; a raw Gradle build needs `JAVA_HOME=$(/usr/libexec/java_home -v 17)` (the machine default, JDK 25, fails in CMake).

## Security rules (learned the hard way)

- **Test credentials** live only in the gitignored `.env.e2e.local`. Never put them in files, logs, screenshots or messages.
- **Maestro and `-e`:** Maestro writes every `-e` value, passwords included, into `maestro.log` and `commands.json`. Delete those after every run, and never copy failure screenshots into parity packs. The sign-in scripts pass credentials only as environment variables (never `-e`) and keep Maestro's output in a private temp folder.
- **Sign-in:** use `e2e/scripts/ios-safe-sign-in.sh` / `e2e/scripts/android-sign-in.sh` (staged, value-free checks, sweep).
  - Manual iOS fallback (the hosted login once put the password in the email field): type the email; tap the exact "Password" label; type one probe character; check in the view hierarchy that the password field holds "•" and the email field holds exactly the email; then erase the probe, type the password and tap the exact "Continue".
  - Purge Maestro's logs right after, then run an OCR and byte sweep.
- **Screen reads:** Chrome on emulators exposes typed password text in uiautomator dumps. Redact every dump; never grep a raw dump while a form is filled. Never screenshot Profile or a filled login form.
- **Release config:** release builds carry no dev-server keys, a minimal permission set, `allowBackup=false` and no cleartext traffic. Release signing fails closed unless the upload key or `GYMIDO_ALLOW_DEBUG_SIGNING=1` is set.

## Testing notes

- **Playbook:** [docs/testing/FASTEST-TEST-PLAYBOOK.md](../testing/FASTEST-TEST-PLAYBOOK.md): one Metro for both platforms, session reuse, parallel devices.
- **Rest checks:** let rests end **naturally**. Pressing −5 s down to zero clears a rest, which by spec has no beep, buzz or alert.
- **Shell:** pass arguments as zsh arrays; an unquoted `-e X=Y` string isn't split.
- **Disk:** check free space before native builds. A full disk breaks Xcode and Gradle with ENOSPC.
- **Exports without secrets:** `AUTH0_DOMAIN=dummy.example.com AUTH0_CLIENT_ID=dummy AUTH0_AUDIENCE=dummy npx expo export --platform <p> --output-dir <dir>`.
- **iOS Release builds:** export `APP_ENV` for `xcodebuild` too (expo-constants re-reads `app.config.js`; otherwise a late "Missing bundle ID").
- **Android render hazards:** gradients only via GradientFill (explicit size, present from the first render); use `StyleSheet.absoluteFill`; GlassSurface needs its solid fallback below API 31.
- **Rest-alert verification on Android:**
  - Vibrations: `adb shell dumpsys vibrator_manager` shows each one with its usage (ALARM for the in-app buzz, NOTIFICATION for the channel).
  - Speech: `dumpsys media.audio_flinger` / `dumpsys media.metrics` show the TTS track (`content type SPEECH`).
