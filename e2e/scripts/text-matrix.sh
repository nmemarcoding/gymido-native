#!/usr/bin/env bash
# T-170 step 5: the LIVE-WORKOUT-SPEC v2.3.1 §9.1 text-size matrix on ONE device (simulators / emulators only).
#   e2e/scripts/text-matrix.sh <android|ios> <device> <width_dp> <density> <out_dir> <setting=fontScale>...
#   android setting = the font_scale value (1.0 / 1.15 / 1.3 / 2.0); ios = a content_size name
#   (large / extra-large / extra-extra-large / extra-extra-extra-large / accessibility-extra-extra-extra-large).
# The account must be signed in already (android-sign-in.sh / ios-safe-sign-in.sh) with an active plan.
# Per scale: set the text size, then start a workout (m1), set 1 → rest (m2) → set 2 (m3) → browse ex 2 (m4),
# discard (m9). After each screen: a hierarchy dump (ids + bounds; through the private-home reader) checked by
# textMatrixCheck.js against the mode §5.4 expects (width < 304 × scale = large text), and a masked screenshot.
# Large text: the reach flows (m5 / m6) assert Did it, Up next and Discard are reachable by scroll.
# Flows run ONLY through maestro-guarded.sh (prod guard). Ends by resetting the text size to the default.
# Output: <out_dir>/results.jsonl (one line per cell) + <out_dir>/<label>-<cell>.png. Exit 1 if any cell failed.
set -uo pipefail
PLATFORM="${1:?platform}"; DEVICE="${2:?device}"; WIDTH="${3:?width dp}"; DENSITY="${4:?density}"; OUT="${5:?out dir}"; shift 5
HERE="$(cd "$(dirname "$0")" && pwd)"
FLOWS="$HERE/../maestro/v2/t170"
TOOLS="${GYMIDO_TOOLS:-$HOME/gymido-mobile-work/v2/tools}"
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
mkdir -p "$OUT"
FAILED=0

set_scale() {
  if [ "$PLATFORM" = android ]; then adb -s "$DEVICE" shell settings put system font_scale "$1"
  else xcrun simctl ui "$DEVICE" content_size "$1"; fi
}
reset_scale() { if [ "$PLATFORM" = android ]; then set_scale 1.0; else set_scale large; fi; }
trap reset_scale EXIT

# Android dev client: the dev menu's floating gear sits over the header and catches taps (it opened the dev menu
# mid-run at 1.3). Turn it off (showFab=false in its prefs; debug build, run-as) and relaunch once.
if [ "$PLATFORM" = android ]; then
  P=/data/data/com.gymido.app/shared_prefs/expo.modules.devmenu.sharedpreferences.xml
  if ! adb -s "$DEVICE" shell run-as com.gymido.app cat "$P" 2>/dev/null | grep -q 'name="showFab" value="false"'; then
    adb -s "$DEVICE" shell am force-stop com.gymido.app
    adb -s "$DEVICE" shell "run-as com.gymido.app sed -i 's#</map>#<boolean name=\"showFab\" value=\"false\" /></map>#' $P"
  fi
fi

flow() { bash "$HERE/maestro-guarded.sh" "$DEVICE" "$FLOWS/$1" > "$OUT/.flow.log" 2>&1; local c=$?; grep -E 'FAILED' "$OUT/.flow.log" | cut -c1-160; rm -f "$OUT/.flow.log"; return $c; }

cell() { # <label> <cell> <mode> <required ids, comma> [inside pairs a:b,…]
  local label="$1" name="$2" mode="$3" req="$4" inside="${5:-}" dump="$OUT/.h.json"
  if ! bash "$TOOLS/maestro-hierarchy.sh" "$DEVICE" > "$dump" 2>/dev/null; then echo "{\"label\":\"$label-$name\",\"ok\":false,\"failures\":[\"no hierarchy\"]}" >> "$OUT/results.jsonl"; FAILED=1; return; fi
  node "$HERE/textMatrixCheck.js" "$dump" --mode "$mode" --require "$req" --inside "$inside" --density "$DENSITY" --label "$label-$name" >> "$OUT/results.jsonl" || FAILED=1
  rm -f "$dump"
  if [ "$PLATFORM" = android ]; then python3 -I "$TOOLS/mshot.py" "$DEVICE" "$OUT/$label-$name.png" > /dev/null
  else bash "$TOOLS/shot.sh" "$DEVICE" "$OUT" "$label-$name" > /dev/null; fi
  tail -1 "$OUT/results.jsonl"
}

# A fit cell that overflowed at the floor (over > 0): its controls must still be reachable by scroll (§5.2 / T-162).
reach_if_over() {
  local over; over="$(tail -1 "$OUT/results.jsonl" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).over||0))')"
  [ "$over" -gt 0 ] 2>/dev/null || return 0
  if flow "$3" > /dev/null; then echo "{\"label\":\"$1-$2-reach\",\"ok\":true,\"over\":$over}" >> "$OUT/results.jsonl"
  else echo "{\"label\":\"$1-$2-reach\",\"ok\":false,\"over\":$over}" >> "$OUT/results.jsonl"; FAILED=1; fi
}

for spec in "$@"; do
  setting="${spec%%=*}"; scale="${spec#*=}"; label="$PLATFORM-${WIDTH}-${setting}"
  mode="$(node -e "console.log($WIDTH < 304 * $scale ? 'large' : 'fit')")"
  echo "== $label (scale $scale → $mode)"
  set_scale "$setting"; sleep 3
  flow m0-home.yaml > /dev/null
  if ! flow m1-set1.yaml; then echo "{\"label\":\"$label-start\",\"ok\":false,\"failures\":[\"m1 failed\"]}" >> "$OUT/results.jsonl"; FAILED=1; continue; fi
  if [ "$mode" = fit ]; then cell "$label" set1 fit '/set-action-.*/,up-next,discard-workout+6'; reach_if_over "$label" set1 m5-reach.yaml
  else cell "$label" set1 large ''; flow m5-reach.yaml || { echo "{\"label\":\"$label-set1-reach\",\"ok\":false}" >> "$OUT/results.jsonl"; FAILED=1; }; fi
  if flow m2-rest.yaml; then
    # The iOS rest sheet is its own window (no session-page in the dump): rest cells don't read the mode.
    if [ "$mode" = fit ]; then cell "$label" rest any 'rest-timer-skip,rest-timer-minus,rest-timer-plus'; else cell "$label" rest any ''; fi
    if flow m2b-disc.yaml; then cell "$label" disc any '' 'rest-countdown:rest-timer'
    else echo "{\"label\":\"$label-disc\",\"ok\":false,\"failures\":[\"m2b failed\"]}" >> "$OUT/results.jsonl"; FAILED=1; fi
    if flow m3-set2.yaml; then
      if [ "$mode" = fit ]; then cell "$label" set2 fit '/set-action-.*/,discard-workout+6'; reach_if_over "$label" set2 m5-reach.yaml
      else cell "$label" set2 large ''; flow m5-reach.yaml || { echo "{\"label\":\"$label-set2-reach\",\"ok\":false}" >> "$OUT/results.jsonl"; FAILED=1; }; fi
    else echo "{\"label\":\"$label-set2\",\"ok\":false,\"failures\":[\"m3 failed\"]}" >> "$OUT/results.jsonl"; FAILED=1; fi
  else echo "{\"label\":\"$label-rest\",\"ok\":false,\"failures\":[\"m2 failed\"]}" >> "$OUT/results.jsonl"; FAILED=1; fi
  if flow m4-browse.yaml; then
    if [ "$mode" = fit ]; then cell "$label" browse fit 'discard-workout+6'; reach_if_over "$label" browse m6-reach-browse.yaml
    else cell "$label" browse large ''; flow m6-reach-browse.yaml || { echo "{\"label\":\"$label-browse-reach\",\"ok\":false}" >> "$OUT/results.jsonl"; FAILED=1; }; fi
  else echo "{\"label\":\"$label-browse\",\"ok\":false,\"failures\":[\"m4 failed\"]}" >> "$OUT/results.jsonl"; FAILED=1; fi
  flow m9-cleanup.yaml || { echo "CLEANUP FAILED at $label: stopping (a session may be open)"; exit 1; }
done
exit "$FAILED"
