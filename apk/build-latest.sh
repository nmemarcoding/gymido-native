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

fail() { echo "build-latest: $*" >&2; exit 1; }

AAPT2="$(ls -d "$ANDROID_HOME"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -n 1)"
[ -x "$AAPT2" ] || fail "aapt2 not found under $ANDROID_HOME/build-tools."

# A stale APK from an earlier build must never pass as this one.
STAMP="$(mktemp)"
trap 'rm -f "$STAMP"' EXIT
sleep 1
(cd "$ROOT" && npm run apk) || fail "npm run apk failed; the previous APK here is untouched."
[ "$BUILT" -nt "$STAMP" ] || fail "no fresh APK at $BUILT; the previous APK here is untouched."

BADGING="$("$AAPT2" dump badging "$BUILT")" || fail "aapt2 could not read $BUILT."
VERSION="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -n 1)"
CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -n 1)"
[ -n "$VERSION" ] && [ -n "$CODE" ] || fail "could not read version/versionCode from $BUILT."

TARGET="$DIR/gymido-$VERSION-$CODE.apk"
TMP="$DIR/.incoming.apk.tmp"
cp "$BUILT" "$TMP"
find "$DIR" -maxdepth 1 -type f -name '*.apk' -delete
mv "$TMP" "$TARGET"

echo
echo "build-latest: $TARGET"
echo "build-latest: version $VERSION ($CODE)"
echo "build-latest: sha256 $(shasum -a 256 "$TARGET" | cut -d' ' -f1)"
