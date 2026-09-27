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

> Subsidiaries of multinational groups owe each other millions every month — much
> of it circular, so the group moves cash that mathematically cancels. They do it
> anyway, because payables files are confidential and a half-settled cycle is
> worse than none.
>
> NetSettle turns that monthly spreadsheet-and-email ritual into one operation:
> ingest intercompany payables, resolve messy counterparty names against the
> subsidiary roster with confidence-gated judgments, catch duplicates, compress
> offsetting cycles per currency, collect per-subsidiary approvals, and settle the
> residual in a single atomic Canton transaction where each subsidiary sees only
> its own legs. Out comes a bank-ready payment file (CSV + ISO 20022 pain.001).
>
> Live demo: $312,000 across six invoices settles as $40,000 in three transfers,
> €70,000 as €30,000 in one — and a fully-circular cycle settles with zero
> transfers, obligations archived atomically.

**Shorter variant (if the field is tight):**

> NetSettle compresses the monthly intercompany netting cycle into one atomic
> Canton transaction. It ingests group payables, resolves messy counterparty
> names, catches duplicates, nets offsetting cycles per currency, collects
> per-subsidiary approvals, and settles the residual all-or-nothing — each
> subsidiary seeing only its own legs — before exporting a bank-ready payment
> file. Demo: $312k gross settles as $40k in three transfers; a fully-circular
> cycle settles with zero.

**Track:** Real-World Asset (RWA) & Business Workflows

**Tech Stack (tags):**

```text
Daml
Canton Network
Canton JSON Ledger API
TypeScript
Next.js
React
Tailwind CSS
Node.js
TypeSafe System One
ISO 20022 pain.001
```

**Demo URL:** https://100-30-125-235.nip.io
**Repo:** https://github.com/PhiBao/netsettle
**Video:** (unlisted/YouTube link — record with the shot list below)

---

## 1. Value / Problem statement

### 1. The problem in one sentence

**Group treasury teams at multinationals** struggle to **settle intercompany
payables net** because **subsidiary payables are confidential and multilateral
settlement must be all-or-nothing**, which costs them **working capital trapped
in circular debt, avoidable FX and bank fees, and days of spreadsheet
reconciliation every cycle**.

### 2. The value you create

| | Today | With NetSettle |
| --- | --- | --- |
| **What the user does** | Exports payables entity by entity, reconciles counterparty names by hand, emails a spreadsheet around, settles every invoice gross through the bank, then reconciles confirmations afterwards | Uploads the month's payables once; messy names are matched against the roster with confidence gates, duplicates are caught, cycles are compressed per currency, each subsidiary approves its own legs, and one atomic commit settles the residual |
| **Time / cost / risk** | Days per cycle across treasury and entities; every invoice moves as a bank payment including the circular part that cancels; fees and FX on every leg; spreadsheet + email is the audit trail; a half-settled cycle recreates settlement risk | First cycle in an afternoon, then under an hour; $312,000 gross settles as $40,000 in three transfers (5 of 6 payments eliminated), €70,000 as €30,000; fees only on residuals; each receipt links the netting decision to the bank payment; settlement is all-or-nothing by construction |

- **Value proposition in one line:** NetSettle compresses the monthly
  intercompany netting cycle into one atomic Canton transaction — subsidiaries
  private from each other — and hands treasury a bank-ready payment file.
- **Why users would switch from what they do today:** no ERP project, no
  settlement-bank principal in the middle, no new token, and the first cycle
  pays for itself in eliminated transfers. The output is a CSV + ISO 20022
  pain.001 file treasury already knows how to upload.

### 3. Why it matters

- **Cost of the problem:** 88% of finance decision-makers report
  payment-operations problems and 51% still do up to half of payment operations
  manually (Modern Treasury/Harris 2025); only 1 in 9 have fully automated
  disbursements (Deluxe/Strategic Treasurer 2025). Netting is documented to cut
  cross-border intercompany transfers **by up to 70%** and FX hedge trades by up
  to 75% (GTreasury/Ripple material; Treasury Today). Document handling alone
  can force monthly cycles: one pharma case needs physical invoice copies,
  customs references and bank document review taking a week or longer (TIS via
  Treasury Today, 2025).
- **How many people or companies have it:** every group with more than one
  legal entity and cross-border intercompany flows. Beachhead: mid-market
  multinationals, 5–50 entities, 10–200 intercompany invoices per month.
- **Evidence:** sourced surveys and named treasurers (Weir Group, Bandwidth,
  Innospec) in [VALIDATION.md](./VALIDATION.md); quantified results from our own
  live demo (gross → net → receipts); no fabricated interviews — operator
  conversations are logged as they happen, with the outreach kit in
  [OUTREACH.md](./OUTREACH.md).

### 4. Why now

- **What changed:** Canton's stakeholder-scoped privacy plus atomic multi-party
  execution became practical for a small team through Daml 3.x and the JSON
  Ledger API; the Season-3 shared DevNet removed the infrastructure barrier (we
  settled the full cycle on it); and System One judgment primitives make messy
  treasury input (names, duplicates, memos) tractable without an ML project.
- **Why this couldn't be solved well before:** netting required either a
  settlement bank as central counterparty (principal risk and fees) or an
  enterprise TMS module plus a multi-month implementation project — neither
  accessible to mid-market groups. The trust mechanics (confidential payables +
  all-or-nothing execution) kept netting an enterprise-only feature.

### 5. Why Canton

- **What Canton makes possible here:** privacy *between* parties — an
  `Obligation` is signed by operator + debtor and merely observed by the
  creditor, receipts only by their two parties — so subsidiaries never see each
  other's payables; atomic multi-party execution — one transaction archives
  every obligation and issues every receipt, or nothing happens; and approvals
  bound to a terms hash, so the terms cannot be swapped after approval. The
  privacy proof queries the ledger live as each party, so judges can check the
  claim rather than take it on faith.
- **Why a public chain or a plain database wouldn't do:** a shared database
  gives every participant the same read (the AP file leaks suppliers, pricing
  and margins); a transparent chain makes the group's netting graph public; a
  settlement bank inserts a principal and reconciles after the fact. Honest
  boundary: the operator computing over the full graph still sees everything —
  the same trust position as today's netting center, minus the intermediary.

### Checklist

- [x] The problem fits in one sentence
- [x] It names a specific user, not "everyone"
- [x] The value is shown as a before and after
- [x] There is evidence the problem is real
- [x] "Why now" is answered
- [x] It's clear why this belongs on Canton

---

## 2. ICP / Audience definition

### 1. The user in one sentence

**Group treasury operations managers at mid-market multinationals** need to
**settle what their subsidiaries owe each other every month** but **cannot force
entities onto a shared ledger or ask them to expose their payables**, so they
**run the cycle in Excel and email, settle gross, and reconcile afterwards**.

### 2. Who they are

| | |
| --- | --- |
| **Primary user** | Group Treasury Operations Manager / Head of Treasury Operations |
| **Company shape** | Multinational group, 5–50 legal entities, cross-border intercompany flows (EU/US/APAC), 10–200 intercompany invoices per month |
| **Context** | Monthly netting cycle owned by a 3–8 person treasury team; entities run different ERPs |
| **Measured on** | Trapped working capital, FX and bank fees, cycle time, audit findings |
| **Current behaviour** | Excel + email cycle; everything settles gross; reconciliation after the fact |
| **Secondary users** | Subsidiary finance approvers (controllers/CFOs) who sign off their own legs and must be certain no counterparty sees their payables |
| **Economic buyer** | Group Treasurer / Head of Treasury Ops; payment-operations budget (84% of companies invested in it over the last 12–18 months) |
| **Not the user** | Mega-corporates committed to a TMS module; single-entity groups; crypto-native treasuries |

### 3. What they need — and what kills a deal

- **Must have:** bank-ready output (CSV + pain.001), no ERP project, entity-level
  privacy, an audit trail that survives internal audit and tax review.
- **Nice to have:** scheduled cycles, ERP import formats, dispute workflow,
  multi-currency (FX-aware netting is roadmap — quoted rates only, never
  invented).
- **Dealbreakers:** payables leaving the group's control, opaque math, a
  half-settled cycle, or requiring every entity to adopt new software.

### 4. Why they adopt

- **Trigger:** a painful cycle (late invoices, disputes, month-end pressure) or
  a mandate to cut cross-border payment costs.
- **First moment of value:** upload one month of payables and see gross → net in
  minutes, with the circular part explained — no integration required.
- **Wedge to expansion:** one group is the unit of adoption; one signature
  onboards every subsidiary; cycles, entities and currencies expand from there.

### 5. Beachhead and expansion

- **Beachhead:** one mid-market group's monthly cycle — CSV in, bank file out.
- **Expansion:** more entities/currencies per group → FX-aware netting with a
  quoted-rate oracle → netting-center-as-a-service for mid-caps without
  treasury IT.

### Checklist

- [x] A specific user, not "everyone"
- [x] Names both the approver and the buyer
- [x] Current behaviour and why it persists
- [x] Must-haves and dealbreakers stated
- [x] Beachhead is one group; expansion path defined

> Non-goals: we do not move money, hold funds, or replace the ERP. NetSettle
> compresses the decision and produces the bank file; value moves through the
> existing banking rails.

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

## Sponsor challenges — current eligibility (checked 2026-09-28)

**Bottom line: do not tag either challenge yet.** Both requirement sets are
public; tagging without meeting them means being judged against them and scored
down. Neither is currently satisfied by NetSettle.

### BitSafe — Decentralizing Apps on Canton (50,000 CC)

Eligibility paths:

| Path | Requirement | NetSettle today | Verdict |
|---|---|---|---|
| Contribution pool (20,000 CC, 2 teams) | Reproducible **LocalNet demo** of an application integration with the Decentralization Manager, a custom module, or an open-source contribution | Nothing integrates with the Decentralization Manager | ❌ not eligible yet |
| Gold (30,000 CC) | A **Decentralized Party deployed on DevNet or MainNet**, integrated into a working application; apply by Oct 4 | No Decentralized Party; the shared hackathon DevNet explicitly cannot host teams' Decentralized Parties, and we have no own node | ❌ not feasible in time |

To become eligible for the contribution pool, the honest minimum is: run the
Decentralization Manager locally, make the **netting operator** a Decentralized
Party (2-of-3 hosts, no single host can execute settlement), wire one governed
action to it (execute settlement), and ship a clean-room reproducible LocalNet
demo. Estimate 3–5 focused days, judged on reproducibility and whether it
addresses a real risk. Decision rule: only start it after the platform
submission is published and validation outreach is running, and no later than
Oct 4 (so there is a week to finish). Do **not** apply for Gold — applying for
Gold forfeits the contribution pool.

### Grofty Wallet Bounty (10,000 CC, 3 places)

Requirements: Grofty Wallet in the **core** flow via CIP-0103 or the dApp SDK
(connect/sign/transact, not a link), end-to-end demo on **Canton MainNet**, a
public repo documenting the integration, and a ≤3 min video.

Blockers for NetSettle, in order of severity:

1. **MainNet only** — no testnet/devnet mode; every approval moves real funds.
   We have DevNet credentials only and no MainNet participant to host the
   operator party the flow needs.
2. **Single-party submission** — Grofty submits only as the connected party
   (`actAs` refused); our operator service submits as all parties. A valid
   integration means subsidiaries sign their own approvals from their own
   wallets — our roadmap, but it changes the architecture, not a bolt-on.
3. **Invitation-only access** — requested "in the first days of the hackathon";
   we are past the midpoint with no access request on record.

Verdict: ❌ **skip.** The architecture mismatch plus MainNet requirement cannot
be resolved by Oct 9 for a solo team without a node. Saying this explicitly in
the pitch Q&A is better than a shallow integration that scores 1–2 on
"integration depth".

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
