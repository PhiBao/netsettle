import { NextResponse } from "next/server";
import { createProposal, groupByCurrency, isProposalEligible } from "@netting/core";
import type { StoredObligation } from "@/lib/store";
import { GatewayError } from "@netting/canton-gateway";
import { getLedger, LedgerNotConfiguredError, partyIdFor, termsBindingEnabled } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";
import { bump } from "@/lib/metrics";
import { proposalTermsHash } from "@/lib/terms";

/**
 * Create obligations on the ledger with bounded concurrency. A bucket of eight
 * obligations is eight independent ledger submissions: sequential commits made
 * the demo wait ~40s, which reads as "hung" to a first-time visitor. Four at a
 * time is fast on the shared node without hammering it.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  const { expiresAt } = (await request.json().catch(() => ({}))) as { expiresAt?: string };
  const session = await getSessionStore();
  const store = session.store;
  const eligible: StoredObligation[] = store.obligations.filter(isProposalEligible);
  if (eligible.length === 0) {
    return NextResponse.json({ error: "No eligible obligations. Resolve reviews first." }, { status: 409 });
  }
  const buckets = groupByCurrency(eligible);
  // expiresAt is caller-supplied and travels into the on-ledger proposal and the
  // terms hash: reject non-dates and absurd ranges instead of storing them.
  const now = new Date().toISOString();
  let expiry: string;
  if (expiresAt === undefined) {
    expiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  } else {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "expiresAt is not a valid date" }, { status: 400 });
    }
    if (parsed.getTime() <= Date.now() || parsed.getTime() > Date.now() + 365 * 24 * 3600 * 1000) {
      return NextResponse.json({ error: "expiresAt must be in the future and within a year" }, { status: 400 });
    }
    expiry = parsed.toISOString();
  }
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
      const cids = await mapLimit(bucket, 4, (o) =>
        ledger.gateway.createObligation({
          operator: ledger.operatorParty,
          debtor: partyIdFor(o.mappedDebtor ?? o.debtor),
          creditor: partyIdFor(o.mappedCreditor ?? o.creditor),
          amountMinor: o.amountMinor,
          currency: o.currency,
          dueDate: o.dueDate,
          reference: o.reference ?? o.id,
        }),
      );
      bucket.forEach((o, index) => {
        o.ledgerCid = cids[index];
        o.status = "proposed";
      });

      const obligationCids = proposal.obligationIds.map(
        (id) => bucket.find((o) => o.id === id)!.ledgerCid!,
      );
      const residuals = proposal.summary.residuals.map((r) => ({
        from: partyIdFor(r.from),
        to: partyIdFor(r.to),
        amountMinor: r.amountMinor,
      }));
      const requiredApprovers = proposal.requiredApprovals.map((key) =>
        partyIdFor(displayByKey.get(key)!),
      );
      const bindTerms = termsBindingEnabled();
      const termsHash = bindTerms
        ? proposalTermsHash({
            operator: ledger.operatorParty,
            proposalId: proposal.id,
            currency: proposal.currency,
            obligationCids,
            residuals,
            requiredApprovers,
            expiresAt: proposal.expiresAt,
          })
        : undefined;
      const ledgerCid = await ledger.gateway.createProposal({
        operator: ledger.operatorParty,
        proposalId: proposal.id,
        currency: proposal.currency,
        obligationCids,
        residuals,
        requiredApprovers,
        expiresAt: proposal.expiresAt,
        termsHash,
      });
      const stored = {
        ...proposal,
        ledgerCid,
        termsHash,
        ledgerApprovalCids: [] as string[],
        receipts: [] as never[],
      };
      store.proposals.push(stored);
      created.push({ proposal: stored, ledgerCid });
    }
    bump("proposalsCreated", created.length);
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
