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
import { getSessionStore, resetSessionStore, withSession, type ReviewItem } from "@/lib/store";
import { bump } from "@/lib/metrics";

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
  // Bound the ingest workload before parsing: the parser materializes every
  // row and the judgment fan-out scales with unique values. These caps are far
  // above any real demo file and turn a multi-GB stall into a 413.
  const MAX_CSV_CHARS = 512_000;
  const MAX_ROWS = 5_000;
  const MAX_ROSTER = 500;
  if (typeof body.csv === "string") {
    if (body.csv.length > MAX_CSV_CHARS) {
      return NextResponse.json({ error: "CSV too large (max 512KB)" }, { status: 413 });
    }
    if (body.csv.split("\n").length > MAX_ROWS + 1) {
      return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
    }
  }
  if (Array.isArray(body.roster)) {
    if (body.roster.length > MAX_ROSTER || body.roster.some((r) => typeof r !== "string" || r.length > 120)) {
      return NextResponse.json({ error: "Roster too large" }, { status: 413 });
    }
  }
  const session = await getSessionStore();
  const store = resetSessionStore(session.sessionId);
  resetObligationCounter();
  resetProposalCounter();
  store.roster = body.roster?.length ? body.roster : DEMO_ROSTER;
  const csv = body.demo || !body.csv ? DEMO_CSV : body.csv;

  const { obligations, issues } = ingestCsv(csv);
  store.ingestIssues = issues;
  const ask = getAsk();

  // One question per unique value, asked once, and every row's questions asked
  // together. A treasury operator should not wait for the judgment engine
  // row by row: the whole batch is judged in parallel, then the loop below
  // just reads settled answers.
  type PartyJudgment = Awaited<ReturnType<typeof normalizeParty>>;
  type KindJudgment = Awaited<ReturnType<typeof classifyKind>>;
  const partyCache = new Map<string, Promise<PartyJudgment>>();
  const kindCache = new Map<string, Promise<KindJudgment>>();
  const duplicateCache = new Map<string, Promise<number>>();
  const judgeParty = (raw: string) => {
    let pending = partyCache.get(raw);
    if (!pending) {
      pending = normalizeParty(raw, store.roster, ask);
      partyCache.set(raw, pending);
    }
    return pending;
  };
  const judgeKind = (memo: string) => {
    let pending = kindCache.get(memo);
    if (!pending) {
      pending = classifyKind(memo, ask);
      kindCache.set(memo, pending);
    }
    return pending;
  };

  const twinOf = (o: import("@/lib/store").StoredObligation) =>
    obligations.find(
      (t) =>
        t.id !== o.id &&
        t.debtorKey === o.debtorKey &&
        t.creditorKey === o.creditorKey &&
        t.amountMinor === o.amountMinor &&
        t.currency === o.currency &&
        t.dueDate === o.dueDate,
    );
  const needsDuplicateJudgment = (o: import("@/lib/store").StoredObligation) =>
    o.status === "quarantined" || o.reviewReasons.some((reason) => /uplicate|ifferent reference/.test(reason));
  const twinFields = (o: import("@netting/typesafe-judgments").ObligationFingerprint) => ({
    debtorKey: o.debtorKey,
    creditorKey: o.creditorKey,
    amountMinor: o.amountMinor,
    currency: o.currency,
    dueDate: o.dueDate,
    reference: o.reference,
  });

  if (ask) {
    const parties = [...new Set(obligations.flatMap((o) => [o.debtor, o.creditor]))];
    const memos = [...new Set(obligations.map((o) => o.memo).filter((m): m is string => Boolean(m)))];
    const duplicates = obligations.filter(needsDuplicateJudgment);
    await Promise.all([
      ...parties.map(judgeParty),
      ...memos.map(judgeKind),
      ...duplicates.map(async (o) => {
        const twin = twinOf(o);
        if (!twin) return;
        const key = `${o.id}:${twin.id}`;
        duplicateCache.set(
          key,
          duplicateProbability(twinFields(o), twinFields(twin), ask).then((j) => j.value),
        );
        await duplicateCache.get(key);
      }),
    ]);
  }

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
      const kind = await judgeKind(stored.memo);
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
    if (needsDuplicateJudgment(stored)) {
      const twin = twinOf(stored);
      let probability = 0.99;
      let source: ReviewItem["source"] = "fallback";
      if (twin && ask) {
        probability = await duplicateCache.get(`${stored.id}:${twin.id}`)!;
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
  bump("ingests");

  return withSession(NextResponse.json({ ...store, ledger: ledgerStatus() }), session);
}
