import { NextResponse } from "next/server";
import { approveProposal } from "@netting/core";
import { GatewayError } from "@netting/canton-gateway";
import { getLedger, LedgerNotConfiguredError, partyIdFor } from "@/lib/ledger";
import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  const { proposalId, partyKey } = (await request.json()) as {
    proposalId: string;
    partyKey: string;
  };
  const store = getStore();
  const index = store.proposals.findIndex((p) => p.id === proposalId);
  if (index === -1) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const proposal = store.proposals[index];
  if (!proposal.ledgerCid) {
    return NextResponse.json({ error: "Proposal was never committed to the ledger" }, { status: 409 });
  }

  try {
    const ledger = getLedger();
    const displayByKey = new Map<string, string>();
    for (const o of store.obligations) {
      displayByKey.set(o.debtorKey, o.mappedDebtor ?? o.debtor);
      displayByKey.set(o.creditorKey, o.mappedCreditor ?? o.creditor);
    }
    const display = displayByKey.get(partyKey);
    if (!display) return NextResponse.json({ error: "Unknown party" }, { status: 400 });
    const approvalCid = await ledger.gateway.createApproval({
      operator: ledger.operatorParty,
      approver: partyIdFor(display),
      proposalId: proposal.id,
    });
    const updated = approveProposal(proposal, partyKey, display, new Date().toISOString());
    store.proposals[index] = {
      ...updated,
      ledgerCid: proposal.ledgerCid,
      ledgerApprovalCids: [...proposal.ledgerApprovalCids, approvalCid],
      receipts: proposal.receipts,
    };
    return NextResponse.json({ proposal: store.proposals[index], approvalCid });
  } catch (err) {
    if (err instanceof LedgerNotConfiguredError) {
      return NextResponse.json({ error: "ledger_not_configured", message: err.message }, { status: 503 });
    }
    const message = err instanceof GatewayError ? err.message : String(err);
    return NextResponse.json({ error: "approval_failed", message }, { status: 502 });
  }
}
