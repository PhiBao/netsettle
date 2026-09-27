# Submission kit — platform materials, brief, pilot plan, video

Everything the platform's "Project Progress" checklist asks for, ready to paste.
Source of truth for the numbers: the live demo and `VALIDATION.md`.
**Honesty rule: no fabricated interviews. Update the outreach log as calls happen.**

Checklist the platform tracks (`Publish for Judging` panel):

- [ ] Project page — projectName, track, elevator pitch, logo, tech stack, contact email, contact Telegram
- [ ] Value / Problem statement
- [ ] ICP / Audience Definition
- [ ] Metrics / Validation Evidence
- [ ] GTM Materials
- [ ] Pitch
- [ ] Demo — demo URL (live) and/or demo video link
- [ ] 1,000 Mana burned (done — keep the daily streak alive through Oct 9)

---

## Project page fields (short values)

**Name:** NetSettle — intercompany netting on Canton

**Elevator pitch (paste):**

> Multinational subsidiaries owe each other millions every month — much of it circular, so the group settles cash that mathematically cancels. NetSettle ingests intercompany payables, resolves messy counterparty names against the subsidiary roster, compresses offsetting cycles, collects per-subsidiary approvals, and settles the residual in one atomic Canton transaction where each subsidiary sees only its own legs. Settlement ends in a bank-ready payment file (CSV + ISO 20022 pain.001). Demo: $312,000 across 6 invoices settles as $40,000 in 3 transfers; €70,000 as €30,000 in 1 — and a fully-circular cycle settles with zero transfers. Live on the shared HackCanton DevNet.

**Track:** Real-World Asset (RWA) & Business Workflows

**Tech stack:** Daml, Canton JSON Ledger API, DevNet, Next.js, TypeScript, Tailwind,
TypeSafe System One judgments, ISO 20022 pain.001

**Demo URL:** https://100-30-125-235.nip.io
**Repo:** https://github.com/PhiBao/netsettle
**Video:** (unlisted/YouTube link — record with the shot list below)

---

## 1. Value / Problem statement

Subsidiaries of one group owe each other money every month: cross-border
intercompany payables for goods, services, loans and tax settlements. Much of
that debt is circular — A owes B, B owes C, C owes A — so a large share of the
cash the group moves cancels out arithmetically. Groups still settle it gross.

Two things make the problem hard, and both are structural rather than technical:

1. **Nobody will publish their payables ledger.** An AP file reveals suppliers,
   pricing and margins. Any netting system that means "upload everything to a
   shared database" asks every subsidiary to hand its counterparties an
   information advantage.
2. **A half-settled cycle is worse than no settlement.** Multilateral netting is
   all-or-nothing: if some legs execute and others fail, the group recreates the
   exact settlement risk it was trying to remove.

The monthly cycle still runs on spreadsheets and email. The ROI is well
documented — cross-border intercompany transfers are reducible by up to 70% —
but the trust mechanics have kept netting an enterprise-TMS or settlement-bank
feature, out of reach for mid-market groups.

**What canton changes:** stakeholder-scoped visibility means a subsidiary only
ever sees contracts it is a party to, and one atomic transaction can archive
every obligation in a cycle and issue every receipt — or abort entirely.

**Who pays:** group treasury operations. They already pay for TMS modules and
bank netting services, and 84% of companies invested in payment operations in
the last 12–18 months.

---

## 2. ICP / Audience definition

**Primary user — Group Treasury Operations Manager** at a multinational with
5–50 legal entities and a monthly intercompany cycle:

- runs the netting cycle in Excel today; reconciles by email;
- measured on trapped cash, FX/bank fees, and cycle time;
- cannot mandate ERP changes across subsidiaries;
- buys tools that produce a bank-ready output and do not require an
  implementation project.

**Secondary users — Subsidiary finance approvers** (controllers/CFOs of
subsidiaries): they approve their legs and must be certain no other subsidiary
sees their payables.

**Beachhead: one corporate group.** One signature onboards every subsidiary; the
group is the unit of adoption, not the entity. Initial segment: mid-market groups
with cross-border entities (EU/US/APAC), 10–200 monthly intercompany invoices,
already using a TMS or a bank for payments.

**Why now:** Canton's JSON Ledger API + Daml 3.x make a small team able to ship a
real multi-party workflow in weeks; the shared DevNet removes infrastructure
friction; TypeSafe's System One judgments make messy treasury input tractable
without an ML project.

**Non-goals:** we do not move money, hold funds, or replace the ERP. NetSettle
compresses the decision and produces the bank file; value moves through existing
rails.

---

## 3. Metrics / Validation evidence

**Problem evidence (secondary research, cited, checkable — `VALIDATION.md`):**

- 88% of finance decision-makers report payment-operations problems; 51% do up
  to half of payment operations manually; only 1 in 9 have fully automated
  disbursements — Modern Treasury/Harris 2025; Deluxe/Strategic Treasurer 2025.
- Netting cuts cross-border transfers by up to 70% and hedge trades by up to
  75% — GTreasury/Ripple Treasury material; Treasury Today.
- 84% of companies invested in payment operations in the last 12–18 months —
  Modern Treasury/Harris 2025.
- Named treasurers describing the spreadsheet cycle in their own words (Weir
  Group, Bandwidth, Innospec) — J.P. Morgan, Treasury Today, GTreasury case
  studies.

**Product evidence (observable in the live demo):**

- $312,000 gross across 6 USD invoices → $40,000 net in 3 transfers (87.2%
  compression).
- €70,000 gross → €30,000 net in 1 transfer.
- A fully-circular USD cycle → **zero transfers**, obligations archived in one
  atomic commit; the payment-file endpoint refuses with "nothing to pay".
- Failure path: settlement with approvals missing is refused and the ledger is
  untouched (proved on-ledger, `testExecuteBlocked`).
- Approvals are bound to a terms hash: a rewritten proposal cannot settle with
  old approvals (`testExecuteBlockedOnTermsMismatch`).
- Privacy: per-party queries against the ledger show own legs visible and
  same-batch receipts involving other parties absent (`/api/view`).

**Primary research status (honest):** direct operator conversations are the first
post-hackathon task; the outreach log below is updated as calls happen. We do not
present surveys as interviews.

| # | Date | Role / co. size | Pain (their words) | Objection | Pilot 1–5 |
|---|------|-----------------|--------------------|-----------|-----------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## 4. GTM materials

**Wedge:** land one group treasury team with the monthly netting cycle. The
product is usable with a CSV upload — no ERP project, no IT queue. The first
cycle delivers the ROI proof (transfers eliminated, fees avoided) that justifies
the next cycle.

**Channels, in order:**

1. **Warm intros via treasury/finance networks** (mentors, advisors, ex-treasury
   consultants) — highest response; the outreach kit is in `OUTREACH.md`.
2. **TMS-adjacent consultants and bank netting-center alumni** — they implement
   netting for a living and know which groups hate the spreadsheet.
3. **Canton ecosystem distribution** — AppsFactory accelerator, hackathon
   mentors, Canton Foundation network, Featured App path after the hackathon.
4. **Content**: a public "netting cycle teardown" (how circular debt is settled
   today, with numbers) to pull inbound from treasury communities.

**Expansion:** one group → more entities/currencies per group → FX-aware netting
→ netting-center-as-a-service for mid-caps without treasury IT.

**Pricing hypothesis:** per-cycle or annual seat pricing anchored to a fraction
of eliminated FX and bank fees; the buyer already has a budget line for payment
operations. Monetization must not block the first cycle — start with a
concierge-assisted pilot.

**Pilot plan (2–3 steps + integrations):**

1. Import one month of intercompany payables (CSV first; SAP/Oracle export
   formats next) and run the netting math against the group's roster.
2. Run the approval flow with 2–3 subsidiaries on DevNet; agree the controls
   (approval authority, dispute handling) with group treasury.
3. On successful cycle, connect the operator's participant to the group's
   Canton node (or hosted), and hand the pain.001 file to the existing bank
   rail. Required integrations: ERP export, Canton participant + package
   vetting, bank payment format.

---

## 5. Pitch

> Every month, the subsidiaries of a multinational settle millions in
> intercompany payables — and much of it cancels out. Circular debt: A owes B, B
> owes C, C owes A. Groups still move the gross amount, because the alternatives
> are a spreadsheet cycle or a settlement bank in the middle.
>
> NetSettle turns that cycle into one operation. Upload the month's payables.
> Messy names are matched against the roster with confidence, duplicates are
> caught, anything uncertain goes to a human. The engine compresses the cycles
> per currency. Each subsidiary approves its own legs as its own ledger
> contract. Then one atomic Canton transaction archives every obligation and
> issues every receipt — or nothing happens. Out comes the bank-ready file:
> CSV and ISO 20022 pain.001.
>
> The demo: $312,000 gross settles as $40,000 in three transfers; €70,000 as
> €30,000; a fully-circular cycle settles with zero transfers, and the ledger
> can prove nothing moved. Each subsidiary sees only its own legs — verified
> live against the ledger, not asserted in a slide.
>
> Why Canton: only a ledger with stakeholder-scoped privacy plus atomic
> multi-party execution can do this. A shared database exposes everyone; a
> transparent chain exposes everyone; a bank puts a principal in the middle.
> NetSettle's operator still computes over the full graph — we state that
> boundary openly — while subsidiaries stay private from each other and
> settlement is all-or-nothing.
>
> The wedge is one group treasury team and its monthly cycle. One signature
> onboards every subsidiary. The cycle that runs on spreadsheets and email today
> becomes an approval-gated atomic operation — and the intercompany graph it
> creates becomes the system of record.

---

## 6. Demo video shot list (≤4:00, local sandbox for a deterministic take)

Record against a fresh local ledger (`bash scripts/bootstrap-sandbox.sh`), not the
shared node, so the recording cannot be spoiled by other teams' traffic.

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:30 | The problem | Four subsidiaries, circular debt; nobody publishes payables (AP file leaks suppliers/margins); half-settled is worse than none |
| 0:30–1:15 | Ingest + review | Load demo dataset; `Acme france`→Acme FR resolved by judgment; `INV-001-R` flagged duplicate and dropped; `Globex Corp` excluded, never guessed |
| 1:15–1:45 | Proposal | Two currency buckets; hero numbers: $312k→$40k in 3, €70k→€30k in 1; real contract IDs |
| 1:45–2:30 | Approvals + settle | Approve as each subsidiary (own ledger contract); execute; receipts with contract IDs; payment CSV + pain.001 |
| 2:30–3:00 | Failure + full netting | Settle with approvals missing → refused, ledger untouched. Then a fully-circular cycle → 0 transfers, obligations archived, "nothing to pay" |
| 3:00–3:40 | Privacy + close | Switch subsidiary views: own legs only; isolation verified live as that party. Close on the wedge and the trust boundary |

---

## Open items before Oct 9 (21:59 UTC)

- [ ] Fill the 6 platform materials (this file) and publish the project page.
- [ ] Record and link the video; export a ≤10-slide deck from the Pitch section.
- [ ] Send the outreach touches; log real conversations in the table.
- [ ] Keep the daily platform journal/activity streak alive (mentors and judges read it).
- [ ] Noders ask: vet the hardened package, then upgrade the live demo (DEVNET.md).

---

## Appendix — journal entries to paste (one per day, adapt to what actually happened)

The platform journal is read by mentors and judges and is part of the evaluation.
Write in first person, lead with what changed, and always name the evidence
(commit, test, contract ID, conversation). Never claim a conversation that
did not happen.

**Entry 1 — what we're building and where it stands**

> NetSettle (Track 1): the monthly intercompany netting cycle, compressed into
> one atomic Canton transaction. Today the full flow runs on the shared
> HackCanton DevNet: 10 payables ingested → 8 eligible → USD $312k gross settles
> as $40k in 3 transfers, EUR €70k as €30k in 1, with real receipt contract IDs
> and a pain.001 file whose control sums reconcile. Next: harden the approval
> model and the demo's failure paths.

**Entry 2 — the hardening that came out of asking "what would a skeptic attack?"**

> Spent the day on the two weakest claims. (1) An approval used to reference a
> proposal by id — the operator could have swapped the terms after approval. Now
> every approval carries a SHA-256 of the canonical terms, and `Execute` refuses
> mismatches; `testExecuteBlockedOnTermsMismatch` proves it. (2) A fully-circular
> cycle was rejected as "no transfers" — the best possible outcome treated as an
> error. Now it settles with zero receipts and archives all obligations
> (`testExecuteFullNetting`). Tests went 4 → 6.

**Entry 3 — made the demo reproducible from zero**

> A judge should be able to clone, run one command, and get a working ledger.
> Found and fixed real breakage: the sync script referenced a DAR name that no
> longer existed, the sandbox answers HTTP before it accepts package uploads
> (now retried), party allocation failed on a second run (now idempotent), and
> the bootstrap assumed `.env.local` already existed. Verified cold-start,
> warm-start, and no-file runs. Test counts now 20 core / 6 TypeSafe / 7 gateway
> / 6 Daml, plus a clean typecheck and build.

**Entry 4 — validation: what operators actually say (replace with real notes)**

> Sent [N] outreach touches to treasury operators and TMS consultants; held [N]
> conversations. Recurring themes: [verbatim quote 1] and [verbatim quote 2].
> Strongest objection so far: [objection]. Pilot willingness: [N]/5. Nothing
> here replaces the surveyed pain numbers, but it tells us which part of the
> pitch to lead with. Log: [link].

**Entry 5 — judging-ready and what's next**

> Submission materials complete: five platform assets, a 9-slide deck, the
> business brief, and the pilot plan. The live demo runs on the shared DevNet;
> the hardened package is with the Noders team for vetting. Next after the
> hackathon: five operator conversations logged, pilot design with one group
> treasury, and wallet-signed approvals so subsidiaries sign with their own keys
> instead of a server-mediated click.
