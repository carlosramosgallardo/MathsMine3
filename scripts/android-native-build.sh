#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk/jdk-17.0.19+10}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$ROOT/apps/android-native"
if [[ ! -f local.properties ]]; then
  echo "sdk.dir=$ANDROID_HOME" > local.properties
fi
if [[ ! -x ./gradlew ]]; then
  /home/crg/.local/gradle/gradle-8.7/bin/gradle wrapper --gradle-version 8.7
fi
./gradlew assembleDebug --no-daemon
mkdir -p dist
cp -f app/build/outputs/apk/debug/app-debug.apk dist/mathsmine3-native-debug.apk
echo "APK: $ROOT/apps/android-native/dist/mathsmine3-native-debug.apk"

# Always push to a connected device/emulator when possible (Windows adb from WSL).
ADB_WIN="${ADB_WIN:-/mnt/c/Users/carlo/AppData/Local/Android/Sdk/platform-tools/adb.exe}"
ADB_BIN=""
if [[ -x "$ADB_WIN" ]]; then
  ADB_BIN="$ADB_WIN"
elif command -v adb >/dev/null 2>&1; then
  ADB_BIN="$(command -v adb)"
fi

if [[ -n "$ADB_BIN" ]]; then
  if "$ADB_BIN" devices 2>/dev/null | grep -qE $'\tdevice$'; then
    APK_PATH="$ROOT/apps/android-native/dist/mathsmine3-native-debug.apk"
    if [[ "$ADB_BIN" == *.exe ]]; then
      APK_PATH="$(wslpath -w "$APK_PATH")"
    fi
    echo "Installing on device via $ADB_BIN …"
    "$ADB_BIN" install -r "$APK_PATH"
    echo "Install OK"
  else
    echo "No adb device online — APK built only."
  fi
else
  echo "adb not found — APK built only."
fi
