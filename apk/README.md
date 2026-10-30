# apk/

Double-click `Build latest APK.command` (or run `./apk/build-latest.sh`) to build the latest Android release APK (via `npm run apk`); this folder then holds exactly one file, `gymido-<version>-<build>.apk`. One build at a time (a second run stops at once), and it never installs to a device. The APKs are gitignored. `.vscode/settings.json` keeps VS Code from importing and building `android/` during a build.
