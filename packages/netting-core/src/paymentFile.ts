import { formatMinor } from "./money.js";
import type { NettingProposal, SettlementReceipt } from "./types.js";

export interface PaymentFileRow {
  proposalId: string;
  index: number;
  from: string;
  to: string;
  amountMajor: string;
  currency: string;
  valueDate: string;
  ledgerReceiptCid: string;
  executedAt: string;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build the bank-actionable payment file for a settled proposal.
 *
 * This is the artifact the treasury actually uploads to the bank: one row per
 * residual transfer, with the ledger receipt contract as the audit reference.
 * The atomic Canton transaction decides the netting outcome; this file carries
 * that decision into the existing banking rail. Pure function — no I/O.
 */
export function buildPaymentRows(
  proposal: NettingProposal,
  receipts: SettlementReceipt[],
  valueDate: string,
): PaymentFileRow[] {
  return proposal.summary.residuals.map((residual, i) => {
    const receipt = receipts[i];
    const amountMajor = formatMinor(residual.amountMinor, residual.currency).replace(
      / [A-Z]{3}$/,
      "",
    );
    return {
      proposalId: proposal.id,
      index: i + 1,
      from: residual.from,
      to: residual.to,
      amountMajor,
      currency: residual.currency,
      valueDate,
      ledgerReceiptCid: receipt?.ledgerReference ?? "",
      executedAt: receipt?.settledAt ?? "",
    };
  });
}

export function paymentRowsToCsv(rows: PaymentFileRow[]): string {
  const header =
    "proposal_id,residual_index,from,to,amount,currency,value_date,ledger_receipt_cid,executed_at";
  const lines = rows.map((r) =>
    [
      r.proposalId,
      String(r.index),
      r.from,
      r.to,
      r.amountMajor,
      r.currency,
      r.valueDate,
      r.ledgerReceiptCid,
      r.executedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

/** Latest due date across the netted obligations — the settlement value date. */
export function valueDateFor(dueDates: string[]): string {
  if (dueDates.length === 0) throw new Error("No due dates for value date");
  return [...dueDates].sort().at(-1)!;
}
