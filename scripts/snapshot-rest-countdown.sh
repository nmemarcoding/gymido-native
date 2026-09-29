#!/bin/sh
# O13: renders the rest countdown's Lock Screen card (the widget's own
# RestCountdownCardView.swift) to PNGs and checks colours, ink and the bar.
# Needs Xcode (macOS SwiftUI). Output: ${1:-/tmp/gymido-rest-countdown}.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-/tmp/gymido-rest-countdown}
BUILD=$(mktemp -d)
mkdir -p "$OUT"
cat "$ROOT/plugins/restCountdown/RestCountdownCardView.swift" "$ROOT/scripts/restCountdownSnapshot/main.swift" > "$BUILD/snapshot.swift"
xcrun swiftc -parse-as-library -O -target arm64-apple-macos14 "$BUILD/snapshot.swift" -o "$BUILD/snapshot"
"$BUILD/snapshot" "$OUT"
