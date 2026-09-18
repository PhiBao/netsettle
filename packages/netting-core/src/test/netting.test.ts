import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ingestCsv,
  resetObligationCounterForTests,
} from "../ingest.js";
import { computeNetPositions, computeResiduals, findCycle, summarizeNetting } from "../netting.js";
import {
  approveProposal,
  createProposal,
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

  it("expires proposals past their deadline", () => {
    const obligations = seed();
    const proposal = createProposal(obligations, { expiresAt: "2026-10-01T00:00:00Z" });
    const expired = approveProposal(proposal, "ACME DE", "Acme DE", "2026-10-02T00:00:00Z");
    assert.equal(expired.status, "expired");
    assert.ok(settlementBlockers(expired, "2026-10-02T00:00:00Z").includes("Proposal expired"));
  });
});
