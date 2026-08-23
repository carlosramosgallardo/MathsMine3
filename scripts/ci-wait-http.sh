#!/usr/bin/env bash
# Wait until an HTTP URL responds (any status < 500), then exit 0.
set -euo pipefail
url="${1:?usage: ci-wait-http.sh <url>}"
tries="${2:-45}"
sleep_s="${3:-2}"

for i in $(seq 1 "$tries"); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ "$code" =~ ^[1-4][0-9][0-9]$ ]]; then
    echo "ready ${url} HTTP ${code} (${i}/${tries})"
    exit 0
  fi
  echo "waiting ${url} HTTP ${code:-down} (${i}/${tries})"
  sleep "$sleep_s"
done

echo "timeout waiting for ${url}" >&2
exit 1
