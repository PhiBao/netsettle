import { NextResponse } from "next/server";
import { buildPaymentRows, paymentRowsToCsv, valueDateFor } from "@netting/core";
import { getSessionStore, withSession } from "@/lib/store";

/**
 * Bank-actionable artifact for a settled proposal: one CSV row per residual
 * transfer, each referencing its ledger receipt contract. This file is what the
 * treasury uploads to the bank — the atomic Canton transaction decides the
 * netting outcome; this carries the decision into the existing banking rail.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get("proposalId") ?? "";
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
  const rows = buildPaymentRows(
    proposal,
    proposal.receipts,
    dueDates.length > 0 ? valueDateFor(dueDates) : new Date().toISOString().slice(0, 10),
  );
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
