#!/usr/bin/env bash
# Settle the intercompany cycle under the netting operator party's authority,
# with the Decentralization Manager driving the governed execution.
#
#   bash dp/settle-as-decentralized-party.sh [party-prefix]
#
# This is the flow DLC-link documents in docs/CUSTOM_DAML_TEMPLATES.md, and it
# is what closes the claim:
#
#   1. one operator host creates the obligation, the approval, and the settlement
#      proposal. The proposal's sole signatory is the proposing host, because
#      `proposer` being the only signatory is what the governance engine requires
#      - that is how one member files a proposal without a multi-party ceremony.
#   2. the host tries to execute the settlement itself and is REFUSED, with Daml
#      naming the party whose authority was missing. Proposing is not settling.
#   3. each member confirms the proposal through the DM, and once the threshold is
#      met the DM executes it as the party. `executeImpl` then settles the
#      obligations and issues receipts signed by the party alone.
#
# Step 3 is the one that requires the DM: only it holds a signing session for the
# party's namespace. Steps 1 and 2 need only ordinary Ledger API writes.
set -euo pipefail
cd "$(dirname "$0")/.."
source dp/lib-localnet.sh

PREFIX="${1:-netsettle-operator}"
DM_API=8091
DM_API2=8092
LEDGER=3975
# Discovered, not hardcoded, so bumping the package version in daml.yaml does not
# silently break this script.
DAR="$(ls -t dp/daml-governed/.daml/dist/netsettle-governed*-[0-9]*.dar 2>/dev/null | head -1)"

localnet_creds
export TPV="$(localnet_token AppProvider app-provider-validator "$PROV_SECRET")"
export TUV="$(localnet_token AppUser     app-user-validator     "$USER_SECRET")"

[ -f "$DAR" ] || { echo "build it first: (cd dp/daml-governed && dpm build)"; exit 1; }

DP="$(curl -fsS --max-time 30 -H "Authorization: Bearer $TPV" "http://localhost:$DM_API/decentralized-parties" \
  | jq -r --arg p "$PREFIX" '.parties[] | select(.party_id | startswith($p + "::")) | .party_id' | head -1)"
[ -n "$DP" ] || { echo "no operator party with prefix $PREFIX - run onboard-operator.sh first"; exit 1; }

PKG="$(dpm damlc inspect-dar "$DAR" 2>/dev/null | grep -oE 'netsettle-governed[a-z0-9-]*-[0-9.]+-[0-9a-f]{64}' | head -1 | grep -oE '[0-9a-f]{64}')"
[ -n "$PKG" ] || { echo "could not read the package id from $DAR"; exit 1; }
# The interface choice is resolved against the governance-action package.
GOV_DAR="$(ls -t dp/daml-governed/.deps/governance-action-v1-*.dar 2>/dev/null | head -1)"
GOV_ACTION="$(dpm damlc inspect-dar "$GOV_DAR" 2>/dev/null \
  | grep -oE 'governance-action-v1-[0-9.]+-[0-9a-f]{64}' | head -1 | grep -oE '[0-9a-f]{64}')"
[ -n "$GOV_ACTION" ] || { echo "run dp/vendor-governance.sh first"; exit 1; }

echo "operator party  $DP"
echo "our package     $(basename "$DAR" .dar | sed "s/-[0-9a-f]\{64\}$/…/")"
echo "interface from  governance-action-v1-${GOV_ACTION:0:16}…"
echo

# Two identities, two purposes. Package upload is participant-admin and wants the
# validator token; submitting commands wants a user session. Mixing them up is a
# 403 either way, and so is using the username instead of the token's `sub` as
# the userId - dp/lib-localnet.sh explains all of it.
echo "==> obtaining a LocalNet user session and vetting the package on both participants"
localnet_reset_user AppProvider app-provider
export TP="$(localnet_write_token AppProvider app-provider-unsafe app-provider)"
localnet_reset_user AppUser app-user
TU="$(localnet_write_token AppUser app-user-unsafe app-user)"
[ -n "$TP" ] && [ "$TP" != null ] && [ -n "$TU" ] && [ "$TU" != null ] \
  || { echo "could not get user tokens for both participants"; exit 1; }
export CANTON_USER_ID="$(localnet_user_id "$TP")"
[ -n "$CANTON_USER_ID" ] || { echo "could not read the token's sub claim"; exit 1; }
for pair in "$LEDGER:$TPV" "2975:$TUV"; do
  port="${pair%%:*}"; tok="${pair##*:}"
  code="$(curl -s -o /tmp/opencode/up.json -w '%{http_code}' --max-time 300 -X POST \
    "http://localhost:$port/v2/packages" -H "Authorization: Bearer $tok" \
    -H 'Content-Type: application/octet-stream' --data-binary "@$DAR")"
  printf '    port %s upload -> HTTP %s %s\n' "$port" "$code" "$(head -c 160 /tmp/opencode/up.json)"
done
echo "    user $CANTON_USER_ID (app-provider), $(localnet_user_id "$TU") (app-user)"

# Both sides of the obligation are this one party. A limitation of the LocalNet
# identity model: our Keycloak user is entitled to exactly one party, and a JSON
# command carries one Authorization header, so an obligation needing two parties'
# signatures cannot be co-signed from here. It does not weaken what is under test
# - the claim is about who may execute a settlement, not about who owes what, and
# the production netting path in daml/ keeps the split.
export PROV_PARTY="app_provider_builder-localnet-1::1220b1a5ea8acb1d400c7e82572b5151b9e923a0e2588a6e204c96335752f55ca8ab"
# Unique per run, so the receipts a run issues can be told apart from earlier
# runs'. A fixed id would make the receipt count silently accumulate and the
# evidence for *this* settlement ambiguous.
export SETTLEMENT_ID="SETTLE-GOVERNED-$(date +%s)-$$"
export TERMS_HASH="$(printf '%s|EUR|100000' "$SETTLEMENT_ID" | sha256sum | cut -d' ' -f1)"

export DP PKG GOV_ACTION LEDGER DM_API DM_API2 TP TUV TU

python3 dp/settle-scenario.py "$@"
status=$?
if [ $status -eq 3 ] || [ $status -eq 4 ]; then
  echo
  echo 'see the "Where it stops" section of dp/README.md for the full account.'
fi
exit $status