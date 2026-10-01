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