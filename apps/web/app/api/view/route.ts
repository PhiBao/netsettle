import { NextResponse } from "next/server";
import { normalizePartyKey } from "@netting/core";
import { isActiveContractLimit } from "@netting/canton-gateway";
import { getLedger, partyIdFor } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";

interface Verdict {
  verified: boolean;
  ownReceipts: { visible: number; total: number };
  othersReceipts: { hidden: number; total: number };
  ownObligations: { visible: number; total: number };
  othersObligations: { hidden: number; total: number };
  scope: string;
  reason?: string;
}

/**
 * Subsidiary-scoped view: the privacy demonstration.
 *
 * Returns only what one party is entitled to see — its own obligation legs,
 * its own receipts, its own approvals — and then *proves isolation against the
 * ledger* using this session's own batch as the controlled sample:
 *
 *   - every receipt involving this party is readable when querying as it;
 *   - every receipt from the same batch that does NOT involve this party is
 *     absent when querying as it.
 *
 * Counting "everything on the ledger" is deliberately avoided: the shared
 * hackathon node accumulates contracts from other demo runs, so raw counts say
 * nothing about isolation. Same-batch visibility/absence is the honest test.
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

  // This session's batch, as the controlled sample for the isolation proof.
  const sessionReceipts = store.proposals.flatMap((p) => p.receipts);
  const ownReceipts = sessionReceipts.filter(
    (r) => normalizePartyKey(r.transfer.from) === key || normalizePartyKey(r.transfer.to) === key,
  );
  const otherReceipts = sessionReceipts.filter((r) => !ownReceipts.includes(r));
  const unsettledObligations = store.obligations.filter((o) => o.ledgerCid && o.status === "proposed");
  const ownObligations = unsettledObligations.filter(
    (o) => o.debtorKey === key || o.creditorKey === key,
  );
  const otherObligations = unsettledObligations.filter((o) => !ownObligations.includes(o));

  let verification: Verdict;
  try {
    const ledger = getLedger();
    const partyId = partyIdFor(party);
    const [obls, rcpts] = await Promise.all([
      ledger.gateway.activeContracts(partyId, "Obligation"),
      ledger.gateway.activeContracts(partyId, "SettlementReceipt"),
    ]);
    const visibleReceipts = new Set(rcpts.map((c) => c.contractId));
    const visibleObligations = new Set(obls.map((c) => c.contractId));
    const ownReceiptsSeen = ownReceipts.filter((r) => visibleReceipts.has(r.ledgerReference)).length;
    const otherReceiptsAbsent = otherReceipts.filter(
      (r) => !visibleReceipts.has(r.ledgerReference),
    ).length;
    const ownObligationsSeen = ownObligations.filter(
      (o) => visibleObligations.has(o.ledgerCid!),
    ).length;
    const otherObligationsAbsent = otherObligations.filter(
      (o) => !visibleObligations.has(o.ledgerCid!),
    ).length;
    const verified =
      ownReceiptsSeen === ownReceipts.length &&
      otherReceiptsAbsent === otherReceipts.length &&
      ownObligationsSeen === ownObligations.length &&
      otherObligationsAbsent === otherObligations.length;
    verification = {
      verified,
      ownReceipts: { visible: ownReceiptsSeen, total: ownReceipts.length },
      othersReceipts: { hidden: otherReceiptsAbsent, total: otherReceipts.length },
      ownObligations: { visible: ownObligationsSeen, total: ownObligations.length },
      othersObligations: { hidden: otherObligationsAbsent, total: otherObligations.length },
      scope: "this session's batch, queried live as the party above",
    };
  } catch (err) {
    // An unverifiable read must never read as a passed proof. When the node
    // refuses a party-scoped listing (its active-contract cap), say exactly
    // that instead of quietly claiming isolation.
    const capped = isActiveContractLimit(err);
    verification = {
      verified: false,
      ownReceipts: { visible: 0, total: ownReceipts.length },
      othersReceipts: { hidden: 0, total: otherReceipts.length },
      ownObligations: { visible: 0, total: ownObligations.length },
      othersObligations: { hidden: 0, total: otherObligations.length },
      scope: "this session's batch, queried live as the party above",
      reason: capped
        ? "The node refused a party-scoped listing (too many active contracts), so isolation could not be verified right now."
        : String(err),
    };
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
