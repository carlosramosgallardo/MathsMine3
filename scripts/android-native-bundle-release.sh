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

# Name by versionName from app/build.gradle.kts (e.g. mathsmine3-0.1.0-beta.5.aab)
VERSION_NAME="$(
  awk -F'"' '/versionName[[:space:]]*=/{print $2; exit}' app/build.gradle.kts
)"
VERSION_NAME="${VERSION_NAME:-unknown}"
AAB_NAME="mathsmine3-${VERSION_NAME}.aab"
cp -f "$AAB_SRC" "dist/${AAB_NAME}"
# Stable alias for docs / local scripts
ln -sfn "$AAB_NAME" dist/mathsmine3-release.aab
echo "AAB: $NATIVE/dist/${AAB_NAME}"
echo "Alias: $NATIVE/dist/mathsmine3-release.aab → ${AAB_NAME}"

# Native debug symbols zip for Play Console (manual upload if not embedded in AAB).
SYMS_ZIP="dist/native-debug-symbols-${VERSION_NAME}.zip"
LIB_DIR="app/build/intermediates/merged_native_libs/release/mergeReleaseNativeLibs/out/lib"
if [[ -d "$LIB_DIR" ]]; then
  python3 - <<'PY' "$LIB_DIR" "$SYMS_ZIP"
import sys, zipfile, pathlib
lib, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for abi in ('arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'):
        d = lib / abi
        if not d.is_dir():
            continue
        for f in d.glob('*.so'):
            zf.write(f, f'{abi}/{f.name}')
print(f'Native symbols zip: {out} ({out.stat().st_size} bytes)')
PY
else
  echo "WARN: $LIB_DIR not found — skip native symbols zip"
fi

if [[ ! -d "$ANDROID_HOME/ndk" ]] && ! compgen -G "$ANDROID_HOME/ndk/*" > /dev/null; then
  echo ""
  echo "WARN: Android NDK not installed — Play may warn about missing native debug symbols."
  echo "Install: sdkmanager \"ndk;26.1.10909125\" then rebuild to embed symbols in the AAB."
fi

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
