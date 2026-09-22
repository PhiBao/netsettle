import { NextResponse } from "next/server";
import { createProposal, groupByCurrency, isProposalEligible } from "@netting/core";
import type { StoredObligation } from "@/lib/store";
import { GatewayError } from "@netting/canton-gateway";
import { getLedger, LedgerNotConfiguredError, partyIdFor } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";

export async function POST(request: Request) {
  const { expiresAt } = (await request.json().catch(() => ({}))) as { expiresAt?: string };
  const session = await getSessionStore();
  const store = session.store;
  const eligible: StoredObligation[] = store.obligations.filter(isProposalEligible);
  if (eligible.length === 0) {
    return NextResponse.json({ error: "No eligible obligations. Resolve reviews first." }, { status: 409 });
  }
  const buckets = groupByCurrency(eligible);
  const expiry = expiresAt ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();
  const displayByKey = new Map<string, string>();
  for (const o of eligible) {
    displayByKey.set(o.debtorKey, o.mappedDebtor ?? o.debtor);
    displayByKey.set(o.creditorKey, o.mappedCreditor ?? o.creditor);
  }
  try {
    const ledger = getLedger();
    const created: Array<{ proposal: (typeof store.proposals)[number]; ledgerCid: string }> = [];
    for (const [, bucket] of buckets) {
      let proposal;
      try {
        proposal = createProposal(bucket, { expiresAt: expiry, now });
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 409 });
      }
      const cidByObligation = new Map<string, string>();
      for (const o of bucket) {
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
      const stored = { ...proposal, ledgerCid, ledgerApprovalCids: [] as string[], receipts: [] as never[] };
      store.proposals.push(stored);
      created.push({ proposal: stored, ledgerCid });
    }
    return withSession(NextResponse.json({ proposals: created.map((c) => c.proposal) }), session);
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
