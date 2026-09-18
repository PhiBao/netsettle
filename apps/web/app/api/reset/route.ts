import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";

export async function POST() {
  return NextResponse.json(resetStore());
}
