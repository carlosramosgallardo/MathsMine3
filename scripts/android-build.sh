#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk/jdk-17.0.19+10}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "JDK 17 not found at $JAVA_HOME" >&2
  exit 1
fi
if [[ ! -d "$ANDROID_HOME/platforms" ]]; then
  echo "Android SDK not found at $ANDROID_HOME" >&2
  exit 1
fi

cd "$ROOT/android"
./gradlew assembleDebug --no-daemon
mkdir -p dist
cp -f app/build/outputs/apk/debug/app-debug.apk dist/mathsmine3-debug.apk
echo "APK: $ROOT/android/dist/mathsmine3-debug.apk"
