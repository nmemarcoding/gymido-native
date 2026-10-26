#!/usr/bin/env bash
# Stops the Expo dev menu's first-launch intro sheet ("This is the developer
# menu…") from covering the app on an iOS simulator, so
# e2e/maestro/subflows/launch-dev-client.yaml finds `app-root` (T-39).
#
# expo-dev-menu reads two keys from the app's UserDefaults
# (ios/Modules/DevMenuPreferences.swift): EXDevMenuIsOnboardingFinished
# (default false → the intro sheet) and EXDevMenuShowsAtLaunch (default true
# → the menu opens at launch). It also turns off the grey "Tools" gear
# (EXDevMenuShowFloatingActionButton), which appears once onboarding is
# finished and covers the top-right corner in taps and QA shots; the dev menu
# still opens with ⌃⌘Z or a shake. This writes the keys into the app's data
# container once per simulator. Dev builds only: nothing in the app or its native
# config changes, and a reinstall of the app clears it (run it again).
#
# Usage: e2e/scripts/ios-skip-dev-menu-intro.sh <simulator-udid>...
# Requires: each simulator booted, with the dev client installed.

set -euo pipefail

APP_ID="com.gymido.app"

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <simulator-udid>..." >&2
  exit 2
fi

for UDID in "$@"; do
  DATA="$(xcrun simctl get_app_container "$UDID" "$APP_ID" data)"
  [ -n "$DATA" ] && [[ "$DATA" == *CoreSimulator/Devices/* ]] || { echo "no app container for $UDID" >&2; exit 1; }
  PLIST="$DATA/Library/Preferences/$APP_ID.plist"
  # A running app (or the simulator's cached prefs) would write its old values back.
  xcrun simctl terminate "$UDID" "$APP_ID" 2>/dev/null || true
  mkdir -p "$(dirname "$PLIST")"
  [ -f "$PLIST" ] || plutil -create xml1 "$PLIST"
  plutil -replace EXDevMenuIsOnboardingFinished -bool YES "$PLIST"
  plutil -replace EXDevMenuShowsAtLaunch -bool NO "$PLIST"
  plutil -replace EXDevMenuShowFloatingActionButton -bool NO "$PLIST"
  # cfprefsd caches the plist; restart it so the app reads the new file.
  xcrun simctl spawn "$UDID" launchctl stop com.apple.cfprefsd.xpc.daemon 2>/dev/null || true
  xcrun simctl spawn "$UDID" launchctl stop com.apple.cfprefsd.xpc.agent 2>/dev/null || true
  echo "$UDID: onboarding finished=$(plutil -extract EXDevMenuIsOnboardingFinished raw "$PLIST"), shows at launch=$(plutil -extract EXDevMenuShowsAtLaunch raw "$PLIST"), gear=$(plutil -extract EXDevMenuShowFloatingActionButton raw "$PLIST")"
done
