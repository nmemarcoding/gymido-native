# Mobile agent — working notes and handover

The mobile (React Native) agent's durable notes: how the work runs, the rules it follows, where things stand, and what's next. Credentials, emails and personal data are deliberately left out.

## Where things stand (24 Oct 2026)

- **Release:** the 1.0.0 release build is installed by the owner. Pending: the owner's on-device confirmation of the rest-end **vibration** (app open; locked phone without AirPods) and the **Siri announce** (locked phone or home screen, with AirPods and Announce Notifications on).
- **Branch history** (`feature/plan-engine`, merged to `main`):

  | Commit | What |
  |---|---|
  | 419c595 … 3aca6c8 | Dependencies, app shell and UI kit, trainer plan builder and clients, Library plans |
  | b81a21f | Five-tab navigation (Today, Plans, Exercises, Progress, Profile) |
  | e39713f | Today: workout hub, home dashboard, my-trainer hub |
  | efc3349 | Member areas: my plans, profile, exercises, progress, notifications, trainers |
  | fc8c7e9 | Workout session runtime, rest alerts and countdown, Trainer Profile, 404, tablets |
  | 2b2d07d | Plan generator |
  | 3d546cd | Release hardening (signing, permissions, plist) and pre-release review fixes |
  | 61b686d | No header band above the session chrome on phones |
  | af959ae | Spoken rest alerts (expo-speech), the one-time pop-up, the Profile switch |
  | 2413e95 | iOS Time Sensitive made opt-in (paid Apple teams only) |
  | c896863 | Keep delivered rest alerts (Siri announce); the vibration switch |
  | cfae61c | Rest-end vibration that buzzes (`rest-timer-v2` channel, native buzz); `npm run apk` |

- **How to build and install:** [docs/release/RELEASE-GUIDE.md](../release/RELEASE-GUIDE.md).
  - Android: `npm run apk -- --install`. Internal builds are signed with the debug key for now; the upload key is REQUIRED before any public release.
  - iOS: production prebuild → Xcode, with Team set on both targets and Run = Release → ⌘R.

## Next (post-release list)

1. npm `overrides` for follow-redirects 1.16.1, shell-quote ^1.12.0 and a patched zod; watch for a node-forge fix. All four are build-time only; none is in the app bundle.
2. Strip the `exp+gymido-native` URL scheme from release builds.
3. Re-enable automated iOS sign-in only after a fix is proven with a masked-OCR check; build the parked daily-login helper (dev-only, access/id tokens only, no refresh token, deleted daily).
4. Code review, then merge to `main` and tag 1.0.0 (the tag waits for the owner).
5. QA's acceptance run.
6. After the release: adopt Claude Design as the UI source of truth (`src/shared/theme/tokens.js` maps 1:1 to its tokens).

## How the work runs

- **Specs:** features are built from the web repo's `docs/RN-SPEC-*.md`. Rule: exact web parity, bugs included, unless a dated change or an owner override says otherwise. The web code itself is never read.
- **Approvals:** owner decisions arrive through the PM session. Every block gets a parity pack (simulator/emulator screenshots, both platforms) and frontend's sign-off before commit.
- **Commits:**
  - Verify each in a clean worktree: `npm ci`, the full Jest run, and `expo export` for Android and iOS.
  - The owner is the sole author; no co-author trailer.
  - Push or merge only when the owner says so.
- **Parallel rule:** after this release, every client or trainer feature ships on mobile and web together.
- **Shared test stack:** one agent at a time, on the local API only (never production), on simulators and emulators only (never the owner's phone).
  - Release the slot at safe points, with no flows running.
  - Stop after about two failures and diagnose; no retry loops.
- **Old backup:** read as text only. Never run, require or import anything from it, and credit any parts that were ported.

## Security rules (learned the hard way)

- **Test credentials** live only in the gitignored `.env.e2e.local`. Never put them in files, logs, screenshots or messages.
- **Maestro and `-e`:** Maestro writes every `-e` value, passwords included, into `maestro.log` and `commands.json`. Delete those after every run, and never copy failure screenshots into parity packs.
- **iOS automated sign-in is disabled** (it fails fast before typing). The iOS hosted login once took the password into the email field.
  - Safe manual method: type the email; tap the exact "Password" label; type one probe character; check in the view hierarchy that the password field holds "•" and the email field holds exactly the email; then erase the probe, type the password and tap the exact "Continue".
  - Purge Maestro's logs right after, then run an OCR and byte sweep.
- **Release config:** release builds carry no dev-server keys, a minimal permission set, `allowBackup=false` and no cleartext traffic. Release signing fails closed unless the upload key or `GYMIDO_ALLOW_DEBUG_SIGNING=1` is set.

## Testing notes

- **Playbook:** [docs/testing/FASTEST-TEST-PLAYBOOK.md](../testing/FASTEST-TEST-PLAYBOOK.md): one Metro for both platforms, session reuse, parallel devices.
- **Rest checks:** let rests end **naturally**. Pressing −5 s down to zero clears a rest, which by spec has no beep, buzz or alert.
- **Shell:** pass arguments as zsh arrays; an unquoted `-e X=Y` string isn't split.
- **Disk:** check free space before native builds. A full disk breaks Xcode and Gradle with ENOSPC.
- **Device map (local rig):**
  - iOS simulators: one per test account (mamad, asad). The "arash" simulator currently holds the trainer session.
  - Android: `emulator-5554` is the arash AVD, and the mamad AVD runs as `emulator-5556`.
  - Plus an iPad simulator and an API-34 tablet emulator.
- **Rest-alert verification on Android:**
  - Vibrations: `adb shell dumpsys vibrator_manager` shows each one with its usage (ALARM for the in-app buzz, NOTIFICATION for the channel).
  - Speech: `dumpsys media.audio_flinger` / `dumpsys media.metrics` show the TTS track (`content type SPEECH`).
