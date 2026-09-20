import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type {
  NettingProposal,
  Obligation,
  SettlementReceipt,
} from "@netting/core";

/**
 * Demo store: per-session, in-memory.
 *
 * Judging week means concurrent visitors on one public host. A single global
 * store lets one visitor's ingest wipe another's in-flight proposal, so each
 * browser session gets its own store keyed by a cookie. The Canton ledger is
 * shared and append-only — the source of truth — while each session keeps its
 * own read-through cache of what it submitted.
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

export const SESSION_COOKIE = "ns-session";
const MAX_SESSIONS = 100;

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
  var __nettingStores: Map<string, DemoStore> | undefined;
}

function storeMap(): Map<string, DemoStore> {
  if (!globalThis.__nettingStores) globalThis.__nettingStores = new Map();
  return globalThis.__nettingStores;
}

export interface SessionContext {
  store: DemoStore;
  sessionId: string;
  isNew: boolean;
}

export async function getSessionStore(): Promise<SessionContext> {
  const jar = await cookies();
  const map = storeMap();
  let sessionId = jar.get(SESSION_COOKIE)?.value;
  let isNew = false;
  if (!sessionId || !map.has(sessionId)) {
    sessionId = crypto.randomUUID();
    map.set(sessionId, freshStore());
    isNew = true;
    while (map.size > MAX_SESSIONS) {
      const oldest = map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }
  return { store: map.get(sessionId)!, sessionId, isNew };
}

export function resetSessionStore(sessionId: string): DemoStore {
  const store = freshStore();
  storeMap().set(sessionId, store);
  return store;
}

/** Attach the session cookie to a response for newly created sessions. */
export function withSession<T extends NextResponse>(
  response: T,
  session: SessionContext,
): T {
  if (session.isNew) {
    response.cookies.set(SESSION_COOKIE, session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}
