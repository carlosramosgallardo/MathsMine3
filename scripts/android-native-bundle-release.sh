#!/usr/bin/env bash
# Build a Play-ready signed AAB (requires keystore.properties + release.keystore).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk/jdk-17.0.19+10}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

NATIVE="$ROOT/apps/android-native"
cd "$NATIVE"

if [[ ! -f keystore.properties ]]; then
  echo "Missing $NATIVE/keystore.properties"
  echo "Copy keystore.properties.example → keystore.properties and create release.keystore (see PLAY_RELEASE.md)."
  exit 1
fi

if [[ ! -f local.properties ]]; then
  echo "sdk.dir=$ANDROID_HOME" > local.properties
fi
if [[ ! -x ./gradlew ]]; then
  /home/crg/.local/gradle/gradle-8.7/bin/gradle wrapper --gradle-version 8.7
fi

./gradlew clean bundleRelease --no-daemon

mkdir -p dist
AAB_SRC="app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB_SRC" ]]; then
  echo "AAB not found at $AAB_SRC"
  exit 1
fi
cp -f "$AAB_SRC" dist/mathsmine3-native-release.aab
echo "AAB: $NATIVE/dist/mathsmine3-native-release.aab"

# Print release cert SHA-256 for Digital Asset Links / Play Console
STORE_FILE="$(awk -F= '/^storeFile=/{print $2}' keystore.properties | tr -d '\r')"
STORE_PASS="$(awk -F= '/^storePassword=/{print $2}' keystore.properties | tr -d '\r')"
KEY_ALIAS="$(awk -F= '/^keyAlias=/{print $2}' keystore.properties | tr -d '\r')"
if [[ -n "$STORE_FILE" && -f "$STORE_FILE" ]]; then
  echo ""
  echo "Release cert SHA-256 (add to public/.well-known/assetlinks.json):"
  keytool -list -v -keystore "$STORE_FILE" -alias "$KEY_ALIAS" -storepass "$STORE_PASS" 2>/dev/null \
    | awk '/SHA256:/{print $2; exit}'
fi
