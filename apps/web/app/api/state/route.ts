import { NextResponse } from "next/server";
import { ledgerStatus } from "@/lib/ledger";
import { getSessionStore, withSession } from "@/lib/store";

export async function GET() {
  const session = await getSessionStore();
  return withSession(
    NextResponse.json({ ...session.store, ledger: ledgerStatus() }),
    session,
  );
}
