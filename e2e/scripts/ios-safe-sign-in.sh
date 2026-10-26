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
value() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
MAESTRO_LOGIN_EMAIL="$(value "${ACCOUNT}_EMAIL")"
MAESTRO_LOGIN_PASSWORD="$(value "${ACCOUNT}_PASSWORD")"
[ -n "$MAESTRO_LOGIN_EMAIL" ] && [ -n "$MAESTRO_LOGIN_PASSWORD" ] || { echo "no ${ACCOUNT}_EMAIL/_PASSWORD in the env file" >&2; exit 2; }
export MAESTRO_LOGIN_EMAIL MAESTRO_LOGIN_PASSWORD

# Deletes everything Maestro wrote since the run started.
purge() {
  rm -rf "$WORK/out"
  find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 -newer "$MARK" -exec rm -rf {} + 2>/dev/null
}

# Runs one stage flow; prints only its name and the result.
stage() {
  local name="$1"
  mkdir -p "$WORK/out"
  (cd "$WORK/out" && maestro --device "$UDID" test --test-output-dir "$WORK/out" "$FLOWS/$name.yaml" > "$WORK/out/stage.log" 2>&1)
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

# Byte sweep: no file Maestro (or this run) left may contain either value.
finish() {
  purge
  local hits
  hits="$(grep -rlF -e "$MAESTRO_LOGIN_EMAIL" -e "$MAESTRO_LOGIN_PASSWORD" "$HOME/.maestro" "$WORK" 2>/dev/null)"
  if [ -n "$hits" ]; then
    echo "sweep: deleting $(printf '%s\n' "$hits" | wc -l | tr -d ' ') file(s) that held a credential:"
    printf '%s\n' "$hits"
    printf '%s\n' "$hits" | while IFS= read -r file; do rm -f "$file"; done
  else
    echo "sweep: clean"
  fi
  rm -rf "$WORK"
  exit "$1"
}

stage stage-0-open-form || finish 1
stage stage-1-email-probe || abort
check probe || abort
stage stage-2-erase-probe || abort
check erased || abort
stage stage-3-password || abort
check password || abort
stage stage-4-submit || abort
finish 0
