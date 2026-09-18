import type {
  NettingProposal,
  Obligation,
  SettlementReceipt,
} from "@netting/core";

/**
 * Demo store: single-tenant, in-memory.
 * A production deployment would persist this per workspace in a database;
 * for the hackathon demo the ledger is the system of record and this store
 * is a read-through cache of what the operator submitted.
 */
export interface StoredObligation extends Obligation {
  ledgerCid?: string;
  mappedDebtor?: string;
  mappedCreditor?: string;
}

export interface StoredProposal extends NettingProposal {
  ledgerCid?: string;
  ledgerApprovalCids: string[];
  receipts: SettlementReceipt[];
}

export interface ReviewItem {
  id: string;
  obligationId: string;
  field: "debtor" | "creditor" | "duplicate" | "kind";
  raw: string;
  suggestion: string | null;
  confidence: number;
  source: "exact" | "typesafe" | "fallback";
  resolved: boolean;
  resolution?: string;
}

export interface DemoStore {
  roster: string[];
  obligations: StoredObligation[];
  proposals: StoredProposal[];
  reviews: ReviewItem[];
  ingestIssues: Array<{ row: number; field?: string; code: string; message: string }>;
  batchPriority: { score: number; confidence: number; source: string } | null;
}

const freshStore = (): DemoStore => ({
  roster: [],
  obligations: [],
  proposals: [],
  reviews: [],
  ingestIssues: [],
  batchPriority: null,
});

declare global {
  // eslint-disable-next-line no-var
  var __nettingStore: DemoStore | undefined;
}

export function getStore(): DemoStore {
  if (!globalThis.__nettingStore) globalThis.__nettingStore = freshStore();
  return globalThis.__nettingStore;
}

export function resetStore(): DemoStore {
  globalThis.__nettingStore = freshStore();
  return globalThis.__nettingStore;
}
