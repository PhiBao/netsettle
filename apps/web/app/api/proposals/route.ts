import { NextResponse } from "next/server";
import { createProposal } from "@netting/core";
import { GatewayError } from "@netting/canton-gateway";
import { getLedger, LedgerNotConfiguredError, partyIdFor } from "@/lib/ledger";
import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  const { expiresAt } = (await request.json().catch(() => ({}))) as { expiresAt?: string };
  const store = getStore();
  const eligible = store.obligations.filter((o) => o.status === "pending" && !o.reviewRequired);
  if (eligible.length === 0) {
    return NextResponse.json({ error: "No eligible obligations. Resolve reviews first." }, { status: 409 });
  }
  let proposal;
  try {
    proposal = createProposal(eligible, {
      expiresAt: expiresAt ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      now: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 409 });
  }

  const displayByKey = new Map<string, string>();
  for (const o of eligible) {
    displayByKey.set(o.debtorKey, o.mappedDebtor ?? o.debtor);
    displayByKey.set(o.creditorKey, o.mappedCreditor ?? o.creditor);
  }
  try {
    const ledger = getLedger();
    const cidByObligation = new Map<string, string>();
    for (const o of eligible) {
      const debtor = o.mappedDebtor ?? o.debtor;
      const creditor = o.mappedCreditor ?? o.creditor;
      const cid = await ledger.gateway.createObligation({
        operator: ledger.operatorParty,
        debtor: partyIdFor(debtor),
        creditor: partyIdFor(creditor),
        amountMinor: o.amountMinor,
        currency: o.currency,
        dueDate: o.dueDate,
        reference: o.reference ?? o.id,
      });
      cidByObligation.set(o.id, cid);
      o.ledgerCid = cid;
      o.status = "proposed";
    }
    const ledgerCid = await ledger.gateway.createProposal({
      operator: ledger.operatorParty,
      proposalId: proposal.id,
      currency: proposal.currency,
      obligationCids: proposal.obligationIds.map((id) => cidByObligation.get(id)!),
      residuals: proposal.summary.residuals.map((r) => ({
        from: partyIdFor(r.from),
        to: partyIdFor(r.to),
        amountMinor: r.amountMinor,
      })),
      requiredApprovers: proposal.requiredApprovals.map((key) =>
        partyIdFor(displayByKey.get(key)!),
      ),
      expiresAt: proposal.expiresAt,
    });
    store.proposals.push({ ...proposal, ledgerCid, ledgerApprovalCids: [], receipts: [] });
    return NextResponse.json({ proposal, ledgerCid });
  } catch (err) {
    if (err instanceof LedgerNotConfiguredError) {
      return NextResponse.json(
        { error: "ledger_not_configured", message: err.message },
        { status: 503 },
      );
    }
    const message = err instanceof GatewayError ? err.message : String(err);
    return NextResponse.json({ error: "ledger_write_failed", message }, { status: 502 });
  }
}
