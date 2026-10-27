#!/usr/bin/env bash
# Runs `maestro --device <device> test …` only after the prod-safety guard
# passes (e2e/scripts/apiGuard.js): the installed app — and Metro, when
# GYMIDO_METRO_PORT is set (dev client) — must use a local test API.
#
# Usage: e2e/scripts/maestro-guarded.sh <emulator-serial | simulator-udid> <maestro test args…>
set -uo pipefail
DEVICE="${1:?usage: $0 <device> <maestro test args…>}"
shift
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT/e2e/scripts/apiGuard.js" "$DEVICE" ${GYMIDO_METRO_PORT:+--metro "$GYMIDO_METRO_PORT"} || exit 3
exec maestro --device "$DEVICE" test "$@"
