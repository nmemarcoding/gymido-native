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
# Exit: maestro's, or 2 (usage / no device), 3 (API guard), 4 (a second
# simulator), 5 (a Maestro log could not be deleted).
set -uo pipefail
TARGET="${1:?usage: $0 <device | android | ios> <maestro test args…>}"
shift
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# The Release switch comes only from the guard's result, never from the caller.
for arg in "$@"; do
  case "$arg" in
    *MAESTRO_GYMIDO_RELEASE*) echo "refusing: MAESTRO_GYMIDO_RELEASE is set from the API guard, not by hand" >&2; exit 2 ;;
  esac
done

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

# iOS: never with a second simulator booted (Maestro could read or drive it).
"$ROOT/e2e/scripts/single-ios-sim.sh" "$DEVICE" || exit 4

FLAGS=()
[ -n "${GYMIDO_METRO_PORT:-}" ] && FLAGS=(--metro "$GYMIDO_METRO_PORT")
[ "${GYMIDO_NO_METRO:-0}" = 1 ] && FLAGS=(--no-metro)
GUARD_OUT="$(node "$ROOT/e2e/scripts/apiGuard.js" "$DEVICE" ${FLAGS[@]+"${FLAGS[@]}"})" || exit 3
printf '%s\n' "$GUARD_OUT"
# Release build → the launch subflow uses launchApp, not the dev-client link.
if printf '%s' "$GUARD_OUT" | grep -q 'Release build'; then export MAESTRO_GYMIDO_RELEASE=true; else export MAESTRO_GYMIDO_RELEASE=false; fi

# QA candidate-9643e9c: Maestro's device logs (device-logcat.txt,
# device-simulator.log) keep text from a sign-in, and so can maestro.log and
# commands*.json. They go to the caller's --debug-output, else to a private
# temp folder (never the shared ~/.maestro/tests), and are deleted after
# every run: a pass, a failure, Ctrl-C or a kill. One left behind → exit 5.
DEBUG=""
OWN_DEBUG=""
prev=""
for arg in "$@"; do
  case "$arg" in --debug-output=*) DEBUG="${arg#--debug-output=}" ;; esac
  [ "$prev" = --debug-output ] && DEBUG="$arg"
  prev="$arg"
done
if [ -z "$DEBUG" ]; then
  OWN_DEBUG="$(mktemp -d "${TMPDIR:-/tmp}/maestro-guarded.XXXXXX")" || exit 2
  DEBUG="$OWN_DEBUG"
  set -- --debug-output "$OWN_DEBUG" "$@"
fi
LOGS=(-name device-logcat.txt -o -name device-simulator.log -o -name maestro.log -o -name 'commands*.json')

# Reviewer carry (final batch, 27 Oct 2026): stop maestro without hanging.
# TERM, then wait at most MAESTRO_STOP_WAIT seconds (default 10) and kill -9:
# the JVM can ignore TERM, and a bare `wait` then never returns. The
# watchdog's stdio is closed so a leftover `sleep` holds no caller's pipe.
stop_maestro() {
  local pid="$1" dog
  kill "$pid" 2>/dev/null || return 0
  ( sleep "${MAESTRO_STOP_WAIT:-10}"; kill -9 "$pid" 2>/dev/null ) </dev/null >/dev/null 2>&1 &
  dog=$!
  wait "$pid" 2>/dev/null
  kill -9 "$dog" 2>/dev/null
  wait "$dog" 2>/dev/null
  return 0
}
MPID=""
CODE=1
CLEANED=""
scrub() {
  [ -n "$CLEANED" ] && return
  CLEANED=1
  # Ignore further signals (a second Ctrl-C / kill must not stop the
  # cleanup before the logs are gone); the EXIT trap is done.
  trap '' INT TERM HUP
  trap - EXIT
  # Maestro may still be writing.
  [ -n "$MPID" ] && stop_maestro "$MPID"
  find "$DEBUG" -type f \( "${LOGS[@]}" \) -delete 2>/dev/null
  [ -n "$OWN_DEBUG" ] && rm -rf "${OWN_DEBUG:?}"
  local left
  left="$(find "$DEBUG" -type f \( "${LOGS[@]}" \) 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${left:-0}" -gt 0 ]; then
    echo "maestro-guarded: $left Maestro log file(s) could not be deleted under $DEBUG" >&2
    CODE=5
  fi
  exit "$CODE"
}
trap scrub EXIT
trap 'CODE=1; scrub' INT TERM HUP

# In the background + wait, so a signal reaches the trap at once.
maestro --device "$DEVICE" test "$@" &
MPID=$!
wait "$MPID"
CODE=$?
MPID=""
scrub
