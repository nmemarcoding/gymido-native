# iOS offline refresh — real-device check

Verifies the one thing a simulator cannot: that a forced token refresh with **no
network** is treated as transient, so an offline user keeps their session instead
of being pushed back through Auth0 (spec §4).

`offline-refresh-check.sh ios` is only an *approximation* (unreachable host, not a
dropped radio). This is the real check.

---

## Result — 2026-09-17: PASS

| | |
|---|---|
| Device | iPhone 16 Pro Max, physical |
| Build | Release, JS embedded, `APP_ENV=development`, free personal-team signing |
| Observed | Stayed on **Home** throughout — before, during and after reopening the app in Airplane Mode |
| Recovery | Airplane Mode off, background/foreground → back to normal |

The app treats an offline refresh failure as transient on iOS, matching Android
(`NO_NETWORK` → session kept). No change to `src/features/auth/authErrors.js` was
needed.

Re-run this after any change to the refresh or error-classification path
(`authService.refreshOnResume`, `authErrors.isDeadSession` /
`isTransientCredentialsError`).

---

## Procedure (physical device, free Apple ID team)

A free personal team is sufficient — no Apple Developer Program purchase. The
build expires after 7 days.

### One-time setup

On the Mac:
- Xcode → Settings → Accounts → add the Apple ID (creates a "Personal Team")
- After an Xcode major upgrade: `sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch`
  (`devicectl`, `simctl` and CocoaPods all fail until this is done)

On the phone:
- Connect by USB, unlock, tap **Trust This Computer**
- Settings → Privacy & Security → **Developer Mode** → on → restart

### Build and install

```bash
xcrun devicectl list devices                                       # device UDID
defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier   # Team ID, no GUI hunting
npm run native:clean                                               # regenerate ios/ (needed after an Xcode upgrade)

cd ios && xcodebuild -workspace Gymido.xcworkspace -scheme Gymido \
  -configuration Release -destination "id=<udid>" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=<teamid> CODE_SIGN_STYLE=Automatic \
  -derivedDataPath /tmp/gymido-device && cd ..

xcrun devicectl device install app --device <udid> \
  /tmp/gymido-device/Build/Products/Release-iphoneos/Gymido.app
```

`npx expo run:ios --device` refuses with **"No code signing certificates are
available to use"** when no certificate exists yet — it checks for one rather than
creating it. `xcodebuild -allowProvisioningUpdates` creates the certificate and
provisioning profile and registers the device, so use it for the first build.

**Release, not a dev client**, on purpose: a dev client pulls JS from Metro over
the network, and Airplane Mode kills that too, so the app would fail for reasons
unrelated to auth.

Then on the phone: Settings → General → **VPN & Device Management** → trust the
developer certificate. Free-team apps will not launch until this is done; that is
not a signing failure.

### Test

1. Launch the app, sign in with the member test account (`.env.e2e.local`).
2. Confirm a signed-in screen (Home or Onboarding).
3. **Airplane Mode on.**
4. Background the app, wait ~5s, foreground it — this triggers the refresh on resume.
5. Watch for ~30s.
6. Airplane Mode off, background/foreground, confirm recovery.

**Pass:** stays on the signed-in screen. Screens showing their own load errors is
expected. **Fail:** returns to Welcome or opens Auth0's hosted login — an offline
failure misread as a dead session, which would sign out any user who loses signal.

Judge by **on-screen behaviour**: a release build has no Metro console, so the
`[auth] refreshOnResume:` line is invisible.

---

## Appendix: AWS Device Farm (not used)

If no physical device is available, remote-access sessions on real iOS hardware
support network shaping (~$0.17/device-minute, 1,000 free device-minutes). It
needs a signed `.ipa` and an AWS account, and its 100% packet loss is not
identical to a switched-off radio. The physical-device path above is cheaper and
more faithful.
