import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPain001 } from "../pain001.js";
import type { PaymentFileRow } from "../paymentFile.js";

const ROWS: PaymentFileRow[] = [
  {
    proposalId: "PROP-0001", index: 1, from: "Acme US", to: "Acme FR",
    amountMajor: "8000.00", currency: "USD", valueDate: "2026-10-31",
    ledgerReceiptCid: "cid-1", executedAt: "2026-10-01T00:00:00Z",
  },
  {
    proposalId: "PROP-0001", index: 2, from: "Acme US", to: "Acme SG",
    amountMajor: "22000.00", currency: "USD", valueDate: "2026-10-31",
    ledgerReceiptCid: "cid-2", executedAt: "2026-10-01T00:00:00Z",
  },
  {
    proposalId: "PROP-0001", index: 3, from: "Acme DE", to: "Acme SG",
    amountMajor: "10000.00", currency: "USD", valueDate: "2026-10-31",
    ledgerReceiptCid: "cid-3", executedAt: "2026-10-01T00:00:00Z",
  },
];

describe("pain.001", () => {
  it("builds a consistent credit-transfer initiation", () => {
    const xml = buildPain001(ROWS, {
      messageId: "NETSETTLE-PROP-0001",
      creationDateTime: "2026-10-01T00:00:00Z",
    });
    assert.ok(xml.includes('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"'));
    assert.ok(xml.includes("<NbOfTxs>3</NbOfTxs>"));
    assert.ok(xml.includes("<CtrlSum>40000.00</CtrlSum>"));
    // One payment-info block per debtor.
    assert.equal(xml.split("<PmtInf>\n").length - 1, 2);
    // Every receipt travels as the audit reference.
    for (const row of ROWS) {
      assert.ok(xml.includes(row.ledgerReceiptCid), `missing ${row.ledgerReceiptCid}`);
    }
    assert.ok(xml.includes('<InstdAmt Ccy="USD">22000.00</InstdAmt>'));
    // Well-formed: tags balance (word-boundary aware so PmtInfId is not counted).
    for (const tag of ["Document", "CstmrCdtTrfInitn", "GrpHdr", "PmtInf", "CdtTrfTxInf"]) {
      const open = (xml.match(new RegExp(`<${tag}(>|\\s)`, "g")) ?? []).length;
      const close = xml.split(`</${tag}>`).length - 1;
      assert.equal(open, close, `unbalanced ${tag}`);
    }
  });

  it("escapes XML-hostile names", () => {
    const xml = buildPain001(
      [{ ...ROWS[0], from: "Acme & Sons <DE>", to: "Acme \"FR\"" }],
      { messageId: "M", creationDateTime: "2026-10-01T00:00:00Z" },
    );
    assert.ok(xml.includes("Acme &amp; Sons &lt;DE&gt;"));
    assert.ok(xml.includes("Acme &quot;FR&quot;"));
  });

  it("refuses empty and mixed-currency input", () => {
    assert.throws(() => buildPain001([], { messageId: "M", creationDateTime: "T" }));
    assert.throws(() =>
      buildPain001(
        [ROWS[0], { ...ROWS[1], currency: "EUR" }],
        { messageId: "M", creationDateTime: "T" },
      ),
    );
  });
});
