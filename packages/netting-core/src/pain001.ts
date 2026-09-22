import type { PaymentFileRow } from "./paymentFile.js";

export interface Pain001Options {
  messageId: string;
  creationDateTime: string;
  /** ISO date the bank should execute the transfers. Defaults to value date. */
  requestedExecutionDate?: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build an ISO 20022 pain.001.001.03 customer credit transfer initiation from
 * settled netting residuals.
 *
 * One payment-information block per (debtor, currency) group; one transaction
 * per residual. Control sum and transaction count are derived from the rows so
 * the file is internally consistent. Counterparty account identification uses
 * the subsidiary name (Othr/Id) because account resolution is ERP-sourced in
 * production — the ledger receipt contract id travels in RmtInf/Ustrd as the
 * end-to-end audit reference. Pure function — no I/O.
 */
export function buildPain001(rows: PaymentFileRow[], options: Pain001Options): string {
  if (rows.length === 0) throw new Error("No residuals for pain.001");
  const currency = rows[0].currency;
  if (!rows.every((r) => r.currency === currency)) {
    throw new Error("pain.001 block must be single-currency");
  }
  const groups = new Map<string, PaymentFileRow[]>();
  for (const row of rows) {
    const list = groups.get(row.from) ?? [];
    list.push(row);
    groups.set(row.from, list);
  }
  const total = rows.reduce((sum, r) => sum + Number(r.amountMajor), 0);
  const requestedDate = options.requestedExecutionDate ?? rows[0].valueDate;

  const txXml = (row: PaymentFileRow): string => `          <CdtTrfTxInf>
            <PmtId>
              <EndToEndId>${esc(`${options.messageId}-${row.index}`)}</EndToEndId>
            </PmtId>
            <Amt>
              <InstdAmt Ccy="${esc(row.currency)}">${esc(row.amountMajor)}</InstdAmt>
            </Amt>
            <Cdtr>
              <Nm>${esc(row.to)}</Nm>
            </Cdtr>
            <CdtrAcct>
              <Id>
                <Othr>
                  <Id>${esc(row.to)}</Id>
                </Othr>
              </Id>
            </CdtrAcct>
            <RmtInf>
              <Ustrd>${esc(`Netting ${row.proposalId} residual ${row.index} receipt ${row.ledgerReceiptCid}`)}</Ustrd>
            </RmtInf>
          </CdtTrfTxInf>`;

  const pmtInfXml = ([debtor, list]: [string, PaymentFileRow[]], i: number): string => {
    const subtotal = list.reduce((sum, r) => sum + Number(r.amountMajor), 0);
    const txs = list.map(txXml).join("\n");
    return `      <PmtInf>
        <PmtInfId>${esc(`${options.messageId}-PMT-${i + 1}`)}</PmtInfId>
        <PmtMtd>TRF</PmtMtd>
        <NbOfTxs>${list.length}</NbOfTxs>
        <CtrlSum>${subtotal.toFixed(2)}</CtrlSum>
        <ReqdExctnDt>
          <Dt>${esc(requestedDate)}</Dt>
        </ReqdExctnDt>
        <Dbtr>
          <Nm>${esc(debtor)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <Othr>
              <Id>${esc(debtor)}</Id>
            </Othr>
          </Id>
        </DbtrAcct>
${txs}
      </PmtInf>`;
  };

  const blocks = [...groups.entries()].map(pmtInfXml).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${esc(options.messageId)}</MsgId>
      <CreDtTm>${esc(options.creationDateTime)}</CreDtTm>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${total.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>NetSettle</Nm>
      </InitgPty>
    </GrpHdr>
${blocks}
  </CstmrCdtTrfInitn>
</Document>
`;
}
