import { NextResponse } from "next/server";
import {
  buildPain001,
  buildPaymentRows,
  paymentRowsToCsv,
  valueDateFor,
  type PaymentFileRow,
} from "@netting/core";
import { getSessionStore, withSession } from "@/lib/store";

/**
 * Bank-actionable artifacts for a settled proposal.
 * - CSV: one row per residual transfer (human-readable, spreadsheet-ready).
 * - pain.001: ISO 20022 customer credit transfer initiation — the file format
 *   treasuries actually upload to the bank. Ledger receipt contracts travel in
 *   RmtInf as the end-to-end audit reference.
 * The atomic Canton transaction decides the netting outcome; these files carry
 * that decision into the existing banking rail.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get("proposalId") ?? "";
  const format = searchParams.get("format") ?? "csv";
  const session = await getSessionStore();
  const store = session.store;
  const proposal = store.proposals.find((p) => p.id === proposalId);
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.status !== "settled" || proposal.receipts.length === 0) {
    return NextResponse.json(
      { error: "Payment file is available only after atomic settlement" },
      { status: 409 },
    );
  }
  const dueDates = store.obligations
    .filter((o) => proposal.obligationIds.includes(o.id))
    .map((o) => o.dueDate);
  const valueDate =
    dueDates.length > 0 ? valueDateFor(dueDates) : new Date().toISOString().slice(0, 10);
  const rows: PaymentFileRow[] = buildPaymentRows(proposal, proposal.receipts, valueDate);

  if (format === "pain001") {
    const xml = buildPain001(rows, {
      messageId: `NETSETTLE-${proposal.id}`,
      creationDateTime: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    });
    return withSession(
      new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="netting-${proposal.id}-pain001.xml"`,
        },
      }),
      session,
    );
  }
  const csv = paymentRowsToCsv(rows);
  return withSession(
    new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="netting-${proposal.id}-payment.csv"`,
      },
    }),
    session,
  );
}
