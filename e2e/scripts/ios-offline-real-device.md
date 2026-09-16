# iOS offline refresh — real-device check (AWS Device Farm)

Verifies the one thing the simulator cannot: that a forced token refresh with **no
network** is treated as transient, so an offline user keeps their session instead
of being pushed back through Auth0 (spec §4).

`offline-refresh-check.sh ios` is an *approximation* (unreachable host, not a
dropped radio). This is the real check.

> Running this is outside the mobile repo — it uploads a build to a third-party
> device cloud and signs in against the live Auth0 tenant and API. Get explicit
> sign-off before running it.

## Cost

Metered remote access is about **$0.17/device-minute**, no subscription; a ~15
minute session is roughly **$2.50**, and the first 1,000 device-minutes are free.

## Build to upload

A **release build with JS embedded** — Metro is not reachable from the device
cloud, so a dev client is useless there.

```bash
npx cross-env APP_ENV=development expo run:ios --configuration Release
```

Take the resulting `.app`, package it as a signed `.ipa`, and upload that. Device
Farm needs a real-device `.ipa`; a simulator build will be rejected.

## Session steps

1. Device Farm → create/choose a project → **Remote access** → start a session on
   a real iPhone (sessions cap at 150 minutes).
2. Install the uploaded build and launch it.
3. Sign in with the member test account (`MEMBER_EMAIL` / `MEMBER_PASSWORD` from
   `.env.e2e.local`). Confirm a signed-in screen (Home or Onboarding).
4. Apply network shaping: set **100% packet loss** (or the lowest possible
   bandwidth) for the device under test.
5. Background the app, wait ~5 seconds, foreground it. That triggers the forced
   refresh on resume.
6. Watch what the app does for ~30 seconds.
7. Restore the network, background/foreground once more, and confirm the app
   recovers.

## What counts as pass / fail

Judge by **on-screen behaviour**, not logs: a release build has no Metro console,
so the `[auth] refreshOnResume:` line is not visible.

- **Pass** — the app stays on its signed-in screen while offline. Individual
  screens may show their own load errors; that is expected.
- **Fail** — the app returns to Welcome, or opens Auth0's hosted login. That
  means the offline failure was classified as a dead session, which would sign
  out any user who loses signal.

Device Farm records video and device/network logs for the session; keep them with
the result either way.

## Caveat

100% packet loss is not identical to a switched-off radio: iOS may surface a
different `URLError` to the SDK. If the result is ambiguous, the definitive check
is airplane mode on a physical device in hand.
