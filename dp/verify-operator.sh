#!/usr/bin/env bash
# Assert the netting operator really is a 2-of-2 decentralized party.
# Exits non-zero if the threshold or the owner count regressed.
#   bash dp/verify-operator.sh [party-prefix]   (default: netsettle-operator)
set -euo pipefail
source "$(dirname "$0")/lib-localnet.sh"

PREFIX="${1:-netsettle-operator}"
PROV_API=8091
localnet_creds
TOKEN="$(localnet_token AppProvider app-provider-validator "$PROV_SECRET")"

read -r PARTY THRESHOLD OWNERS <<<"$(curl -fsS --max-time 30 \
  -H "Authorization: Bearer $TOKEN" "http://localhost:$PROV_API/decentralized-parties" \
  | jq -r --arg p "$PREFIX" \
    '.parties[] | select(.party_id | startswith($p + "::")) | "\(.party_id) \(.threshold) \(.owners | length)"' \
  | head -1)"

echo "party      $PARTY"
echo "threshold  $THRESHOLD"
echo "owners     $OWNERS"

fail=0
[ "$THRESHOLD" = "2" ] || { echo "FAIL: threshold is $THRESHOLD, expected 2"; fail=1; }
[ "$OWNERS" -ge 2 ] || { echo "FAIL: $OWNERS owner(s), expected at least 2"; fail=1; }
case "$PARTY" in "$PREFIX"::*) ;; *) echo "FAIL: no party with prefix $PREFIX (got ${PARTY:-none})"; fail=1;; esac

[ "$fail" -eq 0 ] && echo "PASS: operator requires agreement from 2 independent hosts" || exit 1