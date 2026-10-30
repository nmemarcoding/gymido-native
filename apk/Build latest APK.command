#!/usr/bin/env bash
# Double-click in Finder to build the latest APK into this folder.
# All the logic is in build-latest.sh; this only keeps the window open.

"$(dirname "$0")/build-latest.sh"
STATUS=$?

echo
if [ "$STATUS" -eq 0 ]; then
  echo "Done. The latest APK is in this folder."
else
  echo "Build FAILED (exit $STATUS). See the messages above."
fi
read -r -n 1 -s -p "Press any key to close."
echo
exit "$STATUS"
