import { summarizeNetting } from "./netting.js";
import type { NettingProposal, Obligation } from "./types.js";

let proposalCounter = 0;

/** Reset human-readable ID counters (new ingest cycle, and test isolation). */
export function resetProposalCounter(): void {
  proposalCounter = 0;
}

/** @deprecated Use resetProposalCounter. */
export function resetProposalCounterForTests(): void {
  resetProposalCounter();
}

/** An obligation can enter a proposal only when clean, unreviewed, undisputed. */
export function isProposalEligible(o: Obligation): boolean {
  return o.status === "pending" && !o.reviewRequired && !o.disputeNote;
}

export function createProposal(
  obligations: Obligation[],
  options: { expiresAt: string; now?: string },
): NettingProposal {
  const eligible = obligations.filter(isProposalEligible);
  if (eligible.length === 0) throw new Error("No eligible obligations for a proposal");
  const summary = summarizeNetting(eligible);
  const parties = new Set<string>();
  for (const o of eligible) {
    parties.add(o.debtorKey);
    parties.add(o.creditorKey);
  }
  proposalCounter += 1;
  const now = options.now ?? new Date().toISOString();
  return {
    id: `PROP-${String(proposalCounter).padStart(4, "0")}`,
    currency: summary.currency,
    obligationIds: eligible.map((o) => o.id),
    summary,
    requiredApprovals: [...parties].sort(),
    approvals: [],
    status: "pending_approval",
    createdAt: now,
    expiresAt: options.expiresAt,
  };
}

export function approveProposal(
  proposal: NettingProposal,
  partyKey: string,
  party: string,
  now = new Date().toISOString(),
): NettingProposal {
  if (proposal.status !== "pending_approval") throw new Error(`Proposal is ${proposal.status}`);
  if (now > proposal.expiresAt) return { ...proposal, status: "expired" };
  if (!proposal.requiredApprovals.includes(partyKey)) {
    throw new Error(`Party ${partyKey} is not a required approver`);
  }
  if (proposal.approvals.some((a) => a.partyKey === partyKey)) return proposal;
  const approvals = [...proposal.approvals, { partyKey, party, approvedAt: now }];
  const ready = proposal.requiredApprovals.every((key) =>
    approvals.some((a) => a.partyKey === key),
  );
  return { ...proposal, approvals, status: ready ? "ready" : "pending_approval" };
}

export function settlementBlockers(proposal: NettingProposal, now = new Date().toISOString()): string[] {
  const blockers: string[] = [];
  if (proposal.status === "settled") blockers.push("Already settled");
  if (proposal.status === "rejected") blockers.push("Proposal was rejected");
  if (proposal.status === "expired" || now > proposal.expiresAt) blockers.push("Proposal expired");
  const missing = proposal.requiredApprovals.filter(
    (key) => !proposal.approvals.some((a) => a.partyKey === key),
  );
  if (missing.length > 0) blockers.push(`Missing approvals: ${missing.join(", ")}`);
  if (proposal.summary.residuals.length === 0) blockers.push("No residual transfers to execute");
  return blockers;
}
