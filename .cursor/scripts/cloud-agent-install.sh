#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")}"
export PATH="$JAVA_HOME/bin:$PATH"

CMDLINE_ZIP="commandlinetools-linux-11076708_latest.zip"
CMDLINE_URL="https://dl.google.com/android/repository/${CMDLINE_ZIP}"
# Pinned SHA-256 from https://dl.google.com/android/repository/repository2-1.xml
CMDLINE_SHA256="2d2d50857e4eb553af5a6dc3ad507a17adf43d115264b1afc116f95c92e5e258"
SDK_PACKAGES=(
  "platform-tools"
  "platforms;android-36"
  "build-tools;35.0.0"
)

if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "Installing Android command-line tools into $ANDROID_HOME …"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl --proto '=https' --tlsv1.2 -fsSL "$CMDLINE_URL" -o "$tmp/$CMDLINE_ZIP"
  actual_sha256="$(sha256sum "$tmp/$CMDLINE_ZIP" | awk '{print $1}')"
  if [[ "$actual_sha256" != "$CMDLINE_SHA256" ]]; then
    echo "Android cmdline-tools checksum mismatch (expected $CMDLINE_SHA256, got $actual_sha256)" >&2
    exit 1
  fi
  unzip -q "$tmp/$CMDLINE_ZIP" -d "$tmp/extract"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/extract/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  trap - EXIT
  rm -rf "$tmp"
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "Ensuring Android SDK packages are installed …"
if ! yes | sdkmanager --licenses; then
  echo "Warning: sdkmanager --licenses returned non-zero (continuing)" >&2
fi
sdkmanager "${SDK_PACKAGES[@]}"

native_props="$ROOT/apps/android-native/local.properties"
mkdir -p "$ROOT/apps/android-native"
if [[ ! -f "$native_props" ]]; then
  echo "sdk.dir=$ANDROID_HOME" > "$native_props"
elif ! grep -q '^sdk\.dir=' "$native_props"; then
  echo "sdk.dir=$ANDROID_HOME" >> "$native_props"
fi

if [[ -f "$ROOT/package-lock.json" ]]; then
  echo "Installing Node dependencies …"
  cd "$ROOT"
  npm ci --ignore-scripts
fi

echo "Cloud agent install complete."
echo "  JAVA_HOME=$JAVA_HOME"
echo "  ANDROID_HOME=$ANDROID_HOME"
