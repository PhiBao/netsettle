import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ingestCsv,
  resetObligationCounterForTests,
} from "../ingest.js";
import { computeNetPositions, computeResiduals, findCycle, groupByCurrency, summarizeNetting } from "../netting.js";
import {
  approveProposal,
  canonicalProposalTerms,
  createProposal,
  isProposalEligible,
  resetProposalCounterForTests,
  settlementBlockers,
} from "../proposals.js";

const SEED_CSV = `debtor,creditor,amount,currency,due_date,reference,memo
Acme DE,Acme FR,100000,USD,2026-10-31,INV-001,Goods
Acme FR,Acme SG,80000,USD,2026-10-31,INV-002,Services
Acme SG,Acme DE,60000,USD,2026-10-31,INV-003,Goods
`;

function seed() {
  resetObligationCounterForTests();
  resetProposalCounterForTests();
  const { obligations, issues } = ingestCsv(SEED_CSV);
  assert.equal(issues.length, 0);
  return obligations;
}

describe("netting", () => {
  it("compresses a three-party cycle into net residuals", () => {
    const obligations = seed();
    const summary = summarizeNetting(obligations);
    assert.equal(summary.grossMinor, "24000000");
    // Net: DE -40k, FR +20k, SG +20k -> DE pays 20k each to FR and SG.
    assert.equal(summary.residualCount, 2);
    assert.equal(summary.netMovedMinor, "4000000");
    const byKey = new Map(summary.positions.map((p) => [p.partyKey, p.netMinor]));
    assert.equal(byKey.get("ACME DE"), "-4000000");
    assert.equal(byKey.get("ACME FR"), "2000000");
    assert.equal(byKey.get("ACME SG"), "2000000");
  });

  it("conserves value: residuals match net positions", () => {
    const obligations = seed();
    const positions = computeNetPositions(obligations);
    const residuals = computeResiduals(obligations, "USD");
    const paid = new Map<string, bigint>();
    const received = new Map<string, bigint>();
    for (const r of residuals) {
      paid.set(r.fromKey, (paid.get(r.fromKey) ?? 0n) + BigInt(r.amountMinor));
      received.set(r.toKey, (received.get(r.toKey) ?? 0n) + BigInt(r.amountMinor));
    }
    for (const p of positions) {
      const net = BigInt(p.netMinor);
      const actual = (received.get(p.partyKey) ?? 0n) - (paid.get(p.partyKey) ?? 0n);
      assert.equal(actual, net, `conservation violated for ${p.partyKey}`);
    }
  });

  it("finds a cycle for explanation", () => {
    const obligations = seed();
    const cycle = findCycle(obligations);
    assert.ok(cycle);
    assert.equal(cycle![0], cycle![cycle!.length - 1]);
  });

  it("flags near-duplicates with a different reference for review", () => {
    resetObligationCounterForTests();
    const { obligations } = ingestCsv(
      "debtor,creditor,amount,currency,due_date,reference\n" +
        "Acme DE,Acme FR,100000,USD,2026-10-31,INV-001\n" +
        "Acme DE,Acme FR,100000,USD,2026-10-31,INV-001-R\n",
    );
    assert.equal(obligations[0].reviewRequired, false);
    assert.equal(obligations[1].reviewRequired, true);
    assert.match(obligations[1].reviewReasons.join(" "), /ifferent reference/);
  });

  it("partitions obligations into single-currency buckets", () => {
    resetObligationCounterForTests();
    const { obligations } = ingestCsv(
      "debtor,creditor,amount,currency,due_date,reference\n" +
        "Acme DE,Acme FR,100000,USD,2026-10-31,INV-001\n" +
        "Acme DE,Acme FR,50000,EUR,2026-10-31,INV-101\n" +
        "Acme FR,Acme DE,20000,EUR,2026-10-31,INV-102\n",
    );
    const buckets = groupByCurrency(obligations);
    assert.deepEqual([...buckets.keys()], ["EUR", "USD"]);
    assert.equal(buckets.get("EUR")!.length, 2);
    // Each bucket nets independently.
    const eur = summarizeNetting(buckets.get("EUR")!);
    assert.equal(eur.grossMinor, "7000000");
    assert.equal(eur.netMovedMinor, "3000000");
    assert.equal(eur.residualCount, 1);
  });

  it("quarantines exact duplicates", () => {
    resetObligationCounterForTests();
    const { obligations } = ingestCsv(`${SEED_CSV}Acme DE,Acme FR,100000,USD,2026-10-31,INV-001,Goods\n`);
    const dup = obligations.find((o) => o.reference === "INV-001" && o.status === "quarantined");
    assert.ok(dup);
    assert.match(dup!.reviewReasons.join(" "), /uplicate/);
  });
});

describe("proposals", () => {
  it("requires every party before settlement", () => {
    const obligations = seed();
    const proposal = createProposal(obligations, { expiresAt: "2026-11-30T00:00:00Z" });
    assert.deepEqual(proposal.requiredApprovals, ["ACME DE", "ACME FR", "ACME SG"]);
    assert.ok(settlementBlockers(proposal, "2026-10-01T00:00:00Z").length > 0);

    let p = approveProposal(proposal, "ACME DE", "Acme DE", "2026-10-01T00:00:00Z");
    p = approveProposal(p, "ACME FR", "Acme FR", "2026-10-01T00:00:00Z");
    assert.equal(p.status, "pending_approval");
    assert.ok(
      settlementBlockers(p, "2026-10-01T00:00:00Z").some((b) => b.includes("ACME SG")),
    );

    p = approveProposal(p, "ACME SG", "Acme SG", "2026-10-01T00:00:00Z");
    assert.equal(p.status, "ready");
    assert.deepEqual(settlementBlockers(p, "2026-10-01T00:00:00Z"), []);
  });

  it("excludes disputed obligations from proposals", () => {
    const obligations = seed();
    obligations[0].disputeNote = "Amount contested by creditor";
    assert.equal(isProposalEligible(obligations[0]), false);
    assert.equal(isProposalEligible(obligations[1]), true);
    const proposal = createProposal(obligations, { expiresAt: "2026-11-30T00:00:00Z" });
    assert.ok(!proposal.obligationIds.includes(obligations[0].id));
    assert.ok(proposal.obligationIds.includes(obligations[1].id));
  });

  it("expires proposals past their deadline", () => {
    const obligations = seed();
    const proposal = createProposal(obligations, { expiresAt: "2026-10-01T00:00:00Z" });
    const expired = approveProposal(proposal, "ACME DE", "Acme DE", "2026-10-02T00:00:00Z");
    assert.equal(expired.status, "expired");
    assert.ok(settlementBlockers(expired, "2026-10-02T00:00:00Z").includes("Proposal expired"));
  });

  it("settles a fully-netted cycle with zero residual transfers", () => {
    resetObligationCounterForTests();
    resetProposalCounterForTests();
    const { obligations } = ingestCsv(
      "debtor,creditor,amount,currency,due_date,reference\n" +
        "Acme DE,Acme FR,100000,USD,2026-10-31,INV-001\n" +
        "Acme FR,Acme SG,100000,USD,2026-10-31,INV-002\n" +
        "Acme SG,Acme DE,100000,USD,2026-10-31,INV-003\n",
    );
    const summary = summarizeNetting(obligations);
    assert.equal(summary.grossMinor, "30000000");
    assert.equal(summary.netMovedMinor, "0");
    assert.equal(summary.residualCount, 0);

    let proposal = createProposal(obligations, { expiresAt: "2026-11-30T00:00:00Z" });
    assert.ok(
      settlementBlockers(proposal, "2026-10-01T00:00:00Z").every((b) => !b.includes("residual")),
      "a fully-netted proposal must not be blocked for having no transfers",
    );
    proposal = approveProposal(proposal, "ACME DE", "Acme DE", "2026-10-01T00:00:00Z");
    proposal = approveProposal(proposal, "ACME FR", "Acme FR", "2026-10-01T00:00:00Z");
    proposal = approveProposal(proposal, "ACME SG", "Acme SG", "2026-10-01T00:00:00Z");
    assert.deepEqual(settlementBlockers(proposal, "2026-10-01T00:00:00Z"), []);
  });

  it("canonicalizes proposal terms deterministically", () => {
    const terms = {
      operator: "OP",
      proposalId: "PROP-0001",
      currency: "USD",
      obligationCids: ["c1", "c2"],
      residuals: [{ from: "DE", to: "FR", amountMinor: "100" }],
      requiredApprovers: ["SG", "DE", "FR"],
      expiresAt: "2026-11-30T00:00:00Z",
    };
    const canonical = canonicalProposalTerms(terms);
    // Approver order does not change the hash; a different amount does.
    assert.equal(
      canonical,
      canonicalProposalTerms({ ...terms, requiredApprovers: ["DE", "FR", "SG"] }),
    );
    assert.notEqual(
      canonical,
      canonicalProposalTerms({
        ...terms,
        residuals: [{ from: "DE", to: "FR", amountMinor: "101" }],
      }),
    );
    assert.notEqual(canonical, canonicalProposalTerms({ ...terms, proposalId: "PROP-0002" }));
    // The operator is part of the hashed terms: consent does not migrate
    // across operators even if every other field is identical.
    assert.notEqual(canonical, canonicalProposalTerms({ ...terms, operator: "OP2" }));
  });
});
