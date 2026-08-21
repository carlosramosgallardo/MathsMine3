#!/usr/bin/env bash
# Materialize release.keystore + keystore.properties from env secrets (cloud/CI).
# Never commit the generated files — they are gitignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE="$ROOT/apps/android-native"
KEYSTORE="$NATIVE/release.keystore"
PROPS="$NATIVE/keystore.properties"

if [[ -f "$PROPS" && -f "$KEYSTORE" ]]; then
  exit 0
fi

B64="${ANDROID_RELEASE_KEYSTORE_BASE64:-}"
STORE_PASS="${ANDROID_KEYSTORE_STORE_PASSWORD:-${ANDROID_KEYSTORE_PASSWORD:-}}"
KEY_ALIAS="${ANDROID_KEYSTORE_KEY_ALIAS:-${ANDROID_KEY_ALIAS:-mathsmine3}}"
KEY_PASS="${ANDROID_KEYSTORE_KEY_PASSWORD:-${ANDROID_KEY_PASSWORD:-$STORE_PASS}}"

if [[ -z "$B64" || -z "$STORE_PASS" ]]; then
  echo "Release signing not configured."
  echo "Set ANDROID_RELEASE_KEYSTORE_BASE64 + ANDROID_KEYSTORE_STORE_PASSWORD (and alias/password if non-default)."
  exit 1
fi

printf '%s' "$B64" | base64 -d > "$KEYSTORE"
chmod 600 "$KEYSTORE"

cat > "$PROPS" <<EOF
storeFile=release.keystore
storePassword=${STORE_PASS}
keyAlias=${KEY_ALIAS}
keyPassword=${KEY_PASS}
EOF
chmod 600 "$PROPS"

echo "Prepared release signing at $NATIVE (from env secrets)."
