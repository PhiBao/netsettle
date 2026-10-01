#!/usr/bin/env bash
# Deploy a GovernanceRules contract for the 2-of-2 NetSettle operator and prove
# that one host alone cannot settle.
#
#   bash dp/deploy-governance.sh [party-prefix]
#
# The contract is created by the decentralized party itself, with both members
# in the party set and threshold 2. Afterwards we submit a governed action from
# ONE member and assert it does not execute until the second confirms - that is
# the property the whole exercise exists to demonstrate.
set -euo pipefail
cd "$(dirname "$0")/.."
source dp/lib-localnet.sh

PREFIX="${1:-netsettle-operator}"
KC="http://127.0.0.1:8082"
PROV_API=8091
USER_API=8092
GOV_DIR="${GOV_DIR:-/tmp/netsettle-gov}"
DAR="${DAR:-daml/.daml/dist/netsettle-0.1.0.dar}"

mkdir -p "$GOV_DIR"
for f in governance-core-v1-0.1.0.dar governance-action-v1-0.1.0.dar; do
  [ -f "$GOV_DIR/$f" ] || curl -fsSL --max-time 120 -o "$GOV_DIR/$f" \
    "https://raw.githubusercontent.com/DLC-link/decentralization-manager/main/releases/v1/$f"
done

localnet_creds
token() { localnet_token "$@"; }
TP="$(token AppProvider app-provider-validator "$PROV_SECRET")"
TU="$(token AppUser app-user-validator "$USER_SECRET")"

api() { # api <port> <token> <method> <path> [json-body]
  local port=$1 tok=$2 method=$3 path=$4 body=${5:-}
  if [ -n "$body" ]; then
    curl -fsS --max-time 300 -X "$method" "http://localhost:$port$path" \
      -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS --max-time 300 -X "$method" "http://localhost:$port$path" -H "Authorization: Bearer $tok"
  fi
}

DP="$(api $PROV_API "$TP" GET /decentralized-parties \
  | jq -r --arg p "$PREFIX" '.parties[] | select(.party_id | startswith($p + "::")) | .party_id' | head -1)"
PROV_PARTICIPANT="$(api $PROV_API "$TP" GET /node-config | jq -r '.node.participant_id')"
USER_PARTICIPANT="$(api $USER_API "$TU" GET /node-config | jq -r '.node.participant_id')"
PROV_PARTY="app_provider_builder-localnet-1::1220b1a5ea8acb1d400c7e82572b5151b9e923a0e2588a6e204c96335752f55ca8ab"
USER_PARTY="app_user_builder-localnet-1::1220d5ad87bc5f1ba38f04b72a69cda65c25780d831d63588a8d98c5673cd0acd804"
[ -n "$DP" ] || { echo "no operator party with prefix $PREFIX - run onboard-operator.sh first"; exit 1; }
echo "operator    $DP"
echo "participants $PROV_PARTICIPANT"
echo "            $USER_PARTICIPANT"

b64() { base64 -w0 < "$1"; }

echo "==> uploading DARs to both participants (idempotent: 409 means present)"
up() {
  local port=$1 tok=$2 dar=$3
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 300 -X POST "http://localhost:$port/v2/packages" \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/octet-stream' --data-binary "@$dar")"
  printf '    %-5s %-40s %s\n' "$port" "$(basename "$dar")" "$code"
}
up 3975 "$TP" "$GOV_DIR/governance-core-v1-0.1.0.dar"
up 3975 "$TP" "$GOV_DIR/governance-action-v1-0.1.0.dar"
up 3975 "$TP" "$DAR"
up 2975 "$TU" "$GOV_DIR/governance-core-v1-0.1.0.dar"
up 2975 "$TU" "$GOV_DIR/governance-action-v1-0.1.0.dar"
up 2975 "$TU" "$DAR"

GOVCORE="$(curl -fsS --max-time 30 -H "Authorization: Bearer $TP" "http://localhost:$PROV_API/packages?party_id=$PROV_PARTICIPANT" \
  | jq -r '.governance_core')"
echo "governance_core reference: $GOVCORE"

echo "==> deploying GovernanceRules as the operator (both members, threshold 2)"
# The DARs are megabytes: base64 them straight into a file. Passing them as
# jq arguments overflows ARG_MAX.
PAYLOAD="$(mktemp)"
trap 'rm -f "$PAYLOAD"' EXIT
python3 - "$PAYLOAD" "$DP" "$PROV_PARTICIPANT" "$USER_PARTICIPANT" "$PROV_PARTY" "$USER_PARTY" \
    "$GOV_DIR/governance-core-v1-0.1.0.dar" "$GOV_DIR/governance-action-v1-0.1.0.dar" "$DAR" <<'PY'
import base64, json, sys
out, dp, p1, p2, m1, m2, core, action, netsettle = sys.argv[1:10]
dar = lambda path: {"filename": path.rsplit("/", 1)[-1],
                     "data": base64.b64encode(open(path, "rb").read()).decode()}
json.dump({
    "decentralized_party_id": dp,
    "participant_ids": [p1, p2],
    "participant_parties": [m1, m2],
    "operator_party": dp,
    "dar_files": [dar(core), dar(action), dar(netsettle)],
    "contracts": [{
        "id": "governance-rules",
        "name": "GovernanceRules",
        "package_id": "#governance-core-v1",
        "module_name": "Governance.Rules",
        "entity_name": "GovernanceRules",
        "fields": [
            {"type": "decentralized_party"},
            {"type": "party_set", "parties": [m1, m2]},
            {"type": "governance_threshold"},
            {"type": "rel_time", "microseconds": 86400000000},
            {"type": "optional", "inner": {"type": "party_set", "parties": []}}
        ]
    }]
}, open(out, "w"))
PY

# The Contracts workflow submits *as the decentralized party*, so each node
# needs credentials for the DP itself (not just for its own participant party).
# discover-member-party returns the Keycloak user id and this node's member
# party inside the DP. This must happen before POST /contracts, otherwise the
# workflow fails with "No credentials configured for party".
echo "==> registering credentials for the party itself on both nodes"
configure_party() { # configure_party <api> <token> <realm> <client> <secret> <member-party>
  local api=$1 tok=$2 realm=$3 client=$4 secret=$5 member=$6
  local uid
  uid="$(api "$api" "$tok" POST /party-config/discover-member-party \
    "$(jq -nc --arg dp "$DP" --arg realm "$realm" --arg client "$client" --arg secret "$secret" \
       '{dec_party_id:$dp, keycloak_url:"http://keycloak.localhost:8082", keycloak_realm:$realm,
         keycloak_client_id:$client, keycloak_client_secret:$secret}')" | jq -r .user_id)"
  api "$api" "$tok" PUT /party-config \
    "$(jq -nc --arg dp "$DP" --arg m "$member" --arg uid "$uid" \
       --arg realm "$realm" --arg client "$client" --arg secret "$secret" \
       --arg core "$GOVCORE_HEX" \
       '{dec_party_id:$dp, member_party_id:$m, user_id:$uid,
         keycloak_url:"http://keycloak.localhost:8082", keycloak_realm:$realm,
         keycloak_client_id:$client, keycloak_client_secret:$secret,
         governance_core:$core}')" >/dev/null
  echo "    $realm user_id=$uid"
}
GOVCORE_HEX="361d1f2857f833f8094caf86ecdd5daaa3e2075c22dafe2bf18cde63ee98d488"
configure_party $PROV_API "$TP" AppProvider app-provider-validator "$PROV_SECRET" "$PROV_PARTY"
configure_party $USER_API "$TU" AppUser     app-user-validator     "$USER_SECRET" "$USER_PARTY"

echo "==> deploying GovernanceRules as the operator (both members, threshold 2)"
curl -sS --max-time 600 -X POST "http://localhost:$PROV_API/contracts" \
  -H "Authorization: Bearer $TP" -H 'Content-Type: application/json' \
  --data-binary "@$PAYLOAD" | jq '.' || true

# The peer holds the same invitation until it accepts; do that, then wait.
sleep 12
INVITE="$(api $USER_API "$TU" GET /invitations | jq -r '.invitations[]? | select(.invitation_type=="Contracts") | .id' | head -1)"
if [ -n "$INVITE" ]; then
  echo "==> peer accepts the contracts invitation ($INVITE)"
  api $USER_API "$TU" POST /invitations/accept "$(jq -nc --arg id "$INVITE" '{id:$id}')" >/dev/null
fi

for _ in $(seq 1 40); do
  s="$(api $PROV_API "$TP" GET /workflows 2>/dev/null | jq -r '[.workflows[]? | select(.name | startswith("netsettle-operator-contracts")) | .status] | first // ""')"
  case "$s" in completed) echo "==> contracts workflow completed"; break;; failed) echo "==> contracts workflow FAILED"; break;; esac
  sleep 3
done
docker logs dm-provider 2>&1 | grep -iE "GovernanceRules|contract.*creat|workflow.*(complet|fail)" | tail -5 || true