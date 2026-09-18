import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CantonGateway,
  createdContractIds,
  GatewayError,
  templateId,
} from "../gateway.js";

describe("encoding helpers", () => {
  it("builds fully-qualified template IDs", () => {
    assert.equal(templateId("pkg", "Netting", "Obligation"), "pkg:Netting:Obligation");
  });

  it("extracts created contract IDs for one template only", () => {
    const tx = {
      events: [
        { createdEvent: { templateId: "pkg:Netting:Obligation", contractId: "c1" } },
        { createdEvent: { templateId: "pkg:Netting:SettlementReceipt", contractId: "c2" } },
        { createdEvent: { templateId: "pkg:Netting:Obligation", contractId: "c1" } },
      ],
    };
    assert.deepEqual(createdContractIds(tx, ":Obligation"), ["c1"]);
    assert.deepEqual(createdContractIds(tx, ":SettlementReceipt"), ["c2"]);
  });

  it("surfaces ledger errors with endpoint context", async () => {
    const gateway = new CantonGateway({
      baseUrl: "http://127.0.0.1:1",
      packageId: "pkg",
      userId: "test",
    });
    await assert.rejects(
      () =>
        gateway.createApproval({ operator: "O", approver: "A", proposalId: "P" }),
      (err: unknown) => err instanceof GatewayError && err.endpoint.includes("submit"),
    );
  });
});

// Live round-trip against a real participant. Skipped unless explicitly enabled
// so unit runs never depend on network or ledger state.
const LIVE = process.env.CANTON_JSON_API_URL && process.env.CANTON_PACKAGE_ID;

describe("live ledger round-trip", { skip: !LIVE }, () => {
  it("settles the canonical demo cycle", async () => {
    const gateway = new CantonGateway({
      baseUrl: process.env.CANTON_JSON_API_URL!,
      packageId: process.env.CANTON_PACKAGE_ID!,
      userId: "netting-test",
    });
    const parties = JSON.parse(process.env.CANTON_TEST_PARTIES ?? "{}") as Record<string, string>;
    const operator = parties.operator;
    const de = parties.de;
    const fr = parties.fr;
    const sg = parties.sg;
    assert.ok(operator && de && fr && sg, "CANTON_TEST_PARTIES must provide operator/de/fr/sg");

    const stamp = Date.now().toString(36);
    const refs = [`T-${stamp}-1`, `T-${stamp}-2`, `T-${stamp}-3`];
    const c1 = await gateway.createObligation({
      operator, debtor: de, creditor: fr, amountMinor: "10000000",
      currency: "USD", dueDate: "2026-10-31", reference: refs[0],
    });
    const c2 = await gateway.createObligation({
      operator, debtor: fr, creditor: sg, amountMinor: "8000000",
      currency: "USD", dueDate: "2026-10-31", reference: refs[1],
    });
    const c3 = await gateway.createObligation({
      operator, debtor: sg, creditor: de, amountMinor: "6000000",
      currency: "USD", dueDate: "2026-10-31", reference: refs[2],
    });
    const proposal = await gateway.createProposal({
      operator,
      proposalId: `PROP-${stamp}`,
      currency: "USD",
      obligationCids: [c1, c2, c3],
      residuals: [
        { from: de, to: fr, amountMinor: "2000000" },
        { from: de, to: sg, amountMinor: "2000000" },
      ],
      requiredApprovers: [de, fr, sg],
      expiresAt: "2026-12-31T00:00:00Z",
    });
    const approvals = [
      await gateway.createApproval({ operator, approver: de, proposalId: `PROP-${stamp}` }),
      await gateway.createApproval({ operator, approver: fr, proposalId: `PROP-${stamp}` }),
      await gateway.createApproval({ operator, approver: sg, proposalId: `PROP-${stamp}` }),
    ];
    const receipts = await gateway.executeProposal(operator, proposal, approvals);
    assert.equal(receipts.length, 2);

    const remaining = await gateway.activeContracts(operator, "Obligation");
    const ours = remaining.filter((c) =>
      [refs[0], refs[1], refs[2]].includes(String((c.payload.reference as string) ?? "")),
    );
    assert.equal(ours.length, 0);
  });
});
