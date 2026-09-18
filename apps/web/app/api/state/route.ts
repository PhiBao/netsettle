import { NextResponse } from "next/server";
import { ledgerStatus } from "@/lib/ledger";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ...store, ledger: ledgerStatus() });
}
