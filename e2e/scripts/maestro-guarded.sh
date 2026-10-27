#!/usr/bin/env bash
# The ONLY way to run Maestro flows against the app (with ios-safe-sign-in.sh):
# runs `maestro --device <device> test …` only after the prod-safety guard
# (e2e/scripts/apiGuard.js) passes. A dev client is always checked against
# Metro (default :8081; GYMIDO_METRO_PORT=<port> for another). A Release build
# is checked against its embedded config; GYMIDO_NO_METRO=1 is only for
# Release builds (the guard refuses it for a dev client).
#
# Usage: e2e/scripts/maestro-guarded.sh <emulator-serial | simulator-udid | android | ios> <maestro test args…>
#   android / ios: the one booted emulator / simulator (GYMIDO_DEVICE picks
#   one when several are running).
set -uo pipefail
TARGET="${1:?usage: $0 <device | android | ios> <maestro test args…>}"
shift
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

pick() {
  local found
  found="$(cat)"
  if [ -n "${GYMIDO_DEVICE:-}" ]; then
    printf '%s\n' "$found" | grep -qx "$GYMIDO_DEVICE" && { echo "$GYMIDO_DEVICE"; return 0; }
    echo "GYMIDO_DEVICE=$GYMIDO_DEVICE is not a running $TARGET target" >&2; return 1
  fi
  case "$(printf '%s\n' "$found" | grep -c .)" in
    1) echo "$found" ;;
    0) echo "no running $TARGET emulator/simulator" >&2; return 1 ;;
    *) echo "several $TARGET targets are running; set GYMIDO_DEVICE to one of: $(echo $found)" >&2; return 1 ;;
  esac
}

case "$TARGET" in
  android) DEVICE="$(adb devices | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" {print $1}' | pick)" || exit 2 ;;
  ios) DEVICE="$(xcrun simctl list devices booted | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | pick)" || exit 2 ;;
  *) DEVICE="$TARGET" ;;
esac

FLAGS=()
[ -n "${GYMIDO_METRO_PORT:-}" ] && FLAGS=(--metro "$GYMIDO_METRO_PORT")
[ "${GYMIDO_NO_METRO:-0}" = 1 ] && FLAGS=(--no-metro)
GUARD_OUT="$(node "$ROOT/e2e/scripts/apiGuard.js" "$DEVICE" ${FLAGS[@]+"${FLAGS[@]}"})" || exit 3
printf '%s\n' "$GUARD_OUT"
# Release build → the launch subflow uses launchApp, not the dev-client link.
if printf '%s' "$GUARD_OUT" | grep -q 'Release build'; then export MAESTRO_GYMIDO_RELEASE=true; else export MAESTRO_GYMIDO_RELEASE=false; fi
exec maestro --device "$DEVICE" test "$@"
