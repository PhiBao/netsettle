#!/usr/bin/env bash
# Reproduce the whole BitSafe demonstration from a clean checkout.
#
#   bash dp/reproduce.sh
#
# The BitSafe brief requires "enough setup and run instructions for judges to
# reproduce the demo", and says contribution-pool eligibility needs a
# *reproducible LocalNet demo*. This script is that entry point: it runs every
# step in order and stops at the first failure, so a judge sees the same output
# we did.
#
# Prerequisites (Ubuntu-ish, or anything with Docker):
#   * Docker with Compose v2.1.1+
#   * curl, jq >= 1.6, base64, git
#   * the Canton Builder Tool:  curl -fsSL \
#       https://raw.githubusercontent.com/canton-network-devs/Canton-Builder-Tool/main/install.sh | bash
#   * the Daml SDK 3.4.11 (dpm): the vendor step installs it
#
# Budget ~35 minutes on first run and roughly 8GB of RAM: LocalNet runs three
# participants plus Splice and Postgres, and this host also runs the repo's own
# tooling.
#
# What it prints, and where to look:
#   1. operator party, threshold 2, two owners        -> dp/verify-operator.sh
#   2. a governed action refused below threshold      -> dp/prove-two-of-two.sh
#   3. a settlement refused to the host that proposed it, then settled by the
#      party, with receipts signed by the party       -> dp/settle-as-decentralized-party.sh
set -euo pipefail
cd "$(dirname "$0")/.."

step=0
banner() { step=$((step + 1)); printf '\n\033[1m========== %d/5  %s ==========\033[0m\n' "$step" "$1"; }

need() { command -v "$1" >/dev/null || { echo "missing prerequisite: $1"; exit 1; }; }
need docker; need curl; need jq; need git

banner "LocalNet + one Decentralization Manager node per participant"
bash dp/up-localnet.sh

banner "create the netting operator as a 2-of-2 decentralized party"
bash dp/onboard-operator.sh netsettle-operator

banner "assert the party: threshold 2 and two independent owners"
bash dp/verify-operator.sh netsettle-operator

banner "the party deploys its own governance contract, and one host is refused"
bash dp/deploy-governance.sh netsettle-operator
bash dp/prove-two-of-two.sh netsettle-operator

banner "the settlement runs under the party, refused to the host that proposed it"
bash dp/vendor-governance.sh
# The governance packages are built against SDK 3.4.11 and so is our package.
# Without this, dpm build fails with SDK_NOT_INSTALLED on a clean machine.
if command -v dpm >/dev/null; then
  (cd dp/daml-governed && dpm install 3.4.11 >/dev/null 2>&1 || true)
  (cd dp/daml-governed && dpm build)
else
  echo "dpm not found - install the Daml SDK: https://docs.digitalasset.com/daml/sdk/get-started"
  exit 1
fi
bash dp/settle-as-decentralized-party.sh netsettle-operator

printf '\n\033[1mAll five steps passed.\033[0m\n'
cat <<'MSG'

What was just shown, in the order the BitSafe brief asks for it:

  1. A real decentralized party on a Canton ledger: threshold 2, two members,
     each holding one owner key contribution.
  2. Shared control at the governance layer: an action below the confirmation
     threshold is refused by the Daml contract itself, and succeeds at threshold.
  3. Shared control at the settlement layer: the host that proposed a settlement
     cannot execute it - Daml names the party whose authority was missing - and
     once both members confirm, the Decentralization Manager executes it *as the
     party*, issuing receipts signed by the party and consuming the obligation.

Not demonstrated, and therefore not claimed: behaviour when a hosting node goes
offline. See "What we claim, and what we do not" in dp/README.md.

Teardown:  bash dp/down.sh
MSG