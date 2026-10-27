# Sourced by the sign-in runners. Credentials live in ONE canonical,
# gitignored file; worktrees (QA's included) never hold a copy, and nothing
# here prints a value.
#   e2e_env_file          → the file's path (GYMIDO_E2E_ENV, else the canonical one); exit 2 if missing
#   e2e_value FILE KEY    → that key's value, for capture into a variable only
E2E_CANONICAL_ENV="$HOME/Desktop/coding/gymido-native/.env.e2e.local"

e2e_env_file() {
  local file="${GYMIDO_E2E_ENV:-$E2E_CANONICAL_ENV}"
  if [ ! -f "$file" ]; then
    echo "no credentials file at $file (set GYMIDO_E2E_ENV to the canonical .env.e2e.local)" >&2
    return 2
  fi
  printf '%s\n' "$file"
}

e2e_value() {
  grep -E "^$2=" "$1" | head -1 | cut -d= -f2-
}
