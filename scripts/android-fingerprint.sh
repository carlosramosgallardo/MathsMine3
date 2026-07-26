#!/usr/bin/env bash
# Print SHA-256 of the Android debug keystore (used for local TWA assetlinks).
set -euo pipefail
KEYSTORE="${ANDROID_KEYSTORE:-$HOME/.android/debug.keystore}"
ALIAS="${ANDROID_KEY_ALIAS:-androiddebugkey}"
STOREPASS="${ANDROID_KEYSTORE_PASS:-android}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Keystore not found: $KEYSTORE" >&2
  exit 1
fi

keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$STOREPASS" | grep -A1 'SHA256:'
