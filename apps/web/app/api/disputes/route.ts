import { NextResponse } from "next/server";
import { getSessionStore, withSession } from "@/lib/store";

/**
 * Subsidiary dispute workflow (mirrors the enterprise netting checklist:
 * invoice-level discussion before the cycle commits).
 * - raise: flags an obligation with a note; excluded from proposals until cleared.
 * - clear: removes the flag; eligibility recomputed from remaining state.
 */
export async function POST(request: Request) {
  const { obligationId, action, note } = (await request.json()) as {
    obligationId: string;
    action: "raise" | "clear";
    note?: string;
  };
  const session = await getSessionStore();
  const store = session.store;
  const obligation = store.obligations.find((o) => o.id === obligationId);
  if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 });
  if (obligation.status !== "pending") {
    return NextResponse.json(
      { error: `Only pending obligations can be disputed (status: ${obligation.status})` },
      { status: 409 },
    );
  }
  if (action === "raise") {
    if (!note?.trim()) return NextResponse.json({ error: "A dispute note is required" }, { status: 400 });
    obligation.disputeNote = note.trim().slice(0, 280);
    obligation.disputeRaisedAt = new Date().toISOString();
  } else {
    delete obligation.disputeNote;
    delete obligation.disputeRaisedAt;
  }
  return withSession(NextResponse.json({ obligation }), session);
}
