#!/usr/bin/env bash
# Rebuild the DAR, upload it to the local sandbox, and point the web app at
# the new package id. Every Daml rebuild changes the package id, so this must
# run after any daml/ change before starting the web app.
set -euo pipefail
cd "$(dirname "$0")/../daml"

dpm build 2>&1 | tail -2
DAR=".daml/dist/daml-0.0.1.dar"
PKG=$(dpm inspect-dar "$DAR" 2>/dev/null | grep -oE "^daml-0\.0\.1-[0-9a-f]{64}" | head -1 | sed 's/^daml-0.0.1-//')
if [ -z "$PKG" ]; then echo "could not determine package id"; exit 1; fi

BASE_URL="${CANTON_JSON_API_URL:-http://localhost:6864}"
curl -sf -X POST "$BASE_URL/v2/packages" \
  -H 'Content-Type: application/octet-stream' \
  --data-binary "@$DAR" > /dev/null
echo "uploaded package $PKG"

# A rebuild keeps name+version ("daml 0.0.1") but changes the package id, which
# would collide with the previously vetted build. Unvet older builds first.
python3 - "$BASE_URL" "$PKG" <<'EOF'
import json, sys, urllib.request, urllib.error
base, pkg = sys.argv[1], sys.argv[2]
def post(path, body):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{path}: {e.code} {e.read().decode()[:200]}")
post("/v2/package-vetting/update",
     {"changes": [{"operation": {"Unvet": {"value": {"packages": [{"packageName": "daml"}]}}}}]})
post("/v2/package-vetting/update",
     {"changes": [{"operation": {"Vet": {"value": {"packages": [{"packageId": pkg}]}}}}]})
print("vetted", pkg[:12])
EOF

ENV_FILE="../apps/web/.env.local"
if grep -q '^CANTON_PACKAGE_ID=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s/^CANTON_PACKAGE_ID=.*/CANTON_PACKAGE_ID=$PKG/" "$ENV_FILE"
else
  echo "CANTON_PACKAGE_ID=$PKG" >> "$ENV_FILE"
fi
echo "synced $ENV_FILE"
