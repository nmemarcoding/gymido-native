#!/usr/bin/env bash
# Checks what a forced token refresh does with no network, so an offline user is
# never pushed back through Auth0 (spec §4: transient failures keep the session).
#
# Android: real offline, using the emulator's airplane mode.
# iOS:     APPROXIMATION ONLY. The simulator shares the Mac's network, so this
#          points the Auth0 domain at an unreachable host instead of
#          disconnecting. A DNS failure is not identical to a dropped
#          connection, and the SDK may classify it differently. The real check
#          is airplane mode on a physical iPhone.
#
# Usage: e2e/scripts/offline-refresh-check.sh android|ios
# Requires: the app signed in on the device, and Metro running (npm start).
# Watch the Metro terminal for the "[auth] refreshOnResume:" line.

set -euo pipefail

PLATFORM="${1:-}"
APP_ID="com.gymido.app"
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

case "$PLATFORM" in
  android)
    echo "== Android: real offline check =="
    "$ADB" shell cmd connectivity airplane-mode enable
    sleep 4
    echo "-- app backgrounded and reopened while offline"
    "$ADB" shell input keyevent KEYCODE_HOME
    sleep 3
    "$ADB" shell am start -n "$APP_ID/.MainActivity" >/dev/null
    sleep 12
    "$ADB" shell cmd connectivity airplane-mode disable
    echo
    echo "EXPECTED in the Metro output:"
    echo "  [auth] refreshOnResume: NO_NETWORK ..."
    echo "  and the app still showing its signed-in screen (session kept)."
    echo "A dead-session error type here would be a bug: an offline user would be"
    echo "sent back through Auth0."
    ;;

  ios)
    echo "== iOS: APPROXIMATION, not a true offline test =="
    echo "This makes token refresh fail by pointing AUTH0_DOMAIN at an"
    echo "unreachable host. It does NOT reproduce a dropped connection."
    echo
    ENV_FILE=".env.development"
    [ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
    cp "$ENV_FILE" "$ENV_FILE.offline-check.bak"
    trap 'mv -f "$ENV_FILE.offline-check.bak" "$ENV_FILE"; echo "Restored $ENV_FILE"' EXIT
    sed -i '' 's/^AUTH0_DOMAIN=.*/AUTH0_DOMAIN=unreachable.invalid/' "$ENV_FILE"
    echo "AUTH0_DOMAIN temporarily set to unreachable.invalid."
    echo
    echo "Now, in order:"
    echo "  1. Restart Metro so the app config is re-read (npm start)."
    echo "  2. Relaunch the app on the simulator (it stays signed in)."
    echo "  3. Background it and bring it back to trigger the forced refresh."
    echo "  4. Read the '[auth] refreshOnResume:' line in the Metro output."
    echo
    echo "EXPECTED: an error the app treats as transient, with the session kept."
    echo "If it is treated as a dead session, report it: on a real device that"
    echo "would sign out an offline user."
    read -r -p "Press Enter once you have the result, to restore the env file... " _
    ;;

  *)
    echo "Usage: $0 android|ios" >&2
    exit 1
    ;;
esac
