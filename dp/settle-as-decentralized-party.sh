#!/usr/bin/env bash
# Settle under the netting operator's decentralized-party authority, and show
# that the host which proposed it cannot do so on its own.
#
#   bash dp/settle-as-decentralized-party.sh [party-prefix]
#
# The authority boundary is checked against the ledger, not asserted:
#
#   1. one operator host creates the obligation, the approval and the settlement
#      proposal - proposing is not settling, so one host may do all of that;
#   2. that same host tries to execute the settlement and is REJECTED, because
#      GovernableAction_Execute is controlled by `governanceParty`;
#   3. the settlement executes as the DP, archiving the obligation and issuing
#      receipts whose sole signatory is the DP.
#
# The 2-of-2 agreement standing between a host and the DP is enforced separately
# by GovernanceRules - see dp/prove-two-of-two.sh. This script is the other half:
# that the settlement itself is wired to run under the party's authority.
set -euo pipefail
cd "$(dirname "$0")/.."
source dp/lib-localnet.sh

PREFIX="${1:-netsettle-operator}"
DM_API=8091
LEDGER=3975
DAR="dp/daml-governed/.daml/dist/netsettle-governed-0.1.0.dar"

localnet_creds
export TPV="$(localnet_token AppProvider app-provider-validator "$PROV_SECRET")"
export TUV="$(localnet_token AppUser     app-user-validator     "$USER_SECRET")"

[ -f "$DAR" ] || { echo "build it first: (cd dp/daml-governed && dpm build)"; exit 1; }

DP="$(curl -fsS --max-time 30 -H "Authorization: Bearer $TPV" "http://localhost:$DM_API/decentralized-parties" \
  | jq -r --arg p "$PREFIX" '.parties[] | select(.party_id | startswith($p + "::")) | .party_id' | head -1)"
[ -n "$DP" ] || { echo "no operator party with prefix $PREFIX - run onboard-operator.sh first"; exit 1; }

PKG="$(dpm damlc inspect-dar "$DAR" 2>/dev/null | grep -oE 'netsettle-governed-0\.1\.0-[0-9a-f]{64}' | head -1 | grep -oE '[0-9a-f]{64}')"
[ -n "$PKG" ] || { echo "could not read the package id from $DAR"; exit 1; }

export DP PKG LEDGER
# Both sides of the obligation are this one party. That is a limitation of the
# LocalNet identity model, not a simplification of the test: our Keycloak user is
# entitled to exactly one party (app_provider_builder-localnet-1::1220b1a5…), and
# a JSON command carries one Authorization header, so an obligation needing two
# different parties' signatures cannot be co-signed from here. The app-user party
# would need its own transaction.
#
# It does not weaken what is under test. The claim is about *who may execute a
# settlement*, not about who owes what, and the debtor/creditor split plays no
# part in the authority boundary. The production netting path in daml/ keeps the
# split; only this governance scenario collapses it.
export PROV_PARTY="app_provider_builder-localnet-1::1220b1a5ea8acb1d400c7e82572b5151b9e923a0e2588a6e204c96335752f55ca8ab"
export SUB_PARTY="app_provider_builder-localnet-1::1220b1a5ea8acb1d400c7e82572b5151b9e923a0e2588a6e204c96335752f55ca8ab"
export TERMS_HASH="$(printf 'GOVERNED-1|EUR|100000' | sha256sum | cut -d' ' -f1)"
export SETTLEMENT_ID="SETTLE-GOVERNED-1"

echo "operator party  $DP"
echo "package         netsettle-governed-0.1.0-${PKG:0:16}…"
echo

echo "==> uploading the governed package to both participants"
# Two different identities, and mixing them up is the whole difficulty:
#
#   * package upload is a participant-admin action, so it wants the validator
#     token. A user token gets 403.
#   * submitting commands wants a *user* session, with userId set to the token's
#     `sub`. The validator token gets 403 on writes.
#
# Canton also refuses a submission until every informee has vetted the package
# (NO_SYNCHRONIZER_FOR_SUBMISSION), and the synchronizer's informees include the
# other participant - so the package must exist on both before anything is
# submitted, not just on the one doing the writing.
localnet_reset_user AppProvider app-provider
export TP="$(localnet_write_token AppProvider app-provider-unsafe app-provider)"
localnet_reset_user AppUser app-user
TU="$(localnet_write_token AppUser app-user-unsafe app-user)"
[ -n "$TP" ] && [ "$TP" != null ] && [ -n "$TU" ] && [ "$TU" != null ] \
  || { echo "could not get user tokens for both participants"; exit 1; }
export CANTON_USER_ID="$(localnet_user_id "$TP")"
# The interface choice is resolved against the governance-action package, not ours.
export GOV_ACTION_PKG="$(dpm damlc inspect-dar dp/daml-governed/.deps/governance-action-v1-0.1.0.dar 2>/dev/null | grep -oE 'governance-action-v1-0\.1\.0-[0-9a-f]{64}' | head -1 | grep -oE '[0-9a-f]{64}')"
[ -n "$GOV_ACTION_PKG" ] || { echo "run dp/vendor-governance.sh first"; exit 1; }
[ -n "$CANTON_USER_ID" ] || { echo "could not read the token's sub claim"; exit 1; }
echo "    user $CANTON_USER_ID (app-provider), $(localnet_user_id "$TU") (app-user)"
for pair in "$LEDGER:$TPV" "2975:$TUV"; do
  port="${pair%%:*}"; tok="${pair##*:}"
  curl -s -o /dev/null -w "    port $port upload -> HTTP %{http_code}\n" --max-time 300 -X POST \
    "http://localhost:$port/v2/packages" -H "Authorization: Bearer $tok" \
    -H 'Content-Type: application/octet-stream' --data-binary "@$DAR"
done

python3 dp/settle-scenario.py
status=$?

if [ $status -eq 3 ] || [ $status -eq 4 ]; then
  echo "see the \"Where it stops\" section of dp/README.md for the full account."
fi
exit $status
