import { NextResponse } from "next/server";
import { ingestCsv, normalizePartyKey, resetObligationCounter, resetProposalCounter } from "@netting/core";
import {
  classifyKind,
  createLiveAsk,
  duplicateProbability,
  normalizeParty,
  reviewPriority,
  type AskFn,
} from "@netting/typesafe-judgments";
import { ledgerStatus } from "@/lib/ledger";
import { DEMO_CSV, DEMO_ROSTER } from "@/lib/seed";
import { getStore, resetStore, type ReviewItem } from "@/lib/store";

function getAsk(): AskFn | undefined {
  if (!process.env.TYPESAFE_API_KEY) return undefined;
  try {
    return createLiveAsk();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    csv?: string;
    demo?: boolean;
    roster?: string[];
  };
  const store = resetStore();
  resetObligationCounter();
  resetProposalCounter();
  store.roster = body.roster?.length ? body.roster : DEMO_ROSTER;
  const csv = body.demo || !body.csv ? DEMO_CSV : body.csv;

  const { obligations, issues } = ingestCsv(csv);
  store.ingestIssues = issues;
  const ask = getAsk();

  const partyCache = new Map<string, Awaited<ReturnType<typeof normalizeParty>>>();
  const judgeParty = async (raw: string) => {
    const cached = partyCache.get(raw);
    if (cached) return cached;
    const result = await normalizeParty(raw, store.roster, ask);
    partyCache.set(raw, result);
    return result;
  };

  let reviewCounter = 0;
  const addReview = (item: Omit<ReviewItem, "id" | "resolved">) => {
    reviewCounter += 1;
    store.reviews.push({ ...item, id: `REV-${String(reviewCounter).padStart(3, "0")}`, resolved: false });
  };

  for (const obligation of obligations) {
    const stored: import("@/lib/store").StoredObligation = { ...obligation };
    const debtorJudgment = await judgeParty(stored.debtor);
    const creditorJudgment = await judgeParty(stored.creditor);
    if (debtorJudgment.value) {
      stored.mappedDebtor = debtorJudgment.value;
    } else {
      stored.reviewRequired = true;
    }
    if (creditorJudgment.value) {
      stored.mappedCreditor = creditorJudgment.value;
    } else {
      stored.reviewRequired = true;
    }
    for (const [field, judgment, raw] of [
      ["debtor", debtorJudgment, stored.debtor],
      ["creditor", creditorJudgment, stored.creditor],
    ] as const) {
      if (judgment.reviewRequired || !judgment.value) {
        addReview({
          obligationId: stored.id,
          field,
          raw,
          suggestion: judgment.value,
          confidence: judgment.confidence,
          source: judgment.source,
        });
        stored.reviewRequired = true;
      }
    }
    if (stored.memo) {
      const kind = await classifyKind(stored.memo, ask);
      stored.kind = kind.value;
      if (kind.reviewRequired) {
        addReview({
          obligationId: stored.id,
          field: "kind",
          raw: stored.memo,
          suggestion: kind.value,
          confidence: kind.confidence,
          source: kind.source,
        });
      }
    }
    if (
      stored.status === "quarantined" ||
      stored.reviewReasons.some((reason) => /uplicate|ifferent reference/.test(reason))
    ) {
      const twin = obligations.find(
        (o) =>
          o.id !== stored.id &&
          o.debtorKey === stored.debtorKey &&
          o.creditorKey === stored.creditorKey &&
          o.amountMinor === stored.amountMinor &&
          o.currency === stored.currency &&
          o.dueDate === stored.dueDate,
      );
      let probability = 0.99;
      let source: ReviewItem["source"] = "fallback";
      if (twin && ask) {
        const judgment = await duplicateProbability(
          {
            debtorKey: stored.debtorKey,
            creditorKey: stored.creditorKey,
            amountMinor: stored.amountMinor,
            currency: stored.currency,
            dueDate: stored.dueDate,
            reference: stored.reference,
          },
          {
            debtorKey: twin.debtorKey,
            creditorKey: twin.creditorKey,
            amountMinor: twin.amountMinor,
            currency: twin.currency,
            dueDate: twin.dueDate,
            reference: twin.reference,
          },
          ask,
        );
        probability = judgment.value;
        source = "typesafe";
      }
      addReview({
        obligationId: stored.id,
        field: "duplicate",
        raw: stored.reference ?? `${stored.debtor} -> ${stored.creditor} ${stored.amountMinor}`,
        suggestion: probability >= 0.5 ? "drop as duplicate" : "keep as distinct",
        confidence: probability >= 0.5 ? probability : 1 - probability,
        source,
      });
      stored.reviewRequired = true;
    }
    // Effective netting keys follow the resolved roster mapping.
    if (stored.mappedDebtor) stored.debtorKey = normalizePartyKey(stored.mappedDebtor);
    if (stored.mappedCreditor) stored.creditorKey = normalizePartyKey(stored.mappedCreditor);
    store.obligations.push(stored);
  }

  const priority = await reviewPriority(
    {
      kinds: [...new Set(store.obligations.map((o) => o.kind ?? "other"))],
      quarantined: store.obligations.filter((o) => o.status === "quarantined").length,
      lowConfidenceParties: store.reviews.filter((r) => r.field !== "kind" && !r.resolved).length,
      total: store.obligations.length,
    },
    ask,
  );
  store.batchPriority = { score: priority.value, confidence: priority.confidence, source: priority.source };

  return NextResponse.json({ ...store, ledger: ledgerStatus() });
}
