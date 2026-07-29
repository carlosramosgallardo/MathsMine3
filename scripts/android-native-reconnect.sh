#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB_WIN="${ADB_WIN:-/mnt/c/Users/carlo/AppData/Local/Android/Sdk/platform-tools/adb.exe}"
ADB_BIN=""

if [[ -x "$ADB_WIN" ]]; then
  ADB_BIN="$ADB_WIN"
elif command -v adb >/dev/null 2>&1; then
  ADB_BIN="$(command -v adb)"
else
  echo "adb not found"
  exit 1
fi

PREFERRED_AVD="${MM3_AVD:-FreakingAI}"

pick_serial() {
  local adb="$1"
  local line serial state name
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

  while read -r line; do
    line=${line//$'\r'/}
    serial=$(awk '{print $1}' <<<"$line")
    state=$(awk '{print $2}' <<<"$line")
    if [[ "$state" == "device" && "$serial" == emulator-* ]]; then
      echo "$serial"
      return 0
    fi
  done < <("$adb" devices 2>/dev/null | tail -n +2)

  return 1
}

SERIAL="$(pick_serial "$ADB_BIN" || true)"
if [[ -z "${SERIAL:-}" ]]; then
  echo "No emulator online. Start AVD $PREFERRED_AVD first."
  exit 1
fi

echo "Using $SERIAL"
echo "Restoring adb reverse tcp:3000 -> tcp:3000"
"$ADB_BIN" -s "$SERIAL" reverse tcp:3000 tcp:3000

echo "Relaunching MathsMine3"
"$ADB_BIN" -s "$SERIAL" shell am force-stop xyz.mathsmine3.app || true
sleep 1
"$ADB_BIN" -s "$SERIAL" shell am start -n xyz.mathsmine3.app/xyz.mathsmine3.nativeapp.MainActivity >/dev/null 2>&1 || true

echo "Done. If the emulator itself is black, cold boot the AVD first."
