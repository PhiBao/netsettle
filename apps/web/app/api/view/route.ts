import { NextResponse } from "next/server";
import { normalizePartyKey } from "@netting/core";
import { getLedger, partyIdFor } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";

/**
 * Subsidiary-scoped view: the privacy demonstration.
 * Returns only what one party is entitled to see — its own obligation legs,
 * its own receipts, its own approvals — plus live ledger verification counts
 * queried as that party, so the isolation claim is checkable, not asserted.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const party = searchParams.get("party") ?? "";
  const session = await getSessionStore();
  const store = session.store;
  const key = normalizePartyKey(party);

  const obligations = store.obligations
    .filter((o) => o.debtorKey === key || o.creditorKey === key)
    .map((o) => ({
      id: o.id,
      direction: o.debtorKey === key ? "owe" : "owed",
      counterparty: o.debtorKey === key ? (o.mappedCreditor ?? o.creditor) : (o.mappedDebtor ?? o.debtor),
      amountMinor: o.amountMinor,
      currency: o.currency,
      dueDate: o.dueDate,
      reference: o.reference,
      status: o.status,
    }));

  const receipts = store.proposals.flatMap((p) =>
    p.receipts
      .filter(
        (r) =>
          normalizePartyKey(r.transfer.from) === key || normalizePartyKey(r.transfer.to) === key,
      )
      .map((r) => ({
        proposalId: r.proposalId,
        direction: normalizePartyKey(r.transfer.from) === key ? "paid" : "received",
        counterparty:
          normalizePartyKey(r.transfer.from) === key ? r.transfer.to : r.transfer.from,
        amountMinor: r.transfer.amountMinor,
        currency: r.transfer.currency,
        ledgerReference: r.ledgerReference,
      })),
  );

  let verification: { verified: boolean; obligations?: number; receipts?: number; reason?: string };
  try {
    const ledger = getLedger();
    const partyId = partyIdFor(party);
    const [obls, rcpts] = await Promise.all([
      ledger.gateway.activeContracts(partyId, "Obligation"),
      ledger.gateway.activeContracts(partyId, "SettlementReceipt"),
    ]);
    verification = { verified: true, obligations: obls.length, receipts: rcpts.length };
  } catch (err) {
    verification = { verified: false, reason: String(err) };
  }

  const peers = [...new Set(obligations.map((o) => o.counterparty))];
  return withSession(
    NextResponse.json({
      party,
      obligations,
      receipts,
      verification,
      // What this party must NOT see: every other counterparty relationship.
      hiddenFromThisParty: peers.length,
    }),
    session,
  );
}
