#!/usr/bin/env bash
# Install the DLC-link governance packages into a local Maven repository so
# dp/daml-governed can depend on them.
#
#   bash dp/vendor-governance.sh
#
# `governance-action-v1` is published in the DM repo's releases/ directory, not
# on the Daml registry, so a plain `dependencies:` entry cannot resolve. dpm reads
# `repositories:` entries as Maven repositories, so we lay the DAR out in the
# layout Maven expects and point daml.yaml at it with file:///tmp/netsettle-m2.
#
# Nothing secret is involved: these are public release artifacts, downloaded.
set -euo pipefail
cd "$(dirname "$0")/.."

DEPS="${DEPS:-dp/daml-governed/.deps}"
BASE="https://raw.githubusercontent.com/DLC-link/decentralization-manager/main/releases/v1"

# Maven coordinates: groupId com.dlclink, artifactId <name>, version 0.1.0.
install_dar() { # install_dar <artifact> <filename> <version>
  local artifact=$1 filename=$2 version=${3:-0.1.0}
  local dar="$DEPS/$artifact-$version.dar"
  if [ ! -s "$dar" ]; then
    echo "    downloading $filename"
    curl -fsSL --max-time 180 -o "$dar" "$BASE/$filename"
  fi
  echo "    $dar"
}

mkdir -p "$DEPS"
echo "==> vendoring governance packages into $DEPS"
install_dar governance-action-v1 governance-action-v1-0.1.0.dar
install_dar governance-core-v1 governance-core-v1-0.1.0.dar

echo
echo "next: cd dp/daml-governed && dpm build"