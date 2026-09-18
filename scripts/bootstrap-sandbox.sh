#!/usr/bin/env bash
# Fresh local demo environment from zero:
#   1. start the Canton sandbox (single-participant local ledger)
#   2. build + upload + vet the netting DAR
#   3. allocate demo parties
#   4. write apps/web/.env.local
#
# The sandbox is in-memory: restarting it wipes parties and contracts, which is
# exactly what you want before recording the demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/daml"

if ! curl -sf -o /dev/null http://localhost:6864/v2/version; then
  echo "starting sandbox…"
  mkdir -p log
  (nohup dpm sandbox > log/sandbox.out 2>&1 &)
  for _ in $(seq 1 30); do
    sleep 5
    curl -sf -o /dev/null http://localhost:6864/v2/version && break
  done
fi
echo "sandbox is up"

bash "$ROOT/scripts/sync-ledger.sh" > /dev/null
PKG=$(grep '^CANTON_PACKAGE_ID=' "$ROOT/apps/web/.env.local" | cut -d= -f2)
echo "package: $PKG"

BASE_URL="${CANTON_JSON_API_URL:-http://localhost:6864}"
python3 - "$BASE_URL" "$PKG" <<'EOF'
import json, sys, urllib.request, urllib.error
base, pkg = sys.argv[1], sys.argv[2]

def post(path, body):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{path}: {e.code} {e.read().decode()[:300]}")

# Unvet any older build of this package, then vet the current one.
post("/v2/package-vetting/update",
     {"changes": [{"operation": {"Unvet": {"value": {"packages": [{"packageName": "daml"}]}}}}]})
post("/v2/package-vetting/update",
     {"changes": [{"operation": {"Vet": {"value": {"packages": [{"packageId": pkg}]}}}}]})
print("vetted", pkg[:12])
EOF

echo "allocate demo parties via Daml Script…"
dpm script --dar .daml/dist/daml-0.0.1.dar \
  --script-name NettingTest:setupParties \
  --ledger-host localhost --ledger-port 6865 \
  --output-file /tmp/netting-parties.json > /dev/null 2>&1
dpm script --dar .daml/dist/daml-0.0.1.dar \
  --script-name NettingTest:setupDemoExtra \
  --ledger-host localhost --ledger-port 6865 \
  --output-file /tmp/netting-party-us.json > /dev/null 2>&1

python3 - "$ROOT/apps/web/.env.local" <<'EOF'
import json, os, sys
env_path = sys.argv[1]
parties = json.load(open("/tmp/netting-parties.json"))
us = json.load(open("/tmp/netting-party-us.json"))
op, de, fr, sg = parties["_1"], parties["_2"], parties["_3"], parties["_4"]
party_map = {"Acme DE": de, "Acme FR": fr, "Acme SG": sg, "Acme US": us}
lines = [l for l in open(env_path).read().splitlines() if l.strip()]
have = {l.split("=", 1)[0] for l in lines if "=" in l}
defaults = {
    "CANTON_JSON_API_URL": os.environ.get("CANTON_JSON_API_URL", "http://localhost:6864"),
    "CANTON_USER_ID": os.environ.get("CANTON_USER_ID", "netting-app"),
}
for key, value in defaults.items():
    if key not in have:
        lines.append(f"{key}={value}")
lines = [l for l in lines
         if not l.startswith(("CANTON_OPERATOR_PARTY=", "CANTON_PARTY_MAP_JSON="))]
lines += [f"CANTON_OPERATOR_PARTY={op}",
          f"CANTON_PARTY_MAP_JSON={json.dumps(party_map)}"]
open(env_path, "w").write("\n".join(lines) + "\n")
print("wrote operator +", len(party_map), "parties to", env_path)
EOF
echo "done. start the app with: pnpm --filter @netting/web start"
