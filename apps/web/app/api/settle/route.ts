import { NextResponse } from "next/server";
import { formatMinor, settlementBlockers } from "@netting/core";
import { GatewayError } from "@netting/canton-gateway";
import { getLedger, LedgerNotConfiguredError } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";

export async function POST(request: Request) {
  const { proposalId } = (await request.json()) as { proposalId: string };
  const session = await getSessionStore();
  const store = session.store;
  const index = store.proposals.findIndex((p) => p.id === proposalId);
  if (index === -1) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const proposal = store.proposals[index];
  if (!proposal.ledgerCid) {
    return NextResponse.json({ error: "Proposal was never committed to the ledger" }, { status: 409 });
  }

  const blockers = settlementBlockers(proposal, new Date().toISOString());
  if (blockers.length > 0) {
    // Deliberate failure path: the ledger is never touched.
    return NextResponse.json({ settled: false, blockers }, { status: 409 });
  }

  try {
    const ledger = getLedger();
    const receiptCids = await ledger.gateway.executeProposal(
      ledger.operatorParty,
      proposal.ledgerCid,
      proposal.ledgerApprovalCids,
    );
    const partyIdToDisplay = new Map<string, string>();
    for (const name of Object.keys(ledger.partyMap)) {
      partyIdToDisplay.set(ledger.partyMap[name], name);
    }
    const receipts = await ledger.gateway.readReceipts(ledger.operatorParty);
    const ours = receipts.filter((r) => receiptCids.includes(r.contractId));
    const displayReceipts = ours.map((r) => ({
      proposalId: proposal.id,
      transfer: {
        from: partyIdToDisplay.get(r.from) ?? r.from,
        fromKey: "",
        to: partyIdToDisplay.get(r.to) ?? r.to,
        toKey: "",
        amountMinor: r.amountMinor,
        currency: r.currency,
      },
      ledgerReference: r.contractId,
      settledAt: new Date().toISOString(),
    }));
    for (const id of proposal.obligationIds) {
      const obligation = store.obligations.find((o) => o.id === id);
      if (obligation) obligation.status = "settled";
    }
    store.proposals[index] = { ...proposal, status: "settled", receipts: displayReceipts };
    return withSession(NextResponse.json({
      settled: true,
      receipts: displayReceipts,
      summary: {
        gross: formatMinor(proposal.summary.grossMinor, proposal.currency),
        net: formatMinor(proposal.summary.netMovedMinor, proposal.currency),
      },
    }), session);
  } catch (err) {
    if (err instanceof LedgerNotConfiguredError) {
      return NextResponse.json({ error: "ledger_not_configured", message: err.message }, { status: 503 });
    }
    const message = err instanceof GatewayError ? err.message : String(err);
    return NextResponse.json({ error: "settlement_failed", message }, { status: 502 });
  }
}
