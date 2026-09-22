# Shared DevNet runbook — HackCanton Season 3 node

Noders provides a **shared DevNet sandbox** for Season 3 teams so you build
logic, not infrastructure. Verified 2026-09-22: JSON Ledger API responds on
Canton 3.5.17; Keycloak OIDC discovery reachable. Authenticated steps below
need **your HackCanton platform email + password** — I could not execute those.

Source: Season 3 materials (official) + live endpoint probes.

## Endpoints

| Resource | Endpoint |
|---|---|
| JSON Ledger API | `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services` |
| gRPC Ledger API | `ledger-api-grpc.participant.hackcanton-01.devnet.naas.noders.services:443` |
| Wallet | `https://wallet.validator.hackcanton-01.devnet.naas.noders.services` |
| CNS | `https://cns.validator.hackcanton-01.devnet.naas.noders.services` |
| Console | `https://console.participant.hackcanton-01.devnet.naas.noders.services` |
| Validator / Scan API | `https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services` |
| Grafana logs | `https://grafana.participant.hackcanton-01.devnet.naas.noders.services` |
| OIDC token URL | `https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token` |
| Token audience | `https://hackcanton-01.devnet.naas.noders.services` |

Shared node = shared ledger. **No sensitive data.** Our demo parties and
contracts are visible to every team on the node.

## Step 1 — Get a token (needs your platform login)

```bash
export TOKEN=$(curl -s -X POST \
  "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=<from the HackMD guide>" \
  -d "username=<your HackCanton platform email>" \
  -d "password=<your HackCanton platform password>" \
  -d "audience=https://hackcanton-01.devnet.naas.noders.services" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
```

The exact `client_id` is in the official HackMD guide
(Canton DevNet Quickstart — HackCanton shared node), which was unreachable
from my network. Open it from your browser; everything else here is verified.

## Step 2 — Upload + vet the DAR

```bash
BASE=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services
curl -s -X POST "$BASE/v2/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @daml/.daml/dist/daml-0.0.1.dar
# then vet (same shape as scripts/sync-ledger.sh, with the Authorization header)
```

Note: our DAR builds under SDK 3.5.1; the node runs 3.5.17. Same 3.5 line —
expected compatible; the upload response will confirm or deny.

## Step 3 — Allocate parties and run the flow

Same as local, pointed at `$BASE` with `Authorization: Bearer $TOKEN`:

1. Allocate operator + 4 subsidiaries (Daml Script or Console).
2. Set `CANTON_JSON_API_URL=$BASE`, `CANTON_PACKAGE_ID=<uploaded id>`,
   `CANTON_PARTY_MAP_JSON={...}` on a staging deploy (do **not** repoint the
   public EC2 app — keep the judged demo on the reproducible local ledger).
3. Ingest → review → propose → approve → settle → payment file.

## What DevNet buys us (and what it doesn't)

- Buys: "settled on shared Canton DevNet" in the pitch + Q&A; real
  multi-participant topology instead of single-node sandbox.
- Doesn't buy: real assets (still test obligations), wallet UX (still
  server-mediated approvals), Featured status.
- Costs: shared-node flakiness, credential management, ~1 day.

Recommendation: attempt once the MVP freeze holds; timebox to one day. If the
node fights back, the local-ledger demo plus this runbook is the fallback
story — "DevNet-ready, reproducible locally."
