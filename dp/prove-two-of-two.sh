#!/usr/bin/env bash
# Prove the netting operator cannot act on one host's say-so alone.
#
#   bash dp/prove-two-of-two.sh [party-prefix]
#
# The property under test is not "we run two processes". It is: a governed
# action submitted by ONE member is refused by the Daml contract on the ledger,
# and only succeeds once the second member has confirmed. The refusal therefore
# comes from Canton, not from our application - which is the whole point, because
# an application-level check is something the application can be edited past.
#
# Exits non-zero if the one-host attempt is ever allowed through.
set -euo pipefail
cd "$(dirname "$0")/.."
source dp/lib-localnet.sh

PREFIX="${1:-netsettle-operator}"
PROV_API=8091
USER_API=8092
DP="${DP:-}"

localnet_creds
TP="$(localnet_token AppProvider app-provider-validator "$PROV_SECRET")"
TU="$(localnet_token AppUser     app-user-validator     "$USER_SECRET")"

api() { # api <port> <token> <method> <path> [json]
  local port=$1 tok=$2 method=$3 path=$4 body=${5:-}
  if [ -n "$body" ]; then
    curl -s --max-time 300 -X "$method" "http://localhost:$port$path" \
      -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s --max-time 300 -X "$method" "http://localhost:$port$path" -H "Authorization: Bearer $tok"
  fi
}

[ -n "$DP" ] || DP="$(api $PROV_API "$TP" GET /decentralized-parties \
  | jq -r --arg p "$PREFIX" '.parties[] | select(.party_id | startswith($p + "::")) | .party_id' | head -1)"
[ -n "$DP" ] || { echo "no operator party with prefix $PREFIX - run onboard-operator.sh first"; exit 1; }

GOV="$(api $PROV_API "$TP" GET "/governance/confirmations?party_id=$DP")"
RULES_CID="$(printf '%s' "$GOV" | jq -r .rules_contract_id)"
THRESHOLD="$(printf '%s' "$GOV" | jq -r .threshold)"
[ -n "$RULES_CID" ] && [ "$RULES_CID" != null ] \
  || { echo "no GovernanceRules contract for $DP - run deploy-governance.sh first"; exit 1; }

echo "operator        $DP"
echo "rules contract  ${RULES_CID:0:24}…"
echo "threshold       $THRESHOLD"
echo

# A GenericVote is the smallest thing the governance package will carry, which
# keeps this test about the confirmation rule rather than about any one action.
# The two schemas differ: `proposal` is what gets voted on, `action` says which
# domain operation the vote authorises. We authorise "keep the threshold at 2",
# so even if the action were applied this test could not weaken the party.
PROPOSAL="$(jq -nc '{type:"generic_vote", description:"NetSettle operator: test that one host cannot act alone"}')"
ACTION="$(jq -nc '{type:"governance_set_threshold", new_threshold:2}')"

attempt_execute() { # attempt_execute <proposal-cid>
  local pcid=$1 st conf
  st="$(api $PROV_API "$TP" GET "/governance/confirmations?party_id=$DP")"
  conf="$(printf '%s' "$st" | jq -r '[.domain_actions[] | select(.proposal_cid == $p) | .confirmations[].contract_id] | join(",")' --arg p "$pcid")"
  api $PROV_API "$TP" POST /governance/execute "$(jq -nc \
    --arg p "$DP" --arg c "$RULES_CID" --arg pc "$pcid" --argjson a "$ACTION" --arg cids "$conf" \
    '{party_id:$p, rules_contract_id:$c, proposal_cid:$pc, action:$a,
      confirmation_cids:($cids|split(",")), disclosed_contracts:[], governance_type:"core_domain"}')"
}

echo "==> 1/4  host A proposes a governed action (proposal auto-confirms the proposer)"
RESP="$(api $PROV_API "$TP" POST /governance/propose \
  "$(jq -nc --arg p "$DP" --arg c "$RULES_CID" --argjson pr "$PROPOSAL" \
     '{party_id:$p, rules_contract_id:$c, proposal:$pr}')")"
PCID="$(printf '%s' "$RESP" | jq -r '.contract_id // .proposal_cid // empty')"
if [ -z "$PCID" ]; then
  PCID="$(api $PROV_API "$TP" GET "/governance/confirmations?party_id=$DP" | jq -r '.domain_actions[0].proposal_cid')"
fi
[ -n "$PCID" ] && [ "$PCID" != null ] || { echo "FAIL: proposal was not created ($RESP)"; exit 1; }
echo "    proposal ${PCID:0:24}…"

COUNT="$(api $PROV_API "$TP" GET "/governance/confirmations?party_id=$DP" \
  | jq --arg p "$PCID" '[.domain_actions[] | select(.proposal_cid == $p) | .confirmations | length] | first // 0')"
echo "    confirmations: $COUNT of $THRESHOLD"

echo
echo "==> 2/4  host A tries to execute ALONE  (the test)"
R="$(attempt_execute "$PCID")"
if printf '%s' "$R" | grep -q "Enough confirmations to execute action"; then
  echo "    REFUSED by the ledger contract:"
  printf '%s' "$R" | jq -r '.error' | sed "s/.*AssertionFailed://; s/\"}//" | sed 's/^/      /'
  REFUSED=yes
elif printf '%s' "$R" | grep -q "Action executed successfully"; then
  echo "    *** EXECUTED WITH ONE HOST - the property does not hold ***"
  REFUSED=no
else
  echo "    unexpected response: $(printf '%s' "$R" | head -c 200)"
  REFUSED=unknown
fi

echo
echo "==> 3/4  host B confirms"
api $USER_API "$TU" POST /governance/confirm "$(jq -nc \
  --arg p "$DP" --arg c "$RULES_CID" --arg pc "$PCID" --argjson a "$ACTION" \
  '{party_id:$p, rules_contract_id:$c, proposal_cid:$pc, action:$a, governance_type:"core_domain"}')" >/dev/null
sleep 4
COUNT="$(api $PROV_API "$TP" GET "/governance/confirmations?party_id=$DP" \
  | jq --arg p "$PCID" '[.domain_actions[] | select(.proposal_cid == $p) | .confirmations | length] | first // 0')"
echo "    confirmations: $COUNT of $THRESHOLD"

echo
echo "==> 4/4  the same action executes once both hosts have confirmed"
R="$(attempt_execute "$PCID")"
printf '%s' "$R" | jq -c . 2>/dev/null || printf '%s\n' "$R"

echo
AFTER="$(api $PROV_API "$TP" GET "/governance/confirmations?party_id=$DP" | jq -r .threshold)"
if [ "$REFUSED" = "yes" ] && printf '%s' "$R" | grep -q "Action executed successfully"; then
  [ "$AFTER" = "2" ] || { echo "FAIL: threshold is now $AFTER"; exit 1; }
  echo "PASS: one host was refused, both hosts succeeded, threshold still $AFTER."
  echo "      The refusal came from Governance.Rules on Canton, so it holds even"
  echo "      against an operator who controls the application code."
elif [ "$REFUSED" = "no" ]; then
  echo "FAIL: a single host was able to execute a governed action. Do not ship this claim."
  exit 1
else
  echo "INCONCLUSIVE: inspect the output above before claiming anything."
  exit 1
fi