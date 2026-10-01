#!/usr/bin/env bash
# Shared helpers for the LocalNet + Decentralization Manager scripts.
#
#   source dp/lib-localnet.sh
#
# ## Why nothing here hardcodes a credential
#
# These scripts talk to the Keycloak that `canton builder start` generates for
# its throwaway LocalNet. That client secret is a *fixture of the public Canton
# Builder Tool* - the same literal appears in the tool's own published test
# suite - so it is not a secret of ours and there is nothing to rotate. It is
# still wrong to commit it: a repository that trips secret scanners on every
# commit teaches reviewers to ignore alerts, which is how a real leak gets
# missed. So we read it from the realm file the tool already wrote to disk.
#
# Override with PROV_SECRET / USER_SECRET if you run against your own IdP.

set -euo pipefail

REALM_DIR="${REALM_DIR:-$HOME/.canton-builder/modules/keycloak/conf/data}"

# localnet_secret <Realm> <client-id>
localnet_secret() {
  local realm=$1 client=$2 file="$REALM_DIR/$1-realm.json"
  if [ ! -f "$file" ]; then
    echo "error: no Keycloak realm file at $file" >&2
    echo "       run 'bash dp/up-localnet.sh' first (it starts LocalNet with --auth)." >&2
    return 1
  fi
  jq -r --arg c "$client" \
    '.clients[] | select(.clientId == $c) | .secret // empty' "$file"
}

# localnet_token <Realm> <client-id> <secret> -> bearer token on stdout
localnet_token() {
  local realm=$1 client=$2 secret=$3 token
  [ -n "$secret" ] || { echo "error: empty client secret for $realm/$client" >&2; return 1; }
  token="$(curl -fsS --max-time 30 \
    -X POST "http://127.0.0.1:8082/realms/$realm/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "client_id=$client" -d "client_secret=$secret" \
    -d 'grant_type=client_credentials' -d 'scope=openid' \
    | jq -r .access_token)"
  [ -n "$token" ] && [ "$token" != null ] \
    || { echo "error: could not get a token for $realm/$client (is LocalNet up?)" >&2; return 1; }
  printf '%s' "$token"
}

# Resolve both LocalNet validator credentials, preferring the environment.
localnet_creds() {
  PROV_SECRET="${PROV_SECRET:-$(localnet_secret AppProvider app-provider-validator)}"
  USER_SECRET="${USER_SECRET:-$(localnet_secret AppUser     app-user-validator)}"
  export PROV_SECRET USER_SECRET
}

# ============================================================================
# Writing to the ledger
# ============================================================================
#
# A client-credentials token can READ from a LocalNet participant but cannot
# WRITE to it. The participant only signs for users it holds a session for, and a
# client-credentials grant is not one; the failure surfaces as an unhelpful
#
#     HTTP 403  "A security-sensitive error has been received"
#
# Two things are needed for a write, and each one fails differently:
#
#   * a *user* token (password grant against a public direct-grant client), not a
#     service-account token;
#   * `userId` in the command body set to the token's `sub` claim - the user's
#     UUID, not their username. Getting this wrong is the same 403, and the
#     participant log is the only place that says so:
#
#       PERMISSION_DENIED: Claims are only valid for userId '553c6754-…',
#                          actual userId is 'app-provider'
#
# LocalNet users have argon2-hashed passwords we cannot recover, so we reset one
# through the Keycloak admin API. That is fine here and only here: this Keycloak
# belongs to a throwaway LocalNet on our own machine, it holds no data of ours,
# and `canton builder stop` throws all of it away.

LOCALNET_KEYCLOAK="${LOCALNET_KEYCLOAK:-http://127.0.0.1:8082}"
LOCALNET_AUDIENCE="${LOCALNET_AUDIENCE:-https://canton.network.global}"
LOCALNET_ADMIN_PASSWORD="${LOCALNET_ADMIN_PASSWORD:-admin}"
LOCALNET_USER_PASSWORD="${LOCALNET_USER_PASSWORD:-netsettle-localnet}"

# localnet_admin_token -> bearer token for the Keycloak master realm
localnet_admin_token() {
  curl -fsS --max-time 30 -X POST "$LOCALNET_KEYCLOAK/realms/master/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d 'client_id=admin-cli' -d 'username=admin' -d "password=$LOCALNET_ADMIN_PASSWORD" \
    -d 'grant_type=password' | jq -r '.access_token'
}

# localnet_reset_user <Realm> <username>
localnet_reset_user() {
  local realm=$1 user=$2 token id
  token="$(localnet_admin_token)"
  id="$(curl -fsS --max-time 30 -H "Authorization: Bearer $token" \
    "$LOCALNET_KEYCLOAK/admin/realms/$realm/users?username=$user" | jq -r '.[0].id')"
  [ -n "$id" ] && [ "$id" != null ] || { echo "error: no LocalNet user '$user' in realm $realm" >&2; return 1; }
  curl -fsS --max-time 30 -o /dev/null -X PUT \
    "$LOCALNET_KEYCLOAK/admin/realms/$realm/users/$id/reset-password" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg p "$LOCALNET_USER_PASSWORD" '{type:"password", value:$p, temporary:false}')"
}

# localnet_write_token <Realm> <public-client-id> <username> -> token that can write
#
# The direct-grant clients are named after the participant, not the realm:
# realm AppProvider has `app-provider-unsafe`, realm AppUser has `app-user-unsafe`.
# They are public (no secret), which is why the password grant is the only way in.
localnet_write_token() {
  local realm=$1 client=$2 user=$3
  curl -fsS --max-time 30 -X POST \
    "$LOCALNET_KEYCLOAK/realms/$realm/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "client_id=$client" -d "username=$user" \
    -d "password=$LOCALNET_USER_PASSWORD" -d 'grant_type=password' -d 'scope=openid' \
    -d "audience=$LOCALNET_AUDIENCE" | jq -r '.access_token'
}

# localnet_user_id <token> -> the `sub` claim, which is what userId must be
localnet_user_id() {
  jq -r '.sub // empty' <<<"$(cut -d. -f2 <<<"$1" | base64 -d 2>/dev/null)"
}