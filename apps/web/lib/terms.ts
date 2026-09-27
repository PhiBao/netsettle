import { createHash } from "node:crypto";
import { canonicalProposalTerms, type ProposalTerms } from "@netting/core";

/**
 * Content hash of a proposal's terms. Sent to the ledger with the proposal and
 * again with every approval; `Execute` refuses to run when the two disagree.
 * This is what makes an approval bind to the terms an approver actually saw,
 * instead of to a mutable proposal id.
 */
export function proposalTermsHash(terms: ProposalTerms): string {
  return createHash("sha256").update(canonicalProposalTerms(terms)).digest("hex");
}
