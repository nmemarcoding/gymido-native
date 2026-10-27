#!/usr/bin/env bash
# Trainer → client invite by ACCOUNT KEY, for QA rows P5.8 / P5.9 / P5.11.
# Signs TRAINER in (android-sign-in.sh / ios-safe-sign-in.sh), switches to the
# trainer workspace, opens Clients → Invite client and types CLIENT's email
# into the sheet. The email comes from the ONE canonical credentials file
# (e2e/scripts/e2eEnv.sh) and reaches Maestro only as MAESTRO_INVITE_EMAIL
# (never -e, never the command line, never printed). Maestro output stays in
# a private temp folder; this script prints only PASS/FAIL and the sweep.
#
#   e2e/scripts/invite.sh <emulator-serial | simulator-udid> <TRAINER> <CLIENT> [--send]
#   e.g. e2e/scripts/invite.sh emulator-5572 QA_TRAINER THROWAWAY3 --send
#
# Without --send it stops with the match row shown (the sheet checks of
# P5.11); --send taps Invite and waits for "Invitation sent". The match row
# and the toast show the email ON SCREEN: screenshots only through the
# masking tool.
set -uo pipefail

usage() { echo "usage: $0 <emulator-serial | simulator-udid> <TRAINER> <CLIENT> [--send]" >&2; exit 2; }
[ $# -eq 3 ] || [ $# -eq 4 ] || usage
DEVICE="$1"; TRAINER="$2"; CLIENT="$3"; SEND=0
if [ $# -eq 4 ]; then [ "$4" = "--send" ] || usage; SEND=1; fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/e2e/scripts/e2eEnv.sh"
ENV_FILE="$(e2e_env_file)" || exit 2

MAESTRO_INVITE_EMAIL="$(e2e_value "$ENV_FILE" "${CLIENT}_EMAIL")"
[ -n "$MAESTRO_INVITE_EMAIL" ] || { echo "no ${CLIENT}_EMAIL in the credentials file" >&2; exit 2; }
case "$DEVICE" in
  emulator-*) SIGN_IN="$ROOT/e2e/scripts/android-sign-in.sh" ;;
  ????????-????-????-????-????????????) SIGN_IN="$ROOT/e2e/scripts/ios-safe-sign-in.sh" ;;
  *) echo "emulators and simulators only" >&2; exit 2 ;;
esac
export MAESTRO_INVITE_EMAIL

case "$SIGN_IN" in
  *android*) "$ROOT/e2e/scripts/android-sign-in.sh" "$DEVICE" "$TRAINER" || exit $? ;;
  *) "$ROOT/e2e/scripts/ios-safe-sign-in.sh" "$DEVICE" "$TRAINER" || exit $? ;;
esac

WORK="$(mktemp -d "${TMPDIR:-/tmp}/invite.XXXXXX")"
MARK_SAVED="$(mktemp "${TMPDIR:-/tmp}/invite-mark.XXXXXX")"
cat > "$WORK/invite.yaml" <<YAML
appId: com.gymido.app
---
- runFlow: $ROOT/e2e/maestro/v2/subflows/trainer-workspace.yaml
- runFlow:
    when:
      visible:
        id: "tab-TClients"
    commands:
      - tapOn:
          id: "tab-TClients"
- runFlow:
    when:
      visible:
        id: "rail-TClients"
    commands:
      - tapOn:
          id: "rail-TClients"
- scrollUntilVisible:
    element:
      id: "clients-invite"
    direction: UP
    timeout: 30000
- tapOn:
    id: "clients-invite"
- extendedWaitUntil:
    visible:
      id: "invite-client-modal"
    timeout: 20000
- tapOn:
    id: "invite-search"
- eraseText: 80
- inputText: \${MAESTRO_INVITE_EMAIL}
- pressKey: Enter
- extendedWaitUntil:
    visible:
      id: "invite-user-.*|invite-invited-.*"
    timeout: 20000
YAML
if [ "$SEND" = 1 ]; then
  cat >> "$WORK/invite.yaml" <<'YAML'
- tapOn:
    id: "invite-user-.*"
    index: 0
- extendedWaitUntil:
    visible:
      id: "invite-invited-.*"
    timeout: 20000
# The toast's title + description are one accessibility node: prefix match.
- extendedWaitUntil:
    visible: "Invitation sent.*"
    timeout: 10000
YAML
fi

MAESTRO_LOGS="$HOME/Library/Logs/maestro"
patterns() { printf '%s\n' "$MAESTRO_INVITE_EMAIL"; }
MPID=""
CODE=1
CLEANED=""
# Cleanup + byte sweep, exactly once: normal end, Ctrl-C, kill, closed terminal.
cleanup() {
  [ -n "$CLEANED" ] && return
  CLEANED=1
  trap - EXIT INT TERM HUP
  [ -n "$MPID" ] && kill "$MPID" 2>/dev/null && wait "$MPID" 2>/dev/null
  pkill -P $$ 2>/dev/null
  rm -rf "$WORK"
  find "$HOME/.maestro/tests" "$MAESTRO_LOGS" -newer "$MARK_SAVED" -type f \( -name 'maestro.log' -o -name 'commands*.json' -o -name '*.png' \) -delete 2>/dev/null
  local hits zip
  hits="$(grep -rlF -f <(patterns) "$HOME/.maestro" "$MAESTRO_LOGS" 2>/dev/null)"
  while IFS= read -r zip; do
    unzip -p "$zip" 2>/dev/null | grep -qF -f <(patterns) && hits="$hits"$'\n'"$zip"
  done < <(find "$MAESTRO_LOGS" -name '*.zip' 2>/dev/null)
  hits="$(printf '%s\n' "$hits" | sed '/^$/d' | sort -u)"
  if [ -n "$hits" ]; then
    echo "sweep: deleting $(printf '%s\n' "$hits" | wc -l | tr -d ' ') file(s) that held the email:"
    printf '%s\n' "$hits"
    printf '%s\n' "$hits" | while IFS= read -r file; do rm -f "$file"; done
    [ "$CODE" -eq 0 ] && CODE=3
  else
    echo "sweep: clean"
  fi
  rm -f "$MARK_SAVED"
  exit "$CODE"
}
trap cleanup EXIT
trap 'CODE=1; cleanup' INT TERM HUP

# In the background + wait, so a signal reaches the trap at once.
"$ROOT/e2e/scripts/maestro-guarded.sh" "$DEVICE" --test-output-dir "$WORK/out" "$WORK/invite.yaml" > "$WORK/run.log" 2>&1 &
MPID=$!
wait "$MPID"
CODE=$?
MPID=""
if [ "$CODE" -eq 0 ]; then
  [ "$SEND" = 1 ] && echo "PASS invite sent ($TRAINER → $CLIENT)" || echo "PASS match row shown ($TRAINER → $CLIENT; not sent)"
else
  # Name the failed step by a KNOWN id only (never echo a log line: the
  # typed email can be in it).
  step="$(grep -E 'FAILED' "$WORK/run.log" 2>/dev/null | grep -oE 'Invitation sent|invite-invited|invite-user|invite-results|invite-search|invite-client-modal|clients-invite|rail-TClients|tab-TClients|rail-TToday|tab-TToday|mode-switch-trainer|tab-Profile|rail-Profile' | head -1)"
  echo "FAIL invite (exit $CODE) at step: ${step:-unknown}"
fi
cleanup
