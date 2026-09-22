#!/usr/bin/env bash
# Deploy NetSettle contracts to the shared HackCanton DevNet sandbox.
#
# The node is shared by all Season 3 teams: no sensitive data, and our package
# is uniquely named (netsettle) so vetting never collides with other teams.
#
# Usage:
#   1. Log into the wallet in your browser with your HackCanton platform
#      account:
#      https://wallet.validator.hackcanton-01.devnet.naas.noders.services
#   2. Copy your access token (DevTools -> Application -> Local Storage).
#   3. TOKEN=<paste> bash scripts/devnet-deploy.sh
#
# Output: apps/web/.env.devnet — point the app at it to run against DevNet.
set -euo pipefail

if [ -z "${TOKEN:-}" ]; then
  echo "TOKEN is required (your HackCanton wallet access token)." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services"
AUTH=(-H "Authorization: Bearer $TOKEN")
DAR="$ROOT/daml/.daml/dist/netsettle-0.1.0.dar"
[ -f "$DAR" ] || { echo "Build the DAR first: (cd daml && dpm build)"; exit 1; }

echo "== upload DAR =="
curl -sf -X POST "$BASE/v2/packages" "${AUTH[@]}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$DAR" > /dev/null
PKG=$(cd "$ROOT/daml" && dpm inspect-dar "$DAR" 2>/dev/null \
  | grep -oE '^netsettle-0\.1\.0-[0-9a-f]{64}' | head -1 | sed 's/^netsettle-0.1.0-//')
[ -n "$PKG" ] || { echo "Could not determine package id"; exit 1; }
echo "package: $PKG"

echo "== vet package =="
python3 - "$BASE" "$PKG" "$TOKEN" <<'EOF'
import json, sys, urllib.request, urllib.error
base, pkg, token = sys.argv[1], sys.argv[2], sys.argv[3]
def post(path, body):
    req = urllib.request.Request(
        base + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {token}"})
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{path}: {e.code} {e.read().decode()[:300]}")
post("/v2/package-vetting/update",
     {"changes": [{"operation": {"Vet": {"value": {"packages": [{"packageId": pkg}]}}}}]})
print("vetted", pkg[:12])
EOF

echo "== allocate parties (Daml Script over gRPC) =="
cat > /tmp/netsettle-devnet-participant.json <<EOF
{"participants": {"devnet": {
  "host": "ledger-api-grpc.participant.hackcanton-01.devnet.naas.noders.services",
  "port": 443,
  "ssl": {"enabled": true},
  "accessToken": "$TOKEN"
}}}
EOF
cd "$ROOT/daml"
dpm script --dar .daml/dist/netsettle-0.1.0.dar \
  --script-name NettingTest:setupParties \
  --participant-config /tmp/netsettle-devnet-participant.json \
  --output-file /tmp/netsettle-devnet-parties.json
dpm script --dar .daml/dist/netsettle-0.1.0.dar \
  --script-name NettingTest:setupDemoExtra \
  --participant-config /tmp/netsettle-devnet-participant.json \
  --output-file /tmp/netsettle-devnet-party-us.json
rm -f /tmp/netsettle-devnet-participant.json

PKG="$PKG" python3 - "$ROOT/apps/web/.env.devnet" <<'EOF'
import json, os, sys
env_path = sys.argv[1]
pkg = os.environ["PKG"]
parties = json.load(open("/tmp/netsettle-devnet-parties.json"))
us = json.load(open("/tmp/netsettle-devnet-party-us.json"))
op, de, fr, sg = parties["_1"], parties["_2"], parties["_3"], parties["_4"]
party_map = {"Acme DE": de, "Acme FR": fr, "Acme SG": sg, "Acme US": us}
lines = [
    "CANTON_JSON_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services",
    "CANTON_USER_ID=netting-app",
    f"CANTON_PACKAGE_ID={pkg}",
    f"CANTON_OPERATOR_PARTY={op}",
    f"CANTON_PARTY_MAP_JSON={json.dumps(party_map)}",
]
open(env_path, "w").write("\n".join(lines) + "\n")
print("wrote", env_path)
EOF
echo "done. Run the app with this env to target DevNet (staging only)."
