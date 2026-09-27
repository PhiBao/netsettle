import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Anonymous demo counters — no PII, no session identifiers, no IPs.
 *
 * The submission's Metrics asset asks for real usage numbers ("users who tried
 * the demo", "users who completed the core flow"), and during async judging
 * there is no other way to observe whether anyone ran the flow. Counters are
 * process-global, flushed to a JSON file so they survive restarts, and exposed
 * read-only at /api/metrics.
 */
export interface DemoMetrics {
  sessionsStarted: number;
  ingests: number;
  proposalsCreated: number;
  approvalsCast: number;
  settlementsExecuted: number;
  flowsCompleted: number;
  paymentFilesDownloaded: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

const FILE =
  process.env.NETSETTLE_METRICS_FILE ?? join(tmpdir(), "netsettle-metrics.json");

const empty: DemoMetrics = {
  sessionsStarted: 0,
  ingests: 0,
  proposalsCreated: 0,
  approvalsCast: 0,
  settlementsExecuted: 0,
  flowsCompleted: 0,
  paymentFilesDownloaded: 0,
  firstEventAt: null,
  lastEventAt: null,
};

declare global {
  // eslint-disable-next-line no-var
  var __netsettleMetrics: DemoMetrics | undefined;
}

function load(): DemoMetrics {
  if (globalThis.__netsettleMetrics) return globalThis.__netsettleMetrics;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<DemoMetrics>;
    globalThis.__netsettleMetrics = { ...empty, ...parsed };
  } catch {
    globalThis.__netsettleMetrics = { ...empty };
  }
  return globalThis.__netsettleMetrics;
}

export function bump(metric: keyof Omit<DemoMetrics, "firstEventAt" | "lastEventAt">, by = 1): void {
  const metrics = load();
  metrics[metric] += by;
  const now = new Date().toISOString();
  metrics.firstEventAt ??= now;
  metrics.lastEventAt = now;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(metrics));
  } catch {
    // Counting must never break a user-facing request.
  }
}

export function snapshot(): DemoMetrics {
  return { ...load() };
}
