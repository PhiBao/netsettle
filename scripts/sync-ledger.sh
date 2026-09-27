#!/usr/bin/env bash
# Rebuild the DAR, upload it to the local sandbox, and point the web app at
# the new package id. Every Daml rebuild changes the package id, so this must
# run after any daml/ change before starting the web app.
set -euo pipefail
cd "$(dirname "$0")/../daml"

NAME=$(awk '/^name:/{print $2; exit}' daml.yaml)
VERSION=$(awk '/^version:/{print $2; exit}' daml.yaml)
if [ -z "$NAME" ] || [ -z "$VERSION" ]; then
  echo "could not read name/version from daml/daml.yaml"; exit 1
fi
DAR=".daml/dist/${NAME}-${VERSION}.dar"

dpm build 2>&1 | tail -2
if [ ! -f "$DAR" ]; then echo "expected build artifact $DAR — check daml.yaml name/version"; exit 1; fi
PKG=$(dpm inspect-dar "$DAR" 2>/dev/null | grep -oE "^${NAME}-${VERSION}-[0-9a-f]{64}" | head -1 | sed -E 's/^.*-([0-9a-f]{64})$/\1/')
if [ -z "$PKG" ]; then echo "could not determine package id"; exit 1; fi

BASE_URL="${CANTON_JSON_API_URL:-http://localhost:6864}"

# The sandbox answers /v2/version before the package service accepts uploads
# (cold start), so retry instead of dying on the first 503.
upload() {
  curl -sf -X POST "$BASE_URL/v2/packages" \
    -H 'Content-Type: application/octet-stream' \
    --data-binary "@$DAR" > /dev/null
}
for attempt in $(seq 1 20); do
  if upload; then echo "uploaded package $PKG"; break; fi
  if [ "$attempt" -eq 20 ]; then echo "package upload failed after 20 attempts"; exit 1; fi
  echo "package service not ready, retrying ($attempt/20)…"
  sleep 3
done

# A rebuild keeps name+version but changes the package id, which would collide
# with the previously vetted build. Unvet older builds of this package first.
python3 - "$BASE_URL" "$PKG" "$NAME" <<'EOF'
import json, sys, time, urllib.request, urllib.error
base, pkg, name = sys.argv[1], sys.argv[2], sys.argv[3]
def post(path, body):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{path}: {e.code} {e.read().decode()[:200]}")
last = None
for attempt in range(10):
    try:
        post("/v2/package-vetting/update",
             {"changes": [{"operation": {"Unvet": {"value": {"packages": [{"packageName": name}]}}}}]})
        post("/v2/package-vetting/update",
             {"changes": [{"operation": {"Vet": {"value": {"packages": [{"packageId": pkg}]}}}}]})
        print("vetted", pkg[:12])
        break
    except SystemExit as e:
        last = e
        time.sleep(3)
else:
    raise SystemExit(f"vetting failed: {last}")
EOF

ENV_FILE="../apps/web/.env.local"
if grep -q '^CANTON_PACKAGE_ID=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s/^CANTON_PACKAGE_ID=.*/CANTON_PACKAGE_ID=$PKG/" "$ENV_FILE"
else
  echo "CANTON_PACKAGE_ID=$PKG" >> "$ENV_FILE"
fi
echo "synced $ENV_FILE"
