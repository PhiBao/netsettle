#!/usr/bin/env bash
# Tear down the LocalNet and the Decentralization Manager nodes.
#
#   bash dp/down.sh          # stop everything, keep the data directories
#   bash dp/down.sh --purge  # stop and delete the data directories too
#
# Purging loses the decentralized party, its Noise identities and the ledger, so
# dp/reproduce.sh can build a new one from scratch.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"

docker rm -f dm-provider dm-user >/dev/null 2>&1 || true
echo "==> Decentralization Manager nodes stopped"

if command -v canton >/dev/null; then
  canton builder stop >/dev/null 2>&1 || true
  echo "==> LocalNet stopped"
fi

if [ "${1:-}" = "--purge" ]; then
  rm -rf /tmp/netsettle-dm-dm-provider /tmp/netsettle-dm-dm-user \
         dp/daml-governed/.deps dp/daml-governed/.daml
  echo "==> data directories deleted (party and ledger are gone; re-run dp/reproduce.sh)"
fi