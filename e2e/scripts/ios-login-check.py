#!/usr/bin/env python3
"""T-29: checks Auth0's hosted login form between the stages of
e2e/scripts/ios-safe-sign-in.sh, without ever printing a value.

Reads `maestro hierarchy` JSON on stdin and the account's email/password from
the gitignored env file itself. Prints exactly one line, "PASS <stage>" or
"FAIL <stage>: <reason>"; reasons never contain field contents. Exit 0 on
PASS, 1 on FAIL.

Usage: maestro --device <udid> hierarchy | ios-login-check.py <env-file> <ACCOUNT> <stage>
  stage probe:    email field == email, password field == one "•"
  erased:         email field == email, password field empty
  password:       email field == email, password field == "•" × len(password),
                  and the password appears nowhere in the hierarchy
"""
import json
import sys

BULLET = "•"


def read_env(path, account):
    values = {}
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            key, sep, value = line.strip().partition("=")
            if sep:
                values[key] = value
    return values.get(f"{account}_EMAIL", ""), values.get(f"{account}_PASSWORD", "")


def area(node):
    try:
        left_top, right_bottom = node["attributes"]["bounds"].strip("[]").split("][")
        x1, y1 = map(int, left_top.split(","))
        x2, y2 = map(int, right_bottom.split(","))
        return (x2 - x1) * (y2 - y1)
    except (KeyError, ValueError):
        return 0


def field(root, label):
    """The input: the largest node whose accessibility label is exactly `label`."""
    found = []

    def walk(node):
        if node.get("attributes", {}).get("accessibilityText") == label:
            found.append(node)
        for child in node.get("children", []):
            walk(child)

    walk(root)
    if not found:
        return None
    attributes = max(found, key=area)["attributes"]
    return (attributes.get("value") or attributes.get("text") or "").strip()


def main():
    env_file, account, stage = sys.argv[1:4]
    email, password = read_env(env_file, account)
    if not email or not password:
        return fail(stage, "account not found in the env file")
    raw = sys.stdin.read()
    try:
        root = json.loads(raw)
    except ValueError:
        return fail(stage, "no hierarchy")
    email_value = field(root, "Email address")
    password_value = field(root, "Password")
    if email_value is None or password_value is None:
        return fail(stage, "login fields not found")
    if email_value != email:
        return fail(stage, "email field does not hold exactly the email")
    if stage == "probe":
        ok = password_value == BULLET
        reason = "password field is not one masked character"
    elif stage == "erased":
        ok = password_value == ""
        reason = "password field is not empty"
    elif stage == "password":
        if password in raw:
            return fail(stage, "the password is visible in plain text")
        ok = password_value == BULLET * len(password)
        reason = "password field is not fully masked at the right length"
    else:
        return fail(stage, "unknown stage")
    if not ok:
        return fail(stage, reason)
    print(f"PASS {stage}")
    return 0


def fail(stage, reason):
    print(f"FAIL {stage}: {reason}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
