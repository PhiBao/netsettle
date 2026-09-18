# NetSettle — intercompany multilateral netting on Canton

Subsidiaries of one group owe each other millions across entities. Much of it is
circular — A owes B, B owes C, C owes A — so the group settles gross and leaves
working capital trapped in cycles that mathematically cancel out. The monthly
netting cycle still runs on spreadsheets and email.

NetSettle ingests intercompany payables, resolves messy counterparty names
against the subsidiary roster, compresses offsetting cycles, collects
per-subsidiary approvals, and settles the residual in **one atomic Canton
transaction** — with each subsidiary seeing only its own legs.

Demo: **$312,000 gross across 8 invoices → $40,000 net in 3 transfers.**

## Why Canton (and not a database)

1. **Nobody publishes their payables ledger.** An AP file reveals suppliers,
   pricing, and margins. Canton stakeholders see only contracts they are party
   to, so subsidiaries never see each other's books.
2. **Multilateral settlement must be all-or-nothing.** Partial execution across
   N parties recreates settlement risk. The `NettingProposal.Execute` choice
   archives every obligation and issues every receipt in a single transaction —
   a failed leg aborts everything.

## Honest trust boundary

Canton is not MPC or ZK. Cycle detection runs over the full obligation graph,
so the **operator sees everything** — the same trust position as a central
netting operator today. What Canton buys: *participants are private from each
other*, and *settlement is atomic*. The privacy demo in the app queries the
ledger live per party so this claim is checkable, not asserted.

## Repository layout

| Path | What it is |
|---|---|
| `daml/` | `Netting.daml` — Obligation / Approval / NettingProposal / SettlementReceipt; `NettingTest.daml` — positive + blocked-execution ledger tests |
| `packages/netting-core` | Deterministic engine: CSV ingest, integer minor-unit money, net-position math, proposal state machine. No floats, no AI. |
| `packages/typesafe-judgments` | TypeSafe System One judgments: roster mapping (Choice), memo classification (Choice), near-duplicate probability (Noul), batch triage (Score). Confidence-gated to human review, with deterministic offline fallback. |
| `packages/canton-gateway` | Typed Canton JSON Ledger API client + live round-trip test. |
| `apps/web` | Treasury workflow UI: ingest → review → propose → approve → settle → receipts, plus per-subsidiary privacy views. |
| `scripts/` | `bootstrap-sandbox.sh` (fresh demo env), `sync-ledger.sh` (rebuild → upload → vet → point app at new package id). |

## Run the demo

Prerequisites: Docker? No — just `dpm`, Node 22, pnpm. The sandbox is a single
JVM process.

```bash
# 1. Fresh local ledger + parties + app config (takes ~2 minutes)
bash scripts/bootstrap-sandbox.sh

# 2. All green before you demo
pnpm --filter @netting/core test
pnpm --filter @netting/typesafe-judgments test
pnpm --filter @netting/canton-gateway test
cd daml && dpm test

# 3. Start the app
pnpm --filter @netting/web start   # http://localhost:3100
```

Demo flow: **Ingest → Load demo dataset → Review** (drop the flagged
duplicate `INV-001-R`; `Globex Corp` stays unresolved and is excluded) →
**Proposal → Create netting proposal → approve as all four subsidiaries →
Execute atomic settlement**. Then attempt a second settlement with approvals
missing to show the refusal, and switch subsidiary views to show each party
sees only its own legs — verified live against the ledger.

`TYPESAFE_API_KEY` is read from the environment. Without it the app still runs
on the deterministic fallback and marks judgments for review.

## Verification evidence

- `dpm test`: `testExecute` (2 receipts, obligations archived) and
  `testExecuteBlocked` (missing approval fails, nothing partially settles).
- `packages/canton-gateway` live test (gated by `CANTON_*` env): full cycle
  against a real participant, asserting archival of exactly the created
  obligations.
- `/api/view?party=` returns per-party ledger-verified counts alongside the
  scoped view.
