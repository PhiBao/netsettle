# Pitch — NetSettle, Track 1 (RWA & Business Workflows)

One track only (per official rules) + sponsor challenges where eligible.
Spine (official): **Value → ICP → Metrics → GTM → MVP → Pitch.**
Demo: https://100-30-125-235.nip.io · Repo: https://github.com/PhiBao/netsettle

## The 30-second version (answers: what / for whom / why it matters)

"Multinationals settle intercompany payables gross — even the circular part
that cancels out — in a monthly spreadsheet-and-email ritual. NetSettle
compresses the cycle into net settlements, commits them in one atomic Canton
transaction where each subsidiary sees only its own legs, and hands the
treasury a bank-ready payment file. Demo: $312k across 6 invoices becomes
$40k in 3 transfers, plus a €70k→€30k bucket."

## Spine mapping (what to show per stage)

| Stage | Say + show | Judging question it answers |
|---|---|---|
| **Value** | Trapped working capital + spreadsheet risk; Canton gives atomic multilateral commit + stakeholder privacy — the two things that make netting hard | Problem real? Value prop clear + differentiated? |
| **ICP** | Group treasury ops manager + subsidiary finance approvers at multinationals with monthly cycles; beachhead = one group, one signature onboards all subsidiaries | ICP clearly defined? |
| **Metrics** | VALIDATION.md: 88% payment-ops pain, 70% transfer reduction, 84% investing; demo's own numbers (gross→net, payments eliminated); operator quotes or documented outreach | Metrics / Validation? Business potential (who pays, why now)? |
| **GTM** | Land one treasury → expand cycles/entities; partners: TMS-adjacent consultants, bank netting-center refugees; distribution via AppsFactory accelerator + crowdloans | Business potential? Ecosystem value? Pilot feasibility? |
| **MVP** | Live demo end-to-end (ingest → review → propose → approve → settle → payment file + pain.001), failure path, privacy views | Working MVP? Completeness of flow? |
| **Pitch** | This page + deck + video: problem → solution → why us, under 5 minutes | Story clear? Materials readable? |

## 5-minute Grand Final arc (see DEMO.md for beats)

1. Problem + ICP (45s) — the ritual, the trapped cash, the AP-file privacy trap.
2. Ingest + review (60s) — messy names resolved, duplicate dropped live, Globex excluded.
3. Proposal (45s) — two currency buckets, hero numbers, real contract IDs.
4. Approvals + settlement (75s) — four ledger approvals, atomic execute, 3 receipts, payment files.
5. Failure + privacy (45s) — refused settlement, per-party views with live verification.
6. Close (30s) — wedge, GTM, ask. End on the trust boundary, stated first.

## Q&A bank (say the hard part before they ask)

1. **"Where did the money actually move?"** → It didn't — deliberately. Canton
   commits the *netting decision* atomically; value moves via the payment file
   through existing banking rails (CSV + pain.001). No new token, no parallel
   currency. Receipts are the audit trail linking decision to payment.
2. **"The operator sees everything — so much for privacy?"** → Correct, and
   stated in our README. Canton gives privacy *between subsidiaries* plus
   atomicity. Same trust position as today's netting center, minus the
   principal-risk intermediary and the reconciled-after-the-fact books.
3. **"Why not a TMS module / bank netting center?"** → Those exist (PNC, GTreasury
   — cited in VALIDATION.md) and validate the workflow. We differ: no
   implementation project, no settlement-bank principal risk, cryptographic
   stakeholder privacy instead of database ACLs, open repo.
4. **"Single currency was your MVP; is multi-currency real?"** → Yes — two live
   buckets, no FX conversion by design (like offsets like). Cross-currency
   netting needs an FX oracle and is explicitly future work.
5. **"Sandbox, not DevNet?"** → Reproducible single-node ledger today;
   DEVNET.md documents the shared-node path (endpoints verified, auth needs our
   platform login). Timeboxed, not abandoned.
6. **"Is TypeSafe load-bearing or garnish?"** → Garnish by design: roster
   mapping, memo kinds, duplicate probability, batch triage — all
   confidence-gated with deterministic fallback. Money math and settlement never
   touch a model.
7. **"Who pays, and why now?"** → Treasury ops budget (84% investing per
   Harris); pricing anchored to a fraction of eliminated FX/bank fees. Why now:
   Canton privacy + atomicity make the multilateral commit newly practical;
   hackathon DevNet removes infra friction.
8. **"What breaks at 10,000 invoices?"** → Cycle detection is the scaling
   risk; current greedy is correct, not optimal. PQS-backed reads and batched
   commits are the documented path; stated as risk, not hand-waved.
9. **"Disputes/tax/audit?"** → Dispute flow ships (PNC-checklist parity);
   receipts carry contract IDs into the payment file for audit; tax treatment
   varies by jurisdiction — flagged in VALIDATION.md gaps.
10. **"Why you / why this team?"** → Shipped working product on a hard stack
    (Daml + JSON Ledger API + vetting + multi-party auth) in weeks, deployed
    publicly, with honest boundaries. Evidence over claims.

## Submission materials checklist (official: 6 required, private to mentors/judges)

- [ ] Project page (public gallery) — problem, ICP, demo URL, repo
- [ ] Deck — spine order, ≤10 slides, hero numbers on slide 2
- [ ] Demo video (recorded backup — still missing, highest-risk item)
- [ ] Text writeup — README + VALIDATION.md already cover; trim to their template
- [ ] Repo public, build instructions verified from zero (bootstrap script)
- [ ] Metrics/validation notes — dossier now, operator quotes if sprint lands
