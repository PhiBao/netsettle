# Validation dossier — intercompany netting

**Status: secondary research, NOT user interviews.** Everything below is public,
cited, and checkable. It does not replace conversations with treasury operators —
those remain the gold standard and the first post-hackathon task (outreach kit at
the bottom). Nothing here is a fabricated customer quote.

Researched 2026-09-19. All sources accessed the same day.

## 1. The problem is real and budgeted

**Manual payment operations are the norm, not the exception.**

- 88% of financial decision-makers say their company faces payment-operations
  problems: manual (47%), complicated (35%), slow (27%), inefficient (26%).
  51% perform up to half of payment operations manually; 68% say finance wastes
  a lot of time on them.
  — Modern Treasury / Harris Poll, *State of Payments Operations 2025* (500 US
  financial decision-makers, Jan 2025).
  https://www.moderntreasury.com/newsroom/press-releases/9-in-10-companies-struggle-with-payment-operations
- 75% of companies name reducing manual processes their top disbursement pain
  point; only **1 in 9** have fully automated payment disbursements.
  — Deluxe / Strategic Treasurer, *2025 AP Automation Readiness* summary.
  https://www.deluxe.com/content/dam/deluxe/us/en/home/resources/payments/dpx/2025-ap-automation-readiness-summary-report.pdf
- ~80% of treasury departments still use manual processes; centralisation is the
  stated efficiency driver but "automation is not currently keeping pace."
  — KPMG, *Global Treasury Survey 2025* (340 experts, 20+ countries).
  https://kpmg.com/de/en/home/insights/2025/11/global-treasury-survey-2025.html
- Cash-flow forecasting is treasurers' #1 priority two years running, blocked by
  "too many processes still manual" and fragmented IT.
  — EACT (European Association of Corporate Treasurers), *Treasury Survey 2025*.
  https://admin.treasury-management.com/wp-content/uploads/2025/05/EACT_survey_2025-final.pdf

**Money is being spent to fix exactly this.**

- 84% of companies invested in payment operations in the last 12–18 months;
  67% specifically in payment automation. (Modern Treasury/Harris 2025, ibid.)

## 2. Netting specifically: quantified, underappreciated, painful today

- Cross-border intercompany transfers reducible **by as much as 70%**; FX volumes
  cut by as much as 70%; FX hedge trades reducible **by up to 75%**.
  — GTreasury/Ripple Treasury netting product material; Stark estimate via
  Treasury Today.
  https://treasurytoday.com/cash-liquidity-management/more-to-come-from-netting-and-pooling
- Named pains of the pre-netting world, from a vendor that implements netting
  for a living: small/numerous/costly FX deals at subsidiaries, many payments
  with high bank charges, time-consuming reconciliation, large intercompany
  booking mismatches, "reconciliation challenges, numerous e-mails."
  — GTreasury netting product card.
  https://cdn.prod.website-files.com/67bd795fede7a5d9a1aa16e4/67c39add0ed1a101e26dc745_GTreasury%20Product%20Card%20%E2%80%94%20Netting.pdf
- "Netting offsets internal transactions and allows cashless settlement of
  intercompany balances. This results in cost savings through improved and
  minimized FX risk exposures, lower hedging costs, simplified cash flow
  forecasting and transaction processing efficiencies."
  — **Alouis Ngoshi, Group Treasurer, Weir Group PLC**, via J.P. Morgan (Nov 2025).
  https://www.jpmorgan.com/insights/treasury/liquidity-management/fx-exposure-netting-risk-management-solutions
- "We have a large number of cross-border, cross-currency transactions and prior
  to netting we were settling these bilaterally."
  — **Scott Taylor, Treasurer, Bandwidth**, via Treasury Today (Mar 2024).
- "Intercompany payments are prepared by the accounts payable department and
  included (and hidden) in third-party payment runs" — i.e. corporates without
  netting often can't even *see* their intercompany flows.
  — Daniel Cugni, GTreasury, via Treasury Today (ibid.).
- "We were using an Excel based system, but it took quite a bit of work to get
  to a forecast and it didn't do the complexities like intercompany transactions
  well."
  — **Andy Hawes, Group Treasurer, Innospec**, GTreasury case study.
  https://cdn.prod.website-files.com/69a58994a3daefc00194e59b_Innospec%20%E2%80%94%20GTreasury%20Success%20Story.pdf
- Concrete horror story: pharma BI processes intercompany payments **monthly**
  because each regulated-market payment needs physical invoice copies, customs
  references, and bank doc review taking **a week or longer** — "invoices due
  must be identified, collected and manually married with information from
  customs tools."
  — Treasury Today / TIS case study (Sep 2025).
  https://treasurytoday.com/asa-2025-winners/bi-transforms-intercompany-payments-in-emerging-markets-process
- Intercompany netting described as "a relatively **underappreciated** treasury
  solution" — awareness exists, but internal buy-in (tax, accounting) blocks
  adoption. (Treasury Today, Mar 2024, ibid.)

## 3. The incumbent shape (what we position against)

Enterprise netting today = TMS module or bank netting center:

- **TMS modules** (GTreasury, ION/Wallstreet, Kyriba, SAP): calendar netting,
  AP/AR upload, dispute tooling, ERP interfaces. Licensed enterprise software
  with implementation projects.
- **Bank netting centers** (PNC PINACLE: 50+ currencies, one payment per entity
  per cycle; J.P. Morgan VAM/IHB): the bank takes the central counterparty role.
  https://www.pnc.com/content/dam/pnc-com/pdf/corporateandinstitutional/International/FX/pinacle-fx-netting.pdf
- Notably, PNC's feature list — dispute module with email notification, netting
  statements, ERP import/export, **role-based access with dual authorization for
  approvals** — independently converges on our design (per-subsidiary approvals,
  payment-file export). The workflow shape is validated; the execution layer is
  where we differ.

**Our wedge, stated without overclaim:** incumbents centralize through a
settlement bank or a central database that sees everything in the clear.
NetSettle keeps the central-visibility trust position for the *operator*
(stated openly in README) but gives subsidiaries cryptographic-level privacy
*from each other* via Canton's stakeholder model, and makes the multilateral
commit atomic instead of reconciled-after-the-fact. Against TMS: no
implementation project, no-new-token, bank-rail-compatible output. Against
bank centers: no principal-risk intermediary required for the commit step.

## 4. What this dossier does NOT prove (explicit gaps)

1. No treasury operator has seen or reacted to NetSettle. Willingness to *pilot*
   is unvalidated.
2. The 70%/75% figures are vendor/aspirational numbers for full enterprise
   rollouts, not promises for our MVP.
3. Regulatory/tax treatment of netted intercompany settlement varies by
   jurisdiction — the BI case shows docs requirements alone can force monthly
   cycles. Our single-currency MVP sidesteps FX, which is where much of the
   cited savings live.
4. Pricing/willingness-to-pay is inferred (84% invest; TMS budgets exist), not
   quoted.

## 5. Outreach kit (for the first warm intro)

**DM (under 100 words):**

> Hi [name] — I'm building NetSettle, a tool for the monthly intercompany
> netting cycle: subsidiaries' payables get compressed into net settlements in
> one atomic commit, each entity seeing only its own legs, ending in a
> bank-ready payment file. 15 min to react to a 3-min demo? Not selling —
> trying to learn if the spreadsheet cycle is as painful from the inside as the
> surveys say.

**Five questions (15 minutes):**

1. Walk me through your last netting cycle — who touches it, how long end to end?
2. Where does it break or stall most often? (disputes? late invoices? FX?)
3. What do subsidiaries complain about? What does tax/compliance demand?
4. What would make you trust a new tool with the payables file? What would kill it instantly?
5. If this worked, who signs for a pilot — you, or someone else?

**Log every conversation** (date, role, company size, cycle frequency, tools,
verbatim pain, objection, pilot willingness 1–5). Five such logs beat fifty
survey citations.
