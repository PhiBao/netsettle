export type ObligationStatus =
  | "pending"
  | "proposed"
  | "settled"
  | "rejected"
  | "expired"
  | "quarantined";

export interface Obligation {
  id: string;
  debtor: string;
  debtorKey: string;
  creditor: string;
  creditorKey: string;
  /** Integer minor units, serialized as decimal string. Never a float. */
  amountMinor: string;
  currency: string;
  dueDate: string;
  reference?: string;
  memo?: string;
  kind?: string;
  status: ObligationStatus;
  reviewRequired: boolean;
  reviewReasons: string[];
}

export interface IngestIssue {
  row: number;
  field?: string;
  code: string;
  message: string;
}

export interface IngestResult {
  obligations: Obligation[];
  issues: IngestIssue[];
}

export interface NetPosition {
  party: string;
  partyKey: string;
  /** Positive = net creditor (is owed); negative = net debtor (owes). Minor units. */
  netMinor: string;
}

export interface ResidualTransfer {
  from: string;
  fromKey: string;
  to: string;
  toKey: string;
  amountMinor: string;
  currency: string;
}

export interface NettingSummary {
  currency: string;
  obligationCount: number;
  grossMinor: string;
  residualCount: number;
  netMovedMinor: string;
  positions: NetPosition[];
  residuals: ResidualTransfer[];
}

export type ProposalStatus =
  | "draft"
  | "pending_approval"
  | "ready"
  | "settled"
  | "rejected"
  | "expired";

export interface Approval {
  partyKey: string;
  party: string;
  approvedAt: string;
}

export interface NettingProposal {
  id: string;
  currency: string;
  obligationIds: string[];
  summary: NettingSummary;
  requiredApprovals: string[];
  approvals: Approval[];
  status: ProposalStatus;
  createdAt: string;
  expiresAt: string;
}

export interface SettlementReceipt {
  proposalId: string;
  transfer: ResidualTransfer;
  ledgerReference: string;
  settledAt: string;
}
