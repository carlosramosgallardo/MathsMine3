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
  /home/crg/.local/gradle/gradle-8.7/bin/gradle wrapper --gradle-version 8.9
fi
./gradlew assembleDebug --no-daemon
mkdir -p dist
cp -f app/build/outputs/apk/debug/app-debug.apk dist/mathsmine3-native-debug.apk
echo "APK: $ROOT/apps/android-native/dist/mathsmine3-native-debug.apk"

# Always push to a connected device/emulator when possible (Windows adb from WSL).
# Prefer AVD "FreakingAI" (emulator-*) when online; otherwise first online device.
ADB_WIN="${ADB_WIN:-/mnt/c/Users/carlo/AppData/Local/Android/Sdk/platform-tools/adb.exe}"
ADB_BIN=""
if [[ -x "$ADB_WIN" ]]; then
  ADB_BIN="$ADB_WIN"
elif command -v adb >/dev/null 2>&1; then
  ADB_BIN="$(command -v adb)"
fi

PREFERRED_AVD="${MM3_AVD:-FreakingAI}"

pick_serial() {
  local adb="$1"
  local line serial state name
  # Prefer emulator whose `emu avd name` matches FreakingAI
  while read -r line; do
    line=${line//$'\r'/}
    serial=$(awk '{print $1}' <<<"$line")
    state=$(awk '{print $2}' <<<"$line")
    [[ "$state" == "device" ]] || continue
    [[ "$serial" == emulator-* ]] || continue
    name=$("$adb" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | head -1 || true)
    if [[ "$name" == "$PREFERRED_AVD" ]]; then
      echo "$serial"
      return 0
    fi
  done < <("$adb" devices 2>/dev/null | tail -n +2)
  # Else any online emulator
  while read -r line; do
    line=${line//$'\r'/}
    serial=$(awk '{print $1}' <<<"$line")
    state=$(awk '{print $2}' <<<"$line")
    if [[ "$state" == "device" && "$serial" == emulator-* ]]; then
      echo "$serial"
      return 0
    fi
  done < <("$adb" devices 2>/dev/null | tail -n +2)
  # Else first physical device
  while read -r line; do
    line=${line//$'\r'/}
    serial=$(awk '{print $1}' <<<"$line")
    state=$(awk '{print $2}' <<<"$line")
    if [[ "$state" == "device" && -n "$serial" ]]; then
      echo "$serial"
      return 0
    fi
  done < <("$adb" devices 2>/dev/null | tail -n +2)
  return 1
}

if [[ -n "$ADB_BIN" ]]; then
  SERIAL="$(pick_serial "$ADB_BIN" || true)"
  if [[ -n "${SERIAL:-}" ]]; then
    APK_PATH="$ROOT/apps/android-native/dist/mathsmine3-native-debug.apk"
    if [[ "$ADB_BIN" == *.exe ]]; then
      APK_PATH="$(wslpath -w "$APK_PATH")"
    fi
    if [[ "$SERIAL" == emulator-* ]]; then
      echo "Restoring adb reverse tcp:3000 -> tcp:3000 on $SERIAL …"
      "$ADB_BIN" -s "$SERIAL" reverse tcp:3000 tcp:3000 || true
    fi
    echo "Installing on $SERIAL (prefer AVD=$PREFERRED_AVD) via $ADB_BIN …"
    "$ADB_BIN" -s "$SERIAL" install -r "$APK_PATH"
    echo "Install OK → $SERIAL"
    "$ADB_BIN" -s "$SERIAL" shell am start -n xyz.mathsmine3.app/xyz.mathsmine3.nativeapp.MainActivity >/dev/null 2>&1 || true
  else
    echo "No adb device online — APK built only. Start AVD $PREFERRED_AVD to auto-install."
  fi
else
  echo "adb not found — APK built only."
fi
