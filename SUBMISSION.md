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
**Video:** `netsettle-demo.mp4` — 2:49, narrated, burned-in subtitles (`.srt`
alongside). Recorded against a fresh local ledger so the take is deterministic;
every number in it comes from the running product. Keep it out of git (19 MB)
and attach it to the submission form, or upload it unlisted and link that.
**Deck:** `netsettle-deck.pdf` — 9 slides, 16:9, same rule: attach, don't commit.

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

### 1. Who they are

| | |
| --- | --- |
| **Segment** | Group treasury at mid-market multinationals — cross-border intercompany payables for goods, services, loans and tax; industry-agnostic within that (strongest fit: manufacturing, distribution, business services, tech with foreign subsidiaries) |
| **Company size / stage** | $50M–$2B revenue · 5–50 legal entities · $1M–$100M gross intercompany volume per cycle |
| **User** | Group Treasury Operations Manager / Head of Treasury Operations — owns the monthly cycle for a 3–8 person team |
| **Buyer** | Same person for tooling at this price point; Group Treasurer signs; procurement joins above ~$50k. *Assumed from how TMS/netting budgets sit — to confirm in pilot conversations.* |
| **Geography** | EU + US + APAC groups with cross-border flows; no constraint on the netting decision itself (it is currency-bucketed and bank-rail compatible) |

### 2. Their pain

- **Top pain point (their words):** "I can't ask the subsidiaries to upload their payables into a shared system — an AP file shows suppliers, pricing and margins — and I can't risk a netting cycle that executes halfway. So everything settles gross, every month."
- **How often it happens:** monthly cycle (some groups weekly or quarterly); disputes, late invoices and FX noise land inside every cycle.
- **What it costs them:** days of treasury + entity-controller time per cycle; bank and FX fees on every leg — including the circular part that cancels arithmetically; working capital trapped in intercompany cycles; reconciliation and audit risk; month-end pressure.
- **How they solve it today:** Excel + email (the norm), an enterprise TMS module (multi-month implementation), or a bank netting center where the bank becomes central counterparty.

### 3. What they want

- **Job to be done:** "When the monthly netting cycle starts, I want to compress what the group owes itself and settle only the residual, so I can free working capital, cut payment fees, and keep an audit trail — without asking any subsidiary to expose its books."
- **What would make them switch:** proof in one cycle (upload → gross-to-net in minutes); a bank-ready output their existing rail accepts (CSV + ISO 20022 pain.001); entity-level privacy; no ERP project; a trust boundary they can explain to internal audit and tax.
- **What would stop them:** payables data leaving the group's control; opaqueness of the netting math; a half-settled cycle ever being possible; implementation effort; and — today's real blocker — no reference customer in treasury yet.

### 4. Where to find them

- **Communities, events and channels:** Treasury Today and TMI (Treasury Management International) content + LinkedIn comment threads; AFP (US) and EACT member communities (member-gated); shared-service-centre / intercompany accounting groups; Canton builder and mentor channels (ecosystem leverage, not end users).
- **Tools and platforms they already rely on:** Excel; SAP/Oracle/NetSuite ERPs; TMS (Kyriba, GTreasury, ION); bank portals (PNC PINACLE, J.P. Morgan ACCESS); SWIFT / pain.001 rails.
- **3 real companies that fit the profile** (documented netting users from our validation sources — profile fits, *not* customers and not in contact yet): Weir Group PLC (Group Treasurer described netting benefits via J.P. Morgan), Bandwidth (Treasurer on settling bilaterally before netting), Innospec (Group Treasurer on replacing an Excel-based process). Names + sources in `VALIDATION.md`. Our own named-pipeline is built through the outreach in `OUTREACH.md` (search strings there).

### 5. Who is NOT your customer (for now)

- **Mega-corporates committed to an enterprise TMS rollout** — 12-month implementation programs; we win on time-to-first-cycle.
- **Single-entity or domestic-only groups** — no intercompany cycle to compress.
- **Groups that need cross-currency netting today** — FX-aware netting is roadmap; we refuse to invent rates.
- **Crypto-native/DIY treasuries** — different buyer, different trust model.
- **Consumers and small businesses** — intercompany netting is a corporate-group problem.

### Checklist

- [x] The segment is narrow enough to name real companies or people
- [x] User and buyer are identified (buyer marked as assumption)
- [x] The pain is described from their point of view
- [x] You know where to reach them
- [x] You've said who you're not targeting

---

## 3. Metrics / Validation evidence

### 1. North Star metric

- **Metric:** **executed netting cycles per group per month** — one cycle = ingest → approvals → atomic settlement → bank file, for one group.
- **Why this one:** it is the product's unit of value. Partial usage (uploads without settlement) or vanity traffic does not count; a cycle executed means a treasury team replaced the spreadsheet ritual for one month and will come back next month for a new reason: the accumulated mappings, disputes and counterparty graph.
- **How you measure it:** anonymous counters in the demo (`/api/metrics`: sessions, ingests, proposals, approvals, settlements, completed flows, payment-file downloads — no PII) cross-checked against on-ledger `SettlementReceipt` and `NettingProposal` contracts, which are the source of truth. Live on the public deployment.

### 2. What we needed to validate

| Assumption | Why it matters | Status |
| --- | --- | --- |
| Groups run a monthly intercompany cycle that is manual and costly | no cycle, no product | ✅ confirmed by secondary research (88% payment-ops problems; named treasurers describe the spreadsheet cycle) — ❌ **not yet confirmed by direct interviews** |
| Subsidiaries refuse to expose payables in a shared system | our privacy differentiator is load-bearing | ⏳ testing (secondary reasoning + AP-file leakage argument; needs operator confirmation) |
| Treasury will accept an operator that sees the full graph (as bank netting centers do) | determines whether privacy story blocks or enables adoption | ⏳ testing |
| A CSV → bank-file pilot is adoptable without IT | our wedge vs TMS projects | ⏳ testing (product works; no external pilot yet) |
| Groups will pay, anchored to eliminated fees | business model | ⏳ testing (budget exists — 84% invested — pricing inferred, not quoted) |

### 3. Conversations

**Direct operator conversations: 0 so far.** I am not going to dress up a survey
or a forum post as an interview. What exists instead, in the order a judge should
weight it:

| Evidence | What it is | Where |
| --- | --- | --- |
| **Real usage on the public demo** | 7 sessions, 3 completed cycles, 6 settlements, 3 payment files — anonymous counters, no session ids or IPs | live at `/api/metrics` |
| **On-ledger footprint** | 24 active settlement receipts and **0 obligations or proposals left open** when last measured (2026-09-27) — every cycle started on the shared node finished, nothing half-settled | ledger, queried as each party |
| **Adversarial testing** | blocked execution, tampered terms, wrong-approver-set and empty-approver rejection, missing approvals, duplicate and unknown-counterparty rows, fully-circular cycles — 6 Daml / 20 core / 8 judgment / 7 gateway tests | repo, `dpm test` + `pnpm -r test` |
| **Problem research** | 6 cited sources on netting adoption and AP-file confidentiality, incl. named treasurers at Weir, Bandwidth, Innospec — cited as evidence of the *problem*, never as users of this product | `VALIDATION.md` |
| **Outreach in flight** | N targeted asks to ex-treasurers from that research, TMS implementers and AFP/EACT intercompany groups; each offers to compress one of their own cycles from a CSV in 15 minutes. Replies land in the platform journal as they arrive. | `OUTREACH.md` |

**Strongest quote:** none yet — deliberately left empty until the first real
call.

**What I am doing about it:** the fastest credible route to a non-zero number is
not cold outreach, it is the 15-minute ask above, plus posting the demo where
treasury practitioners already are (Canton Forum/Discord, treasury management
communities) and asking specifically for treasury people. Target: 3 conversations
before Oct 9.

### 4. Tests and results

- **What we tried:** (1) full product flow on the shared HackCanton DevNet, repeatedly; (2) malformed and hostile inputs (duplicate invoices, unknown counterparties, missing approvals, fully-circular cycles, replayed approvals); (3) public demo without instrumentation.
- **What happened:** **0 active obligations or proposals on DevNet — every cycle that was started is fully settled** — and **24 active settlement receipts** held by the four demo parties (counted 2026-09-27 by querying the ledger as each party); USD demo cycle $312,000 → $40,000 in 3 transfers; EUR €70,000 → €30,000 in 1; blocked settlements refused with the ledger untouched; a tampered-terms proposal could not settle; anonymous counters verified incrementing through the full flow on the public deployment.
- **What we changed because of it:** proposal commits parallelized after measuring 40–60s per cycle; the privacy check reworked after we watched raw shared-node counts mislead (now proves isolation against the session's own batch); approvals bound to a proposal-terms hash after adversarial review; fully-netted cycles made first-class after edge-case testing; bootstrap made idempotent after cold-start failures.

### 5. Product and on-ledger metrics

| Metric | How we measure it | Now | Target by submission |
| --- | --- | --- | --- |
| Users who tried the demo | anonymous counters at `/api/metrics` (no PII) — **live** | counter live; sessions increment on first visit | ≥25 external sessions (judges' and mentors' runs count) |
| Users who completed the core flow | completed-flow counter (first settlement per session) | **1 measured** in the deploy-verification run | ≥5 external completions |
| Settlements executed on DevNet | `SettlementReceipt` contracts + proposals | **24 active receipts; 0 active obligations (all started cycles fully settled)** | ≥40 receipts (judges' runs count, nothing left half-settled) |
| Active parties | operator + subsidiaries on DevNet | **5** (operator + 4 subsidiaries) | 5 held (party allocation is operator-gated) |
| Tests green | `pnpm -r test` + `dpm test` | 20 core / 8 judgment / 7 gateway / 6 Daml | stay green + route-level tests |

### 6. Success criteria after the hackathon

| Metric | Target in 90 days |
| --- | --- |
| Logged operator conversations | 15 |
| Groups running a real payables file through a pilot | 3 |
| Groups completing 2 consecutive monthly cycles | 1 |
| Pipeline: warm intros from TMS consultants | 5 |
| Signed pilot (paid or design-partner agreement) | 1 |

### 7. What we still don't know

- Whether willingness to pilot converts to willingness to pay, and at what price.
- Tax and accounting treatment of netted intercompany settlement per jurisdiction (varies; needs the pilot group's tax sign-off).
- Whether subsidiaries truly object to the operator-sees-all trust boundary, or welcome it as the status quo they already have with bank netting centers.
- Where the scaling wall is: cycle detection is correct but greedy at 10,000+ invoices.
- Which ERP export format the first pilot actually needs.
- **How we'll answer:** the outreach sprint (this week), a concierge pilot design with the first willing group, and tax review with that group's advisors.

### Checklist

- [x] One North Star metric with a clear definition
- [ ] At least 3 conversations with potential users — **top open item; currently 0**
- [x] Assumptions are marked confirmed, rejected or still testing
- [x] At least one test with a number attached (DevNet receipts, compression, blocked paths)
- [x] Current values and targets are filled in
- [x] You show what changed because of what you learned (parallel commits, isolation proof, terms binding, full netting, idempotent bootstrap)

---

## 4. GTM / Go-to-market

### 1. Positioning

**In one sentence:** For **group treasury teams at mid-market multinationals** who
**settle intercompany payables gross because payables are confidential and
netting must be all-or-nothing**, **NetSettle** is a **monthly netting
workstation** that **compresses the cycle into one atomic Canton transaction —
each subsidiary seeing only its own legs — and exports a bank-ready payment
file**. Unlike **spreadsheets, enterprise TMS modules and bank netting
centers**, we **require no ERP project, insert no principal counterparty, and
keep subsidiaries private from each other**.

- **What do users do today instead?** Excel + email (the norm); an enterprise
  TMS netting module; or a bank netting center (bank becomes central
  counterparty).
- **Why Canton, and not any other chain?** Stakeholder-scoped privacy between
  parties plus atomic multi-party execution. A transparent chain publishes the
  group's netting graph; a shared database gives every participant the same
  read; a settlement bank inserts principal risk. *(Honest boundary: the
  operator computing over the full graph sees everything — the same position as
  a netting center, minus the intermediary. This is stated in every pitch.)*

### 2. First customers

- **Segment:** mid-market multinationals (5–50 entities, $50M–$2B revenue) whose
  treasury ops team runs a monthly intercompany cycle; strongest where
  cross-border EU/US/APAC flows exist.
- **Why them first:** the pain is recurring and measurable; a CSV pilot needs no
  IT project; one signature onboards every subsidiary; the pain.001 output does
  not replace their system of record, so approval is small.
- **First 3–5 targets:** (a) treasury leads identified through the outreach
  sprint's LinkedIn search strings; (b) TMS implementation consultants who run
  netting projects; (c) mentor introductions inside the HackCanton ecosystem.
  Profile evidence (not leads): Weir Group, Bandwidth, Innospec — treasurers who
  have publicly described running these cycles.

### 3. Distribution channels

| Channel | Why it reaches our users | First concrete action | Effort / cost |
| --- | --- | --- | --- |
| Warm outreach + referrals (LinkedIn, mentors) | trust is the buying blocker; a conversation beats a landing page | Send the 20 touches in `OUTREACH.md`; book 5 calls | 1–2 days, free |
| TMS-adjacent consultants | they implement netting for a living and know which groups hate Excel | 10 consultant DMs with the live demo link | 1 day, free |
| Treasury content communities (Treasury Today / TMI / AFP) | where the ICP reads and comments | Publish the "netting cycle teardown" post + demo thread | 2 days, free |
| Canton ecosystem (mentors, accelerator, Featured App, wallet/node partners) | post-hackathon distribution and credibility with institutions | Accelerator application + Featured App path after a MainNet deployment | medium, free/low |
| Account-specific outreach to profile fits | highest intent once the pitch has evidence | 10 targeted emails after the first 5 calls | 2 days, free |

### 4. Acquisition hypotheses

| Hypothesis | How we test it | Success metric | Status |
| --- | --- | --- | --- |
| A treasury team will run one real month through a CSV pilot because the output is a bank file, not a system replacement | Offer a concierge pilot to every interviewee | ≥1 group processes a real payables file | ⏳ testing |
| TMS consultants will refer groups because a lightweight netting tool fits projects too small for a TMS | 10 consultant conversations with the demo | ≥2 warm intros | ⏳ testing |
| Pricing anchored to eliminated fees (fraction of saved bank/FX cost) is acceptable | Pricing questions in the interview script | ≥1 willingness-to-pay signal | ⏳ testing |
| Entity-level privacy is decisive versus a shared database | Unprompted mentions in interviews; positioning A/B | ≥3 of 5 conversations raise confidentiality unprompted | ⏳ testing |

### 5. Business model

- **Who pays, and for what:** group treasury pays for the netting cycle — a
  per-group subscription (all entities included) or per-cycle fee; later,
  white-label for TMS vendors and banks that want the workflow without building
  it.
- **Pricing hypothesis:** annual per-group subscription anchored to a fraction
  of eliminated bank/FX fees; first cycle free as the concierge pilot.
- **Revenue on Canton:** no token and no value transfer — subscriptions plus, on
  MainNet, Featured App rewards and later usage-based pricing for
  netting-as-a-service. Value flows through the existing banking rails, which is
  exactly the selling point for treasury.
- **Why now:** payment-ops budget is active (84% invested in the last 12–18
  months), netting ROI is documented (up to 70% fewer transfers), and Canton's
  privacy + atomicity just became accessible to a small team via Daml 3.x and
  the JSON Ledger API.

### 6. First 90 days after the hackathon

| Period | Milestone | How we'll know it's done |
| --- | --- | --- |
| Weeks 1–4 | 5+ logged conversations; pilot one-pager and pricing tests out | Conversation log filled; ≥3 groups requested a pilot walkthrough |
| Weeks 5–8 | Concierge pilot with one group on a dedicated lens (DevNet/hosted) | One real month of payables processed end-to-end; bank file produced |
| Weeks 9–12 | Production deployment path + first paid design partner; Feature App application prepared | Signed pilot/design-partner agreement; participant/topology decision documented |

### 7. Risks and what you need

- **What could block adoption:** no reference customer yet (the real blocker);
  tax/accounting treatment of netted settlement (needs the group's tax sign-off);
  entity-level trust in the operator role; ERP export formats for the pilot; a
  production participant/hosting story (ours or the group's); jurisdiction
  questions on netting itself.
- **What you need from the ecosystem:** introductions to treasury operators and
  TMS consultants (mentors), guidance/support on hosting a production
  participant, legal/tax framing for netting pilots, and accelerator
  distribution after the hackathon.

### Checklist

- [x] Positioning fits in one sentence
- [x] First segment is specific — not "everyone in DeFi"
- [x] At least two channels with a concrete first action
- [x] At least three hypotheses, each with a metric
- [x] It's clear who pays and why
- [x] You can explain why Canton and not any chain

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

## Sponsor challenges — eligibility (re-checked 2026-10-01)

**Bottom line: tick "BitSafe Challenge — Contribution Pool". Do not apply for
Gold. Do not tag Grofty.**

The challenge selector is a dropdown with **no free-text field**, so the BitSafe
story has to live in artifacts rather than in the form: deck page 8, README §6,
and (optionally) the video.

Video limit is **5 minutes**. Because the challenge selector has no text field,
the video carries the demonstration: it now ends on a terminal scene running
`dp/settle-as-decentralized-party.sh` on a local Canton LocalNet, showing the real
refusal (`requires authorizers netsettle-operator::…`), both members confirming,
and the receipt signed by the party. Cut is **3:12** (191.8s), 108s under the
limit, with burned-in subtitles.

### BitSafe — Decentralizing Apps on Canton (50,000 CC)

Entry route: **"Decentralize the application" → contribution pool (20,000 CC,
2 teams)**.

| Requirement (from the BitSafe brief) | NetSettle | Verdict |
|---|---|---|
| Create a **Decentralized Party** for the application being built | `netsettle-operator::1220c096…`, threshold 2, two members with split signing authority | ✅ |
| Distribute hosting, shared control, **or both** | Shared control — claimed and demonstrated (see below) | ✅ |
| **Reproducible LocalNet demo** (mandatory for pool eligibility) | `bash dp/reproduce.sh` → *"All five steps passed."* Verified from wiped DM state | ✅ |
| **Shared control:** "a governed action cannot execute below the required confirmation threshold, then succeeds when the threshold is met" | Proven twice — governance layer and settlement layer, both refused **by Daml** | ✅ |
| Public GitHub repository | `github.com/PhiBao/netsettle` (public) | ✅ |
| Presentation explaining the app, the risk, **and the DM integration** | 10-page deck; page 8 is the DM integration | ✅ |
| Test results / evidence of a working implementation | 20/8/7/4 tests green; scripts exit non-zero if the property regresses | ✅ |

Not claimed, and deliberately so: **distributed hosting**. Node-outage
behaviour is not demonstrated. Both members run on one machine in the demo, so
that would show key independence, not machine-level outage tolerance — and the
brief explicitly warns that "multiple nodes alone do not prove independent
control or outage tolerance" while rewarding honest scope.

**Do not apply for Gold** (30,000 CC): it requires a live Decentralized Party on
DevNet or MainNet, applied for by Oct 4. The shared hackathon DevNet cannot host
team Decentralized Parties and we have no node of our own.

Correction: an earlier note here claimed that applying for Gold forfeits the
contribution pool. That was wrong — the challenge list carries Contribution Pool
and Gold as separate options and each says you can also enter the other. Gold is
ruled out purely because we cannot meet its technical requirement in time, not
because entering it would cost us the pool. Enter the **Contribution Pool**
option only.

#### Paste-ready copy for the BitSafe field

> The netting operator is the party that sees the whole obligation graph and
> whose signature commits a settlement — so it is the last party that should sit
> under one host's control. It is now a Canton Decentralized Party at threshold
> 2, hosted by two participants.
>
> A governed settlement is expressed as a `GovernableAction`, the interface
> `Governance.Rules` exercises once `threshold` members confirm. The host that
> proposes a settlement cannot execute it: Canton returns
> `DAML_AUTHORIZATION_ERROR … requires authorizers netsettle-operator::…`, naming
> the party whose authority was missing. Once both members confirm, the
> Decentralization Manager executes the proposal *as the party*, and the
> settlement receipts are signed by that party rather than by any host.
>
> Both refusals come from Daml on the ledger, not from our application — which
> matters, because an application-level check can be edited past by whoever
> controls the application. `bash dp/reproduce.sh` rebuilds the party and
> re-proves both halves in one command.
>
> We claim shared control and demonstrate it. We do not claim uptime: both
> members run on one machine in the LocalNet demo, so what is shown is
> cryptographic independence of the operators' keys and the threshold rule, not
> organisational independence.

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
- [x] Record the video and export the deck — both files sit outside the repo in
      `~/hackcanton-submission/`. Still to do: attach them to the submission
      form and publish the project page.
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
