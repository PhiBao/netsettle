import { NextResponse } from "next/server";
import { approveProposal } from "@netting/core";
import { GatewayError } from "@netting/canton-gateway";
import { getLedger, LedgerNotConfiguredError, partyIdFor, termsBindingEnabled } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";
import { proposalTermsHash } from "@/lib/terms";
import { bump } from "@/lib/metrics";

export async function POST(request: Request) {
  const { proposalId, partyKey } = (await request.json()) as {
    proposalId: string;
    partyKey: string;
  };
  const session = await getSessionStore();
  const store = session.store;
  const index = store.proposals.findIndex((p) => p.id === proposalId);
  if (index === -1) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const proposal = store.proposals[index];
  if (!proposal.ledgerCid) {
    return NextResponse.json({ error: "Proposal was never committed to the ledger" }, { status: 409 });
  }
  // App validation BEFORE any ledger write: a party outside the required set
  // must not leave an orphan Approval on the shared node.
  if (!proposal.requiredApprovals.includes(partyKey)) {
    return NextResponse.json({ error: "Party is not a required approver" }, { status: 403 });
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
    const bindTerms = termsBindingEnabled();
    if (bindTerms && !proposal.termsHash) {
      return NextResponse.json(
        { error: "Proposal has no terms hash — recreate it before approving." },
        { status: 409 },
      );
    }
    if (bindTerms) {
      // Recompute the hash from current session state and cross-check it twice:
      // against the stored hash (catches a mutated session store) and against
      // the ledger-committed proposal (catches ledger/store divergence). The
      // approval binds to terms the ledger actually holds, not to a string.
      const obligationCids = proposal.obligationIds.map(
        (id) => store.obligations.find((o) => o.id === id)?.ledgerCid ?? "",
      );
      if (obligationCids.some((cid) => !cid)) {
        return NextResponse.json({ error: "Proposal references uncommitted obligations" }, { status: 409 });
      }
      const residuals = proposal.summary.residuals.map((r) => ({
        from: partyIdFor(r.from),
        to: partyIdFor(r.to),
        amountMinor: r.amountMinor,
      }));
      const requiredApprovers = proposal.requiredApprovals.map((key) =>
        partyIdFor(displayByKey.get(key)!),
      );
      const recomputed = proposalTermsHash({
        operator: ledger.operatorParty,
        proposalId: proposal.id,
        currency: proposal.currency,
        obligationCids,
        residuals,
        requiredApprovers,
        expiresAt: proposal.expiresAt,
      });
      if (recomputed !== proposal.termsHash) {
        return NextResponse.json(
          { error: "Proposal terms changed since commit — recreate it before approving." },
          { status: 409 },
        );
      }
      const committed = await ledger.gateway.getProposal(ledger.operatorParty, proposal.ledgerCid);
      if (!committed || committed.termsHash !== proposal.termsHash) {
        return NextResponse.json(
          { error: "Ledger proposal does not match — recreate it before approving." },
          { status: 409 },
        );
      }
    }
    const approvalCid = await ledger.gateway.createApproval({
      operator: ledger.operatorParty,
      approver: partyIdFor(display),
      proposalId: proposal.id,
      termsHash: bindTerms ? proposal.termsHash : undefined,
    });
    const updated = approveProposal(proposal, partyKey, display, new Date().toISOString());
    store.proposals[index] = {
      ...updated,
      ledgerCid: proposal.ledgerCid,
      ledgerApprovalCids: [...proposal.ledgerApprovalCids, approvalCid],
      receipts: proposal.receipts,
    };
    bump("approvalsCast");
    return withSession(NextResponse.json({ proposal: store.proposals[index], approvalCid }), session);
  } catch (err) {
    if (err instanceof LedgerNotConfiguredError) {
      return NextResponse.json({ error: "ledger_not_configured", message: err.message }, { status: 503 });
    }
    const message = err instanceof GatewayError ? err.message : String(err);
    return NextResponse.json({ error: "approval_failed", message }, { status: 502 });
  }
}
