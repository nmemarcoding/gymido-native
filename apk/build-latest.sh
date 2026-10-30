#!/usr/bin/env bash
# Builds the latest Android APK into this folder and keeps only that one.
#
#   ./apk/build-latest.sh      (or: bash ~/Desktop/coding/gymido-native/apk/build-latest.sh)
#
# Reuses `npm run apk` (scripts/build-apk.js: production API, release build).
# Never installs to a device. Old *.apk files are removed only from this
# folder, and only after the new build succeeded.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$DIR")"
BUILT="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

fail() { echo "build-latest: $*" >&2; exit "${STATUS:-1}"; }

# `|| true`: with pipefail a missing build-tools folder would otherwise end the
# script here without a message.
AAPT2="$(ls -d "$ANDROID_HOME"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -n 1 || true)"
[ -x "$AAPT2" ] || fail "aapt2 not found under $ANDROID_HOME/build-tools."

# One build at a time: two runs share android/ and wipe each other's output.
LOCK="$DIR/.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  fail "another build is running (pid $(cat "$LOCK/pid" 2>/dev/null || echo '?')). If none is, remove $LOCK and retry."
fi
echo $$ > "$LOCK/pid"

# A stale APK from an earlier build must never pass as this one.
STAMP="$(mktemp)"
TMP=""
trap 'rm -f "$STAMP" ${TMP:+"$TMP"}; rm -rf "$LOCK"' EXIT
trap 'exit 130' INT TERM HUP
sleep 1
(cd "$ROOT" && npm run apk) || { STATUS=$?; fail "npm run apk failed; the previous APK here is untouched."; }
[ "$BUILT" -nt "$STAMP" ] || fail "no fresh APK at $BUILT; the previous APK here is untouched."

# npm run apk also leaves a dated copy in builds/; remove only this run's one
# (newer than the stamp) so the owner's runs don't pile up there.
find "$ROOT/builds" -maxdepth 1 -type f -name 'gymido-release-*.apk' -newer "$STAMP" -delete 2>/dev/null || true

BADGING="$("$AAPT2" dump badging "$BUILT")" || fail "aapt2 could not read $BUILT."
VERSION="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -n 1)"
CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -n 1)"
[ -n "$VERSION" ] && [ -n "$CODE" ] || fail "could not read version/versionCode from $BUILT."

# Copy in under a temp name, move it into place, then drop the other APKs:
# the folder is never left without an APK.
TARGET="$DIR/gymido-$VERSION-$CODE.apk"
TMP="$(mktemp "$DIR/.incoming.XXXXXX")"
cp "$BUILT" "$TMP"
mv -f "$TMP" "$TARGET"
TMP=""
find "$DIR" -maxdepth 1 -type f -name '*.apk' ! -name "$(basename "$TARGET")" -delete

echo
echo "build-latest: $TARGET"
echo "build-latest: version $VERSION ($CODE)"
echo "build-latest: sha256 $(shasum -a 256 "$TARGET" | cut -d' ' -f1)"
