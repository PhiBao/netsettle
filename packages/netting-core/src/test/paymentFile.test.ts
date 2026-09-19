import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ingestCsv, resetObligationCounter } from "../ingest.js";
import { summarizeNetting } from "../netting.js";
import { buildPaymentRows, paymentRowsToCsv, valueDateFor } from "../paymentFile.js";
import { createProposal, resetProposalCounter } from "../proposals.js";

const CSV = `debtor,creditor,amount,currency,due_date,reference
Acme DE,Acme FR,100000,USD,2026-10-31,INV-001
Acme FR,Acme SG,80000,USD,2026-10-31,INV-002
Acme SG,Acme DE,60000,USD,2026-10-31,INV-003
`;

describe("payment file", () => {
  it("produces one bank row per residual with ledger references", () => {
    resetObligationCounter();
    resetProposalCounter();
    const { obligations } = ingestCsv(CSV);
    const proposal = createProposal(obligations, { expiresAt: "2026-11-30T00:00:00Z" });
    const summary = summarizeNetting(obligations);
    assert.equal(summary.residualCount, 2);

    const receipts = proposal.summary.residuals.map((r, i) => ({
      proposalId: proposal.id,
      transfer: { ...r, fromKey: "", toKey: "" },
      ledgerReference: `receipt-cid-${i}`,
      settledAt: "2026-10-01T00:00:00Z",
    }));
    const valueDate = valueDateFor(obligations.map((o) => o.dueDate));
    const rows = buildPaymentRows(proposal, receipts, valueDate);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].amountMajor, "20000.00");
    assert.equal(rows[0].ledgerReceiptCid, "receipt-cid-0");
    assert.equal(rows[0].valueDate, "2026-10-31");

    const csv = paymentRowsToCsv(rows);
    const lines = csv.trim().split("\n");
    assert.equal(lines.length, 3);
    assert.ok(lines[0].startsWith("proposal_id,residual_index,from,to,amount"));
    assert.ok(lines[1].includes("receipt-cid-0"));
    // Totals reconcile: payment file moves exactly the net amount.
    const moved = rows.reduce((s, r) => s + Number(r.amountMajor), 0);
    assert.equal(moved.toFixed(2), "40000.00");
  });

  it("escapes CSV-hostile counterparty names", () => {
    resetObligationCounter();
    resetProposalCounter();
    const { obligations } = ingestCsv(
      `debtor,creditor,amount,currency,due_date,reference\n"Acme, DE",Acme FR,100,USD,2026-10-31,INV-1\nAcme FR,"Acme, DE",50,USD,2026-10-31,INV-2\n`,
    );
    const proposal = createProposal(obligations, { expiresAt: "2026-11-30T00:00:00Z" });
    const receipts = proposal.summary.residuals.map((r, i) => ({
      proposalId: proposal.id,
      transfer: { ...r, fromKey: "", toKey: "" },
      ledgerReference: `cid-${i}`,
      settledAt: "2026-10-01T00:00:00Z",
    }));
    const csv = paymentRowsToCsv(buildPaymentRows(proposal, receipts, "2026-10-31"));
    assert.ok(csv.includes('"Acme, DE"'));
  });
});
