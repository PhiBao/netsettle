#!/usr/bin/env bash
# Create the NetSettle netting operator as a 2-of-2 decentralized party.
#
#   bash dp/onboard-operator.sh [party-prefix]
#
# Sequence (each step is idempotent enough to re-run after a failure):
#   1. read each node's participant id + Noise key
#   2. exchange them so both nodes can reach each other over Noise
#   3. coordinator invites the peer with threshold 2
#   4. peer accepts; the workflow co-signs the P2P proposal
#   5. the party namespace lands on Canton
set -euo pipefail
source "$(dirname "$0")/lib-localnet.sh"

PREFIX="${1:-netsettle-operator}"
KC="http://127.0.0.1:8082"
PROV_API=8091
USER_API=8092
PROV_REALM=AppProvider
USER_REALM=AppUser

localnet_creds
token() { localnet_token "$@"; }

TP="$(token "$PROV_REALM" app-provider-validator "$PROV_SECRET")"
TU="$(token "$USER_REALM" app-user-validator "$USER_SECRET")"

api() { # api <port> <token> <method> <path> [body]
  local port=$1 tok=$2 method=$3 path=$4 body=${5:-}
  if [ -n "$body" ]; then
    curl -fsS --max-time 60 -X "$method" "http://localhost:$port$path" \
      -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS --max-time 60 -X "$method" "http://localhost:$port$path" -H "Authorization: Bearer $tok"
  fi
}

PROV_PARTICIPANT="$(api $PROV_API "$TP" GET /node-config | jq -r '.node.participant_id')"
USER_PARTICIPANT="$(api $USER_API "$TU" GET /node-config | jq -r '.node.participant_id')"
PROV_KEY="$(api $PROV_API "$TP" GET /keys/status | jq -r .public_key)"
USER_KEY="$(api $USER_API "$TU" GET /keys/status | jq -r .public_key)"
PROV_NOISE="$(api $PROV_API "$TP" GET /node-config | jq -r '.node.port')"
USER_NOISE="$(api $USER_API "$TU" GET /node-config | jq -r '.node.port')"
echo "participants:"
echo "  provider $PROV_PARTICIPANT  noise :$PROV_NOISE  key ${PROV_KEY:0:16}…"
echo "  user     $USER_PARTICIPANT  noise :$USER_NOISE  key ${USER_KEY:0:16}…"

echo "==> 1/4 party credentials (first-run bootstrap, unauthenticated on a fresh node)"
api $PROV_API "$TP" PUT /party-config "$(jq -nc --arg p "$PROV_PARTICIPANT" \
  '{dec_party_id:$p, member_party_id:$p, user_id:"app-provider-validator",
    keycloak_url:"http://keycloak.localhost:8082", keycloak_realm:"AppProvider",
    keycloak_client_id:"app-provider-validator",
    keycloak_client_secret:env.PROV_SECRET}')" >/dev/null
api $USER_API "$TU" PUT /party-config "$(jq -nc --arg p "$USER_PARTICIPANT" \
  '{dec_party_id:$p, member_party_id:$p, user_id:"app-user-validator",
    keycloak_url:"http://keycloak.localhost:8082", keycloak_realm:"AppUser",
    keycloak_client_id:"app-user-validator",
    keycloak_client_secret:env.USER_SECRET}')" >/dev/null
echo "    ok"

# POST /network-config takes a bare array, and peers are identified by
# participant id with their Noise endpoint.
echo "==> 2/4 exchange Noise peer details"
api $PROV_API "$TP" POST /network-config "$(jq -nc --arg id "$USER_PARTICIPANT" \
  --arg key "$USER_KEY" --argjson port "$USER_NOISE" \
  '[{participant_id:$id,name:"app-user",address:"127.0.0.1",port:$port,public_key:$key}]')" >/dev/null
api $USER_API "$TU" POST /network-config "$(jq -nc --arg id "$PROV_PARTICIPANT" \
  --arg key "$PROV_KEY" --argjson port "$PROV_NOISE" \
  '[{participant_id:$id,name:"app-provider",address:"127.0.0.1",port:$port,public_key:$key}]')" >/dev/null
for _ in $(seq 1 20); do
  st="$(api $PROV_API "$TP" GET /participants-status | jq -r '.statuses[0].status // ""')"
  [ "$st" = "Connected" ] && break
  sleep 2
done
echo "    peer status: $(api $PROV_API "$TP" GET /participants-status | jq -c '.statuses')"

echo "==> 3/4 coordinator invites the peer (threshold 2)"
curl -fsS --max-time 60 -X POST "http://localhost:$PROV_API/onboarding/cancel" \
  -H "Authorization: Bearer $TP" -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1 || true
sleep 2
api $PROV_API "$TP" POST /onboarding \
  "$(jq -nc --arg p "$PREFIX" --arg peer "$USER_PARTICIPANT" \
    '{party_id_prefix:$p, peer_ids:[$peer], threshold:2}')" >/dev/null
sleep 10

echo "==> 4/4 peer accepts; both co-sign the P2P proposal"
INVITE="$(api $USER_API "$TU" GET /invitations | jq -r '.invitations[0].id')"
echo "    invite: $INVITE (threshold $(api $USER_API "$TU" GET /invitations | jq -r '.invitations[0].new_threshold'))"
api $USER_API "$TU" POST /invitations/accept "$(jq -nc --arg id "$INVITE" '{id:$id}')" >/dev/null

for _ in $(seq 1 40); do
  s="$(api $PROV_API "$TP" GET /onboarding/status | jq -r '.status // ""')"
  [ "$s" = "completed" ] && break
  [ "$s" = "failed" ] && { echo "    workflow failed"; exit 1; }
  sleep 3
done

echo
api $PROV_API "$TP" GET /decentralized-parties | jq '.parties[] | {party_id, threshold, owners: (.owners | length)}'
echo
echo "verify with: bash dp/verify-operator.sh"