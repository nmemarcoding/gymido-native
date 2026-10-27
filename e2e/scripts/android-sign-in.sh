#!/usr/bin/env bash
# Signs a test account in on an Android EMULATOR through Auth0's hosted login,
# the Android counterpart of ios-safe-sign-in.sh. Credentials come from the
# ONE canonical file (e2e/scripts/e2eEnv.sh; GYMIDO_E2E_ENV to point
# elsewhere) and reach Maestro only as MAESTRO_LOGIN_* environment variables
# (never -e, never the command line). Maestro echoes typed text, so its
# console output and test output go to a private temp folder; this script
# prints only PASS/FAIL and the sweep result.
#
#   e2e/scripts/android-sign-in.sh <emulator-serial> <ACCOUNT>
#   ACCOUNT is the file's key prefix, e.g. QA_MEMBER → QA_MEMBER_EMAIL / _PASSWORD
#
# Runs through maestro-guarded.sh (API guard; Release builds launch directly).
# Clears the app and Chrome first (a clean start; the Auth0 SSO session
# survives an app sign-out on emulators). Never screenshot or dump the screen while the form is filled
# (Chrome exposes the typed password to uiautomator).
set -uo pipefail

DEVICE="${1:?usage: $0 <emulator-serial> <ACCOUNT>}"
ACCOUNT="${2:?usage: $0 <emulator-serial> <ACCOUNT>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/e2e/scripts/e2eEnv.sh"
ENV_FILE="$(e2e_env_file)" || exit 2

MAESTRO_LOGIN_EMAIL="$(e2e_value "$ENV_FILE" "${ACCOUNT}_EMAIL")"
MAESTRO_LOGIN_PASSWORD="$(e2e_value "$ENV_FILE" "${ACCOUNT}_PASSWORD")"
[ -n "$MAESTRO_LOGIN_EMAIL" ] && [ -n "$MAESTRO_LOGIN_PASSWORD" ] || { echo "no ${ACCOUNT}_EMAIL/_PASSWORD in the credentials file" >&2; exit 2; }
case "$DEVICE" in emulator-*) ;; *) echo "emulators only (got a non-emulator serial)" >&2; exit 2 ;; esac
export MAESTRO_LOGIN_EMAIL MAESTRO_LOGIN_PASSWORD

WORK="$(mktemp -d "${TMPDIR:-/tmp}/android-sign-in.XXXXXX")"
MARK="$WORK/.mark"
touch "$MARK"
cat > "$WORK/sign-in.yaml" <<YAML
appId: com.gymido.app
---
- runFlow:
    file: $ROOT/e2e/maestro/subflows/sign-in-as.yaml
    env:
      LOGIN_EMAIL: \${MAESTRO_LOGIN_EMAIL}
      LOGIN_PASSWORD: \${MAESTRO_LOGIN_PASSWORD}
- extendedWaitUntil:
    visible:
      id: "app-root"
    timeout: 30000
YAML

# Start clean: clearing the app drops its stored session (no sign-out step in
# Chrome, whose first-run screens would block it), and clearing Chrome drops
# the Auth0 SSO session. The login path dismisses Chrome's first-run screens.
adb -s "$DEVICE" shell pm clear com.gymido.app > /dev/null 2>&1
adb -s "$DEVICE" shell pm clear com.android.chrome > /dev/null 2>&1
"$ROOT/e2e/scripts/maestro-guarded.sh" "$DEVICE" --test-output-dir "$WORK/out" "$WORK/sign-in.yaml" > "$WORK/run.log" 2>&1
code=$?
if [ "$code" -eq 3 ]; then
  echo "REFUSED by the API guard"
elif [ "$code" -eq 0 ]; then
  echo "PASS sign-in $ACCOUNT"
else
  echo "FAIL sign-in $ACCOUNT (exit $code)"
fi

# Byte sweep: delete every file this run or Maestro left that holds either
# value (zipped Maestro logs included); exit non-zero if anything was found.
MAESTRO_LOGS="$HOME/Library/Logs/maestro"
find "$HOME/.maestro/tests" "$MAESTRO_LOGS" -newer "$MARK" -type f \( -name 'maestro.log' -o -name 'commands*.json' -o -name '*.png' \) -delete 2>/dev/null
patterns() { printf '%s\n%s\n' "$MAESTRO_LOGIN_EMAIL" "$MAESTRO_LOGIN_PASSWORD"; }
hits="$(grep -rlF -f <(patterns) "$HOME/.maestro" "$MAESTRO_LOGS" 2>/dev/null)"
while IFS= read -r zip; do
  unzip -p "$zip" 2>/dev/null | grep -qF -f <(patterns) && hits="$hits"$'\n'"$zip"
done < <(find "$MAESTRO_LOGS" -name '*.zip' -newer "$MARK" 2>/dev/null)
hits="$(printf '%s\n' "$hits" | sed '/^$/d' | sort -u)"
rm -rf "$WORK"
if [ -n "$hits" ]; then
  echo "sweep: deleting $(printf '%s\n' "$hits" | wc -l | tr -d ' ') file(s) that held a credential"
  printf '%s\n' "$hits" | while IFS= read -r file; do rm -f "$file"; done
  [ "$code" -eq 0 ] && code=3
else
  echo "sweep: clean"
fi
exit "$code"
