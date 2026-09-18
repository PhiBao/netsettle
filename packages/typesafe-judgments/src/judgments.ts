import { TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk";

/**
 * Semantic judgments for messy treasury input.
 *
 * Contract with the rest of the system:
 * - Code owns parsing, money math, cycle detection, approvals, settlement.
 * - TypeSafe only answers narrow semantic questions (which roster party is meant?
 *   what kind of obligation is this? is this pair a duplicate?).
 * - Every judgment carries a confidence; low confidence routes to human review.
 * - All functions degrade to a deterministic offline fallback so the demo never
 *   depends on a live model call.
 */

export interface AskFn {
  (state: unknown, questions: Record<string, unknown>): Promise<{
    answers: Record<string, any>;
  }>;
}

export interface Judgment<T> {
  value: T;
  confidence: number;
  source: "exact" | "typesafe" | "fallback";
  reviewRequired: boolean;
}

export const NONE_OF_THESE = "none_of_these";

function stripCorporateSuffix(key: string): string {
  return key
    .replace(/\b(GMBH|AG|GMBH & CO KG|KG|LTD|LIMITED|INC|INCORPORATED|CORP|CORPORATION|LLC|SARL|SAS|SA|PTY|PTE|BV|NV|AB|OY|AS|ASA|SPA|SRL|GROEP|HOLDING|HOLDINGS|GROUP)\b\.?/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function exactPartyMatch(raw: string, roster: string[]): string | null {
  const key = raw.trim().replace(/\s+/g, " ").toUpperCase();
  return roster.find((r) => r.trim().replace(/\s+/g, " ").toUpperCase() === key) ?? null;
}

export function fuzzyPartyMatch(raw: string, roster: string[]): string | null {
  const key = stripCorporateSuffix(raw.trim().toUpperCase());
  if (!key) return null;
  const hits = roster.filter((r) => stripCorporateSuffix(r.trim().toUpperCase()) === key);
  return hits.length === 1 ? hits[0] : null;
}

export async function normalizeParty(
  raw: string,
  roster: string[],
  ask?: AskFn,
): Promise<Judgment<string | null>> {
  const exact = exactPartyMatch(raw, roster);
  if (exact) return { value: exact, confidence: 1, source: "exact", reviewRequired: false };
  const fuzzy = fuzzyPartyMatch(raw, roster);
  if (fuzzy && !ask) {
    return { value: fuzzy, confidence: 0.55, source: "fallback", reviewRequired: true };
  }
  if (fuzzy && ask) {
    // Cheap deterministic hit exists; still confirm semantically when a client is available.
  }
  if (!ask) {
    return { value: fuzzy, confidence: fuzzy ? 0.55 : 0.2, source: "fallback", reviewRequired: true };
  }
  const criteria: Record<string, string | null> = {};
  for (const name of roster.slice(0, 60)) criteria[name] = `The roster subsidiary named ${name}`;
  criteria[NONE_OF_THESE] = "The text does not refer to any listed roster subsidiary";
  const response = await ask(
    { raw_party_text: raw, roster },
    { party: choice("Which roster subsidiary does `raw_party_text` refer to?", criteria) },
  );
  const answer = response.answers.party;
  if (answer.choice === NONE_OF_THESE) {
    return { value: null, confidence: answer.confidence, source: "typesafe", reviewRequired: true };
  }
  return {
    value: answer.choice,
    confidence: answer.confidence,
    source: "typesafe",
    reviewRequired: answer.confidence < 0.75,
  };
}

export type ObligationKind = "goods" | "services" | "financing" | "tax" | "other";

const KIND_KEYWORDS: Array<[ObligationKind, RegExp]> = [
  ["goods", /\b(goods|merchandise|inventory|shipment|delivery|hardware|equipment|materials?)\b/i],
  ["services", /\b(services?|consulting|support|maintenance|subscription|license|sla)\b/i],
  ["financing", /\b(loan|interest|credit|financ|dividend|capital|advance)\b/i],
  ["tax", /\b(tax|vat|gst|withholding|duty|duties)\b/i],
];

export function fallbackKind(memo: string): ObligationKind {
  for (const [kind, re] of KIND_KEYWORDS) {
    if (re.test(memo)) return kind;
  }
  return "other";
}

export async function classifyKind(
  memo: string,
  ask?: AskFn,
): Promise<Judgment<ObligationKind>> {
  if (!memo.trim()) {
    return { value: "other", confidence: 0.4, source: "fallback", reviewRequired: false };
  }
  if (!ask) {
    return { value: fallbackKind(memo), confidence: 0.55, source: "fallback", reviewRequired: false };
  }
  const response = await ask(
    { memo },
    {
      kind: choice("What kind of intercompany obligation does `memo` describe?", {
        goods: "Physical goods, inventory, shipments, equipment",
        services: "Services, consulting, support, subscriptions, licenses",
        financing: "Loans, interest, dividends, capital movements, advances",
        tax: "Tax, VAT, GST, withholding, customs duties",
        other: "None of the above or cannot be determined",
      }),
    },
  );
  const answer = response.answers.kind;
  return {
    value: answer.choice as ObligationKind,
    confidence: answer.confidence,
    source: "typesafe",
    reviewRequired: answer.confidence < 0.7,
  };
}

export interface ObligationFingerprint {
  debtorKey: string;
  creditorKey: string;
  amountMinor: string;
  currency: string;
  dueDate: string;
  reference?: string;
}

/** Deterministic duplicate signals. The model only breaks ties on near-matches. */
export function duplicateSignals(a: ObligationFingerprint, b: ObligationFingerprint): {
  exact: boolean;
  near: boolean;
} {
  const sameCore =
    a.debtorKey === b.debtorKey &&
    a.creditorKey === b.creditorKey &&
    a.amountMinor === b.amountMinor &&
    a.currency === b.currency &&
    a.dueDate === b.dueDate;
  if (!sameCore) return { exact: false, near: false };
  const ra = (a.reference ?? "").toUpperCase();
  const rb = (b.reference ?? "").toUpperCase();
  if (ra && ra === rb) return { exact: true, near: true };
  return { exact: false, near: true };
}

export async function duplicateProbability(
  a: ObligationFingerprint,
  b: ObligationFingerprint,
  ask?: AskFn,
): Promise<Judgment<number>> {
  const signals = duplicateSignals(a, b);
  if (!signals.near) return { value: 0.02, confidence: 0.95, source: "exact", reviewRequired: false };
  if (signals.exact) return { value: 0.99, confidence: 0.99, source: "exact", reviewRequired: false };
  if (!ask) return { value: 0.6, confidence: 0.5, source: "fallback", reviewRequired: true };
  const response = await ask({ row_a: a, row_b: b }, {
    same_obligation: noul(
      "Do `row_a` and `row_b` describe the same underlying intercompany obligation, where only the reference label differs?",
    ),
  });
  const p = response.answers.same_obligation.noul as number;
  return {
    value: p,
    confidence: 1 - Math.abs(p - 0.5) * 2,
    source: "typesafe",
    reviewRequired: p > 0.25 && p < 0.75,
  };
}

export async function reviewPriority(
  summary: { kinds: string[]; quarantined: number; lowConfidenceParties: number; total: number },
  ask?: AskFn,
): Promise<Judgment<number>> {
  if (!ask) {
    const scoreValue =
      summary.quarantined > 0 || summary.lowConfidenceParties > 1 ? 1.4 : 0.4;
    return { value: scoreValue, confidence: 0.5, source: "fallback", reviewRequired: scoreValue >= 1 };
  }
  const response = await ask({ batch: summary }, {
    priority: score("How urgently should a treasury operator review this ingested batch before netting?", [
      "Routine: clean data, safe to auto-process",
      "Glance: minor ambiguities, quick human check advised",
      "Block: likely duplicates or mis-mapped parties, investigate before proceeding",
    ]),
  });
  const answer = response.answers.priority;
  return {
    value: answer.score as number,
    confidence: answer.confidence,
    source: "typesafe",
    reviewRequired: (answer.score as number) >= 1,
  };
}

export function createLiveAsk(model = "jev-latest"): AskFn {
  const client = new TypeSafeClient();
  return async (state, questions) => {
    const response = await client.systemOne({
      state: state as any,
      questions: questions as any,
      model,
    } as any);
    return { answers: (response as any).answers };
  };
}
