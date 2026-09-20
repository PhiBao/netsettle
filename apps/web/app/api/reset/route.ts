import { NextResponse } from "next/server";
import { getSessionStore, resetSessionStore, withSession } from "@/lib/store";

export async function POST() {
  const session = await getSessionStore();
  return withSession(NextResponse.json(resetSessionStore(session.sessionId)), session);
}
