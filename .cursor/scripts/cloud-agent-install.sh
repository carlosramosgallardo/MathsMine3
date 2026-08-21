#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")}"
export PATH="$JAVA_HOME/bin:$PATH"

CMDLINE_ZIP="commandlinetools-linux-11076708_latest.zip"
CMDLINE_URL="https://dl.google.com/android/repository/${CMDLINE_ZIP}"

if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "Installing Android command-line tools into $ANDROID_HOME …"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  tmp="$(mktemp -d)"
  curl -fsSL "$CMDLINE_URL" -o "$tmp/$CMDLINE_ZIP"
  unzip -q "$tmp/$CMDLINE_ZIP" -d "$tmp/extract"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/extract/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$tmp"
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  echo "Accepting Android SDK licenses and installing platform packages …"
  yes | sdkmanager --licenses >/dev/null 2>&1 || true
  sdkmanager \
    "platform-tools" \
    "platforms;android-36" \
    "build-tools;35.0.0"
fi

mkdir -p "$ROOT/apps/android-native"
echo "sdk.dir=$ANDROID_HOME" > "$ROOT/apps/android-native/local.properties"

if [[ -f "$ROOT/package-lock.json" ]]; then
  echo "Installing Node dependencies …"
  cd "$ROOT"
  npm ci
fi

echo "Cloud agent install complete."
echo "  JAVA_HOME=$JAVA_HOME"
echo "  ANDROID_HOME=$ANDROID_HOME"
