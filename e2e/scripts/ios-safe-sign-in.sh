#!/usr/bin/env bash
# Signs a test account in on an iOS simulator through Auth0's hosted login,
# safely (T-29). The iOS form once took the password into the email field and
# a screenshot showed it in plain text (23 Oct), so typing runs in stages with
# a check of the form between them:
#
#   0  open the empty form                 (e2e/maestro/ios-sign-in/stage-0-*)
#   1  email + ONE probe character         check: email exact, password "•"
#   2  erase the probe                     check: password empty
#   3  the password                        check: all "•", right length, no plain text
#   4  submit, wait for the signed-in app
#
# The checks (e2e/scripts/ios-login-check.py) read the view hierarchy from a
# pipe and the env file themselves, and print only PASS/FAIL. Credentials go
# to Maestro as MAESTRO_LOGIN_* environment variables (never -e, never on the
# command line). Maestro still records typed text in its own logs, so every
# stage's output (logs, commands.json, failure screenshots) is deleted right
# after it, and a byte sweep at the end checks nothing is left. On a failed
# check the login sheet is cancelled, which discards what was typed.
#
# Usage: e2e/scripts/ios-safe-sign-in.sh <simulator-udid> <ACCOUNT>
#   ACCOUNT is the env-file prefix, e.g. QA_MEMBER → QA_MEMBER_EMAIL / _PASSWORD
# Requires: Metro running, the dev client installed, .env.e2e.local present.
# Refuses (exit 3) unless the app's runtime API is a local test API
# (e2e/scripts/apiGuard.js; a dev client is checked against Metro).
# Never take screenshots while the form is filled.

set -uo pipefail

UDID="${1:?usage: $0 <simulator-udid> <ACCOUNT>}"
ACCOUNT="${2:?usage: $0 <simulator-udid> <ACCOUNT>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env.e2e.local"
FLOWS="$ROOT/e2e/maestro/ios-sign-in"
CHECK="$ROOT/e2e/scripts/ios-login-check.py"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ios-sign-in.XXXXXX")"
MARK="$WORK/.mark"
touch "$MARK"

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 2; }
# Prod safety: never type credentials into an app aimed at a non-test API.
# A dev client is checked against Metro (default :8081, or GYMIDO_METRO_PORT).
node "$ROOT/e2e/scripts/apiGuard.js" "$UDID" ${GYMIDO_METRO_PORT:+--metro "$GYMIDO_METRO_PORT"} || { rm -rf "$WORK"; exit 3; }
value() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
MAESTRO_LOGIN_EMAIL="$(value "${ACCOUNT}_EMAIL")"
MAESTRO_LOGIN_PASSWORD="$(value "${ACCOUNT}_PASSWORD")"
[ -n "$MAESTRO_LOGIN_EMAIL" ] && [ -n "$MAESTRO_LOGIN_PASSWORD" ] || { echo "no ${ACCOUNT}_EMAIL/_PASSWORD in the env file" >&2; exit 2; }
export MAESTRO_LOGIN_EMAIL MAESTRO_LOGIN_PASSWORD

MAESTRO_LOGS="$HOME/Library/Logs/maestro"

# Deletes everything Maestro wrote since the run started: its test output and
# its own log folder (per-run logs and zips).
purge() {
  rm -rf "$WORK/out"
  find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 -newer "$MARK" -exec rm -rf {} + 2>/dev/null
  find "$MAESTRO_LOGS" -mindepth 1 -maxdepth 1 -newer "$MARK" -exec rm -rf {} + 2>/dev/null
}

# The two values as grep -F patterns, from a builtin printf, so neither is
# ever on a command line.
patterns() {
  printf '%s\n%s\n' "$MAESTRO_LOGIN_EMAIL" "$MAESTRO_LOGIN_PASSWORD"
}

# Runs one stage flow; prints only its name and the result.
stage() {
  local name="$1"
  mkdir -p "$WORK/out"
  # In the background + wait, so a trap runs at once (exec: maestro is our
  # direct child, which finish's pkill stops).
  (cd "$WORK/out" && exec maestro --device "$UDID" test --test-output-dir "$WORK/out" "$FLOWS/$name.yaml" > "$WORK/out/stage.log" 2>&1) &
  wait $!
  local code=$?
  # On a failure, name the failed step: status lines only, never a typed value.
  local failed=""
  [ "$code" -ne 0 ] && failed="$(grep -E "FAILED" "$WORK/out/stage.log" | grep -viE "input|text|@" | tail -3)"
  purge
  if [ "$code" -ne 0 ]; then
    echo "FAIL stage $name"
    [ -n "$failed" ] && printf '%s\n' "$failed"
    return 1
  fi
  echo "PASS stage $name"
}

check() {
  maestro --device "$UDID" hierarchy 2>/dev/null | python3 "$CHECK" "$ENV_FILE" "$ACCOUNT" "$1"
  local code=$?
  purge
  return "$code"
}

abort() {
  echo "aborting: cancelling the login sheet"
  (cd "$WORK" && maestro --device "$UDID" test "$ROOT/e2e/maestro/subflows/cancel-universal-login.yaml" > /dev/null 2>&1)
  finish 1
}

# Byte sweep: no file Maestro (or this run) left may contain either value,
# zipped Maestro logs included. Runs once, also on Ctrl-C or a kill; exits
# non-zero when it had to delete something.
FINISHED=""
finish() {
  [ -n "$FINISHED" ] && return
  FINISHED=1
  trap - INT TERM HUP
  # A stage interrupted mid-run may still be writing.
  pkill -P $$ 2>/dev/null
  purge
  local hits zip
  hits="$(grep -rlF -f <(patterns) "$HOME/.maestro" "$MAESTRO_LOGS" "$WORK" 2>/dev/null)"
  while IFS= read -r zip; do
    unzip -p "$zip" 2>/dev/null | grep -qF -f <(patterns) && hits="$hits"$'\n'"$zip"
  done < <(find "$MAESTRO_LOGS" -name '*.zip' 2>/dev/null)
  hits="$(printf '%s\n' "$hits" | sed '/^$/d' | sort -u)"
  local code="$1"
  if [ -n "$hits" ]; then
    echo "sweep: deleting $(printf '%s\n' "$hits" | wc -l | tr -d ' ') file(s) that held a credential:"
    printf '%s\n' "$hits"
    printf '%s\n' "$hits" | while IFS= read -r file; do rm -f "$file"; done
    [ "$code" -eq 0 ] && code=3
  else
    echo "sweep: clean"
  fi
  rm -rf "$WORK"
  exit "$code"
}
trap 'finish 1' INT TERM HUP

stage stage-0-open-form || finish 1
stage stage-1-email-probe || abort
check probe || abort
stage stage-2-erase-probe || abort
check erased || abort
stage stage-3-password || abort
check password || abort
stage stage-4-submit || abort
finish 0
