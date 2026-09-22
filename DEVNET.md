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

## Step 1 — Get a token (needs your platform login, 2 minutes)

Direct password grants are disabled on the wallet client (probed:
`unauthorized_client`), so the token comes from a browser login:

1. Open the wallet and sign in with your HackCanton platform account:
   `https://wallet.validator.hackcanton-01.devnet.naas.noders.services`
2. Open DevTools → Application → Local Storage → copy the access token.
3. Tokens are short-lived — run the deploy script immediately after copying.

Auth config (extracted from the wallet's public config, verified):
`authority=https://keycloak.naas.noders.services/realms/noders-appsfactory`,
`client_id=wallet-web-ui-hackcanton-01-devnet`,
`audience=https://hackcanton-01.devnet.naas.noders.services`.

## Step 2 — Upload via Console UI; vetting + parties need the node operator

Wallet API tokens on the shared node are **heavily restricted** (probed
2026-09-23, all with a valid token):

| Action | Result |
|---|---|
| Read packages / ledger-end / vetting list / whoami | ✅ works |
| Upload DAR (`/v2/packages`, `/v2/dars`) | ❌ 403 |
| Vet package (`/v2/package-vetting/update`) | ❌ 403 |
| Allocate party (Daml Script over gRPC+TLS) | ❌ `PERMISSION_DENIED` |

Status: DAR uploaded via Console (package
`d1b3b958…dee64f` confirmed on node), but **not vetted**, and we have only our login's `primaryParty` —
no operator + 4 subsidiaries yet. Creating parties ourselves is impossible
with this token, and wouldn't help anyway (vetting is per-participant,
not per-party).

Funding: ~900 CC obtained on our party (covers all demo traffic fees with
orders of magnitude to spare — one future blocker pre-solved). Once the
operator party exists, a small CC transfer to it covers submission fees.

Resolution path: one ask to Noders (Discord support/mentor channel) covers
everything — vet the package AND allocate 5 parties (or grant our user
party-allocation rights). Draft ask below.

1. Open `https://console.participant.hackcanton-01.devnet.naas.noders.services`
   and sign in.
2. Upload `daml/.daml/dist/netsettle-0.1.0.dar`. (Done 2026-09-23.)
3. Vet package `netsettle` (uniquely named — no collisions with other teams).
   (Blocked — needs operator.)
4. Allocate 5 parties (operator + 4 subsidiaries) or equivalent rights.
   (Blocked — needs operator.)

## Step 3 — One command does the rest

```bash
UPLOADED=1 VETTED=1 TOKEN=<paste> bash scripts/devnet-deploy.sh
```

The script allocates operator + 4 subsidiaries over gRPC and writes
`apps/web/.env.devnet` (git-ignored). If gRPC allocation also hits permission
errors, allocate via the Console UI and paste the party IDs into `.env.devnet`
by hand (format in `apps/web/.env.local.example`).

Note: our DAR builds under SDK 3.5.1; the node runs 3.5.17. Same 3.5 line —
expected compatible; the upload response will confirm or deny. If party
allocation over gRPC fights TLS, fall back to allocating via the Console UI
and paste the party IDs into `.env.devnet` by hand.

## Step 4 — Run the flow against DevNet (staging only)

Point a local app run at `.env.devnet` and walk ingest → settle → payment
file. Do **not** repoint the public EC2 app — keep the judged demo on the
reproducible local ledger unless the DevNet run is fully green.

## What DevNet buys us (and what it doesn't)

- Buys: "settled on shared Canton DevNet" in the pitch + Q&A; real
  multi-participant topology instead of single-node sandbox.
- Doesn't buy: real assets (still test obligations), wallet UX (still
  server-mediated approvals), Featured status.
- Costs: shared-node flakiness, credential management, ~1 day.

Recommendation: attempt once the MVP freeze holds; timebox to one day. If the
node fights back, the local-ledger demo plus this runbook is the fallback
story — "DevNet-ready, reproducible locally."
