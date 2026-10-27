#!/usr/bin/env bash
# Final audit (27 Oct): with two iOS simulators booted, `maestro --device
# <udid>` read the OTHER simulator's screen. Every script that drives Maestro
# on iOS runs this first: exit 0 only when <device> is the ONE booted
# simulator; exit 4 otherwise. Android emulator serials pass through.
#
# Usage: e2e/scripts/single-ios-sim.sh <emulator-serial | simulator-udid>
set -uo pipefail
DEVICE="${1:?usage: $0 <emulator-serial | simulator-udid>}"
UDID_RE='[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}'
printf '%s' "$DEVICE" | grep -qiE "^${UDID_RE}$" || exit 0
BOOTED="$(xcrun simctl list devices booted | grep -oiE "$UDID_RE" | sort -u)"
OTHERS="$(printf '%s\n' "$BOOTED" | grep -viFx "$DEVICE" | grep .)"
if ! printf '%s\n' "$BOOTED" | grep -qiFx "$DEVICE"; then
  echo "refusing: simulator $DEVICE is not booted" >&2
  exit 4
fi
if [ -n "$OTHERS" ]; then
  echo "refusing: other simulators are booted ($(echo $OTHERS)); Maestro could read or drive them. Shut them down or wait." >&2
  exit 4
fi
exit 0
