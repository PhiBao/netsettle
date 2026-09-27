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

bash "$ROOT/scripts/sync-ledger.sh"
PKG=$(grep '^CANTON_PACKAGE_ID=' "$ROOT/apps/web/.env.local" | cut -d= -f2)
echo "package: $PKG"

echo "allocate demo parties via Daml Script…"
NAME=$(awk '/^name:/{print $2; exit}' daml.yaml)
VERSION=$(awk '/^version:/{print $2; exit}' daml.yaml)
DAR=".daml/dist/${NAME}-${VERSION}.dar"

# The sandbox's gRPC ledger can lag its HTTP API on a cold start, and a warm
# sandbox already holds the parties (the Daml script reuses them). Retry rather
# than failing a judge's first run.
run_script() {
  local script_name="$1" out_file="$2"
  for attempt in 1 2 3 4 5; do
    if dpm script --dar "$DAR" \
      --script-name "$script_name" \
      --ledger-host localhost --ledger-port 6865 \
      --output-file "$out_file" > /dev/null; then
      return 0
    fi
    echo "$script_name attempt $attempt/5 failed, retrying…"
    sleep 5
  done
  echo "$script_name failed after 5 attempts"; return 1
}
run_script NettingTest:setupParties /tmp/netting-parties.json
run_script NettingTest:setupDemoExtra /tmp/netting-party-us.json

python3 - "$ROOT/apps/web/.env.local" <<'EOF'
import json, os, sys
env_path = sys.argv[1]
parties = json.load(open("/tmp/netting-parties.json"))
us = json.load(open("/tmp/netting-party-us.json"))
op, de, fr, sg = parties["_1"], parties["_2"], parties["_3"], parties["_4"]
party_map = {"Acme DE": de, "Acme FR": fr, "Acme SG": sg, "Acme US": us}
try:
    raw = open(env_path).read()
except FileNotFoundError:
    raw = ""
lines = [l for l in raw.splitlines() if l.strip()]
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
