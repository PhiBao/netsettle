# Demo script — 5 minutes, problem first

## 0:00 The problem (30s)

"These four subsidiaries owe each other $312,000. Most of it is circular — it
cancels out — but the group settles every invoice gross. The monthly netting
cycle runs on spreadsheets and email. And nobody will put their payables in a
shared system, because an AP file reveals suppliers, pricing, and margins."

## 0:30 Ingest (45s)

Load demo dataset. Point out:

- `Acme france` (lowercase, wrong suffix) mapped to **Acme FR** by semantic
  matching — confidently, no review needed.
- `INV-001-R` flagged as a near-duplicate of `INV-001` (model judged 0.92 same
  obligation) → drop it live.
- `Globex Corp` maps to nothing → stays unresolved and is **excluded** from the
  proposal. The system refuses to guess counterparties into existence.

## 1:15 Proposal (60s)

Create netting proposals — one per currency bucket. The hero numbers:

- **USD: gross $312,000 → net $40,000 in 3 transfers.**
- **EUR: gross €70,000 → net €30,000 in 1 transfer.** No FX oracle, no invented
  rates — like offsets like.
- Residuals listed with from/to/amount. Proposal contract IDs on screen — real
  ledger contracts, not mocks.

## 2:15 Approvals + settlement (90s)

Approve as all four subsidiaries — each approval is its own ledger contract
signed by that subsidiary alone. Then **Execute atomic settlement**:

- 3 receipts appear with ledger contract IDs.
- Obligations archived.

Then the failure proof: start a second cycle, attempt settlement with approvals
missing → **"Settlement refused — ledger untouched"** with the exact missing
parties listed.

Then the bank artifact: download the payment file (CSV) — one row per residual
transfer, each referencing its ledger receipt contract. "The atomic transaction
decided the outcome; this file is what the treasury uploads to the bank."

## 3:45 Privacy check (60s)

Switch subsidiary views. Acme SG sees only its own legs and its 2 receipts, with
**an isolation proof queried live as that party**: every receipt involving it is
readable, and every receipt in the same batch that does not involve it is absent.
State the boundary out loud:

> "Canton isn't magic here — the operator computes over the full graph, so the
> operator sees everything. What Canton gives us is that subsidiaries are
> private *from each other*, and settlement is atomic. That's the product."

If a judge asks about the shared demo node: the check is deliberately scoped to
this session's batch, because the node also carries other teams' and other runs'
contracts — raw global counts would prove nothing. Same-batch visibility versus
absence is the honest test, and it runs live against the ledger.

Optional fifth beat (30s) if the audience is technical: ingest an all-circular
CSV (DE→FR, FR→SG, SG→DE, equal amounts) and settle it — gross is fully netted,
**zero transfers, zero receipts**, obligations archived in one commit. The
payment-file endpoint correctly refuses with "nothing to pay".

## 4:45 Close (15s)

"A monthly treasury ritual — spreadsheet, email, six-figure trapped cash —
becomes an approval-gated atomic operation. One corporate group is the whole
beachhead: one signature onboards every subsidiary."

## If the network fails — or the shared demo gets polluted

The public demo is shared mutable state. If anything looks off, hit **Reset
demo** on the ingest page and reload the dataset (30 seconds, deterministic).
If the network itself fails, play the recorded backup. Never debug live.
