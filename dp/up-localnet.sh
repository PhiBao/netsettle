#!/usr/bin/env bash
# Bring up a LocalNet with Keycloak plus one Decentralization Manager node per
# participant, ready to onboard a 2-of-2 decentralized party.
#
#   bash dp/up-localnet.sh
#
# Ports (LocalNet runs all participants in one container):
#   app-provider  admin 3902  ledger 3901  DM api 8091  noise 9151
#   app-user      admin 2902  ledger 2901  DM api 8092  noise 9152
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.local/bin:$PATH"
DM_IMAGE="public.ecr.aws/dlc-link/decentralization-manager:v1.12.0"

# LocalNet prompts for /etc/hosts edits on stdin and aborts under `set -e` when
# stdin is closed, so feed it answers. We only need the JSON/gRPC APIs.
printf 'n\nn\nn\nn\n' > /tmp/netsettle-cbt-answers.txt

if ! command -v canton >/dev/null; then
  echo "installing the Canton Builder Tool…"
  printf 'n\n' | bash -c 'curl -fsSL https://raw.githubusercontent.com/canton-network-devs/Canton-Builder-Tool/main/install.sh | bash'
  export PATH="$HOME/.local/bin:$PATH"
fi

echo "==> starting LocalNet with Keycloak (first run pulls ~5GB, ~10 min)"
canton builder start --with app-user --auth < /tmp/netsettle-cbt-answers.txt

docker pull "$DM_IMAGE" >/dev/null

# The DM validates the issuer Keycloak advertises (keycloak.localhost), so each
# node needs that name to resolve even though we reach Keycloak over 127.0.0.1.
start_dm() {
  local name=$1 api=$2 noise=$3 admin=$4 ledger=$5 realm=$6 client=$7
  docker rm -f "$name" >/dev/null 2>&1 || true
  mkdir -p "/tmp/netsettle-dm-$name"
  docker run -d --name "$name" --network host \
    --add-host keycloak.localhost:127.0.0.1 \
    -e DECPM_PORT="$api" -e DECPM_NOISE_PORT="$noise" \
    -e DECPM_CANTON_ADMIN_HOST=127.0.0.1 -e DECPM_CANTON_ADMIN_PORT="$admin" \
    -e DECPM_CANTON_LEDGER_HOST=127.0.0.1 -e DECPM_CANTON_LEDGER_PORT="$ledger" \
    -e DECPM_CANTON_SYNCHRONIZER=global -e DECPM_CANTON_NETWORK=devnet \
    -e DECPM_KEYCLOAK_URL=http://keycloak.localhost:8082 \
    -e DECPM_KEYCLOAK_REALM="$realm" -e DECPM_KEYCLOAK_CLIENT_ID="$client" \
    -v "/tmp/netsettle-dm-$name:/data" \
    "$DM_IMAGE" >/dev/null
  echo "    $name → api $api, noise $noise, admin $admin, realm $realm"
}

echo "==> starting Decentralization Manager nodes"
start_dm dm-provider 8091 9151 3902 3901 AppProvider app-provider-validator
start_dm dm-user     8092 9152 2902 2901 AppUser     app-user-validator

sleep 12
for c in dm-provider dm-user; do
  printf '    %s: %s | %s\n' "$c" \
    "$(docker ps --filter "name=$c" --format '{{.Status}}')" \
    "$(docker logs "$c" 2>&1 | grep -oE 'Got participant ID from Canton: .*' | tail -1)"
done

echo
echo "next: bash dp/onboard-operator.sh"