import { NextResponse } from "next/server";
import { normalizePartyKey } from "@netting/core";
import { getSessionStore, withSession } from "@/lib/store";

/**
 * Resolve one review item.
 * - party mapping (accept suggestion or supply an explicit roster value)
 * - duplicate (keep distinct / drop as duplicate)
 * - kind (accept the suggested label)
 */
export async function POST(request: Request) {
  const { id, action, value } = (await request.json()) as {
    id: string;
    action: "accept" | "map" | "keep" | "drop";
    value?: string;
  };
  const session = await getSessionStore();
  const store = session.store;
  const review = store.reviews.find((r) => r.id === id);
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  const obligation = store.obligations.find((o) => o.id === review.obligationId);
  if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 });

  if (review.field === "debtor" || review.field === "creditor") {
    const mapped = action === "map" && value ? value : (review.suggestion ?? undefined);
    if (!mapped) return NextResponse.json({ error: "No mapping value" }, { status: 400 });
    if (!store.roster.includes(mapped)) {
      return NextResponse.json({ error: "Value is not on the roster" }, { status: 400 });
    }
    if (review.field === "debtor") {
      obligation.mappedDebtor = mapped;
      obligation.debtorKey = normalizePartyKey(mapped);
    } else {
      obligation.mappedCreditor = mapped;
      obligation.creditorKey = normalizePartyKey(mapped);
    }
    review.resolved = true;
    review.resolution = mapped;
  } else if (review.field === "duplicate") {
    if (action === "drop") {
      obligation.status = "rejected";
    } else {
      obligation.status = "pending";
    }
    review.resolved = true;
    review.resolution = action === "drop" ? "dropped as duplicate" : "kept as distinct";
  } else {
    if (action === "accept" && review.suggestion) obligation.kind = review.suggestion;
    review.resolved = true;
    review.resolution = obligation.kind;
  }

  const open = store.reviews.filter(
    (r) => r.obligationId === obligation.id && !r.resolved && r.field !== "kind",
  );
  if (open.length === 0 && obligation.status !== "rejected") {
    obligation.reviewRequired = false;
    if (obligation.status === "quarantined") obligation.status = "pending";
  }
  return withSession(NextResponse.json({ obligation, review }), session);
}
