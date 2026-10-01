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
TP="$(localnet_token AppProvider app-provider-validator "$PROV_SECRET")"

[ -f "$DAR" ] || { echo "build it first: (cd dp/daml-governed && dpm build)"; exit 1; }

DP="$(curl -fsS --max-time 30 -H "Authorization: Bearer $TP" "http://localhost:$DM_API/decentralized-parties" \
  | jq -r --arg p "$PREFIX" '.parties[] | select(.party_id | startswith($p + "::")) | .party_id' | head -1)"
[ -n "$DP" ] || { echo "no operator party with prefix $PREFIX - run onboard-operator.sh first"; exit 1; }

PKG="$(dpm damlc inspect-dar "$DAR" 2>/dev/null | grep -oE 'netsettle-governed-0\.1\.0-[0-9a-f]{64}' | head -1 | grep -oE '[0-9a-f]{64}')"
[ -n "$PKG" ] || { echo "could not read the package id from $DAR"; exit 1; }

export DP PKG LEDGER TP
# Both parties are controlled by the app-provider participant: a participant may
# only act as parties whose keys it holds, so the subsidiary side of the
# obligation has to be one of its own. The cross-participant half of the claim is
# covered by the 2-of-2 proof in dp/prove-two-of-two.sh, which does need two
# separate participants.
export PROV_PARTY="app_provider_builder-localnet-1::1220b1a5ea8acb1d400c7e82572b5151b9e923a0e2588a6e204c96335752f55ca8ab"
export SUB_PARTY="participant::1220b1a5ea8acb1d400c7e82572b5151b9e923a0e2588a6e204c96335752f55ca8ab"
export TERMS_HASH="$(printf 'GOVERNED-1|EUR|100000' | sha256sum | cut -d' ' -f1)"
export SETTLEMENT_ID="SETTLE-GOVERNED-1"

echo "operator party  $DP"
echo "package         netsettle-governed-0.1.0-${PKG:0:16}…"
echo

echo "==> uploading the governed package to the participant"
for _ in 1 2; do
  curl -s -o /dev/null -w '    upload -> HTTP %{http_code}\n' --max-time 300 -X POST \
    "http://localhost:$LEDGER/v2/packages" -H "Authorization: Bearer $TP" \
    -H 'Content-Type: application/octet-stream' --data-binary "@$DAR"
done

python3 dp/settle-scenario.py
status=$?

if [ $status -eq 3 ]; then
  cat <<'MSG'

BLOCKED, not broken: this LocalNet's Keycloak mode will not issue a signing
session to an external client. Reads work with the validator token, but every
write returns:

    HTTP 403  "A security-sensitive error has been received"

That holds for all three confidential clients in the realm
(app-provider-validator, app-provider-backend, app-provider-pqs), so it is the
LocalNet identity model rather than the choice of credentials. The participant
only signs for users it holds a session for, and a client-credentials grant is
not one.

Two ways forward, neither of which this script pretends to have solved:

  * drive the settlement through the Decentralization Manager instead, which does
    hold signing sessions - but v1.12.0 only creates and confirms its own
    governance templates, and POST /contracts takes a fixed vocabulary of field
    types, so it cannot create a GovernedSettlement with obligation and approval
    CIDs.
  * run the same contracts against a self-signed LocalNet (canton builder start
    without --auth), where writes work - but then the Decentralization Manager
    cannot authenticate, so there is no party to settle under.

What is proven today, without this script:

  * the operator is a real 2-of-2 decentralized party      dp/verify-operator.sh
  * one host is refused by the ledger's own Daml contract  dp/prove-two-of-two.sh
  * this package implements GovernableAction, so the settlement is wired to run
    under the party's authority                         dp/daml-governed/

What is not proven: that NetSettle's settlement executes end to end as the party.
MSG
fi
exit $status
