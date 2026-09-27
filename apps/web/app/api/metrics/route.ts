import { NextResponse } from "next/server";
import { snapshot } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/**
 * Anonymous usage counters for the public demo (no PII, no identifiers).
 * Written by the ingest/propose/approve/settle/payment routes; reported in the
 * submission's Metrics asset. Derived numbers:
 *   - flowsCompleted / sessionsStarted = share of visitors who settle.
 */
export async function GET() {
  const metrics = snapshot();
  return NextResponse.json({
    ...metrics,
    derived: {
      completionRate:
        metrics.sessionsStarted > 0
          ? Math.round((metrics.flowsCompleted / metrics.sessionsStarted) * 1000) / 10
          : null,
      note: "Anonymous counters only — no session ids, IPs or payload data are stored.",
    },
  });
}
