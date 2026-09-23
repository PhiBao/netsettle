"use client";

import { useEffect, useState } from "react";
import { DEMO_CSV } from "@/lib/seed";
import { Alert, Card, Kicker, Pill, Steps } from "./components/ui";

interface LedgerState {
  configured: boolean;
  packageId?: string;
  parties?: number;
}

const inputCls =
  "w-full rounded-xl border border-line bg-ink px-3.5 py-3 font-mono text-[13px] leading-relaxed text-text placeholder:text-faint focus:border-mint/60 focus:outline-none";

export default function IngestPage() {
  const [csv, setCsv] = useState(DEMO_CSV);
  const [ledger, setLedger] = useState<LedgerState>({ configured: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ obligations: number; reviews: number } | null>(null);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        setLedger(s.ledger);
        setCounts({
          obligations: s.obligations.length,
          reviews: s.reviews.filter((r: { resolved: boolean }) => !r.resolved).length,
        });
      })
      .catch(() => {});
  }, []);

  const ingest = async (demo: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo ? { demo: true } : { csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingest failed");
      window.location.href = "/review";
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pt-10">
      <Steps current={1} />
      <Kicker>Track 1 · RWA &amp; business workflows</Kicker>
      <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-[52px]">
        Stop settling <span className="text-mint">circular debt</span> gross.
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-mist">
        Subsidiaries of one group owe each other millions across entities — much of it
        circular. Upload the month&rsquo;s intercompany payables; NetSettle compresses
        offsetting cycles and settles the residual in one atomic Canton transaction.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Pill tone={ledger.configured ? "ok" : "bad"}>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${ledger.configured ? "bg-mint" : "bg-rose"}`}
          />
          {ledger.configured
            ? `Ledger connected · ${ledger.parties} parties`
            : "Ledger not configured"}
        </Pill>
        {counts && counts.obligations > 0 && (
          <Pill>
            {counts.obligations} obligations · {counts.reviews} open reviews
          </Pill>
        )}
      </div>

      {!ledger.configured && (
        <Alert tone="error">
          No Canton participant configured. Set <code>CANTON_JSON_API_URL</code>,{" "}
          <code>CANTON_PACKAGE_ID</code>, <code>CANTON_OPERATOR_PARTY</code> and{" "}
          <code>CANTON_PARTY_MAP_JSON</code>, then restart. Settlement stays disabled
          rather than simulated.
        </Alert>
      )}

      <Card className="mt-8">
        <label className="mb-2 block text-[13px] text-mist">
          Obligations CSV —{" "}
          <span className="font-mono text-xs text-faint">
            debtor, creditor, amount, currency, due_date, reference, memo
          </span>
        </label>
        <textarea
          rows={11}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          spellCheck={false}
          className={inputCls}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            className="rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-mintdeep transition hover:brightness-110 disabled:opacity-45"
            disabled={busy}
            onClick={() => ingest(false)}
          >
            {busy ? "Reading…" : "Ingest CSV"}
          </button>
          <button
            className="rounded-xl border border-line bg-panel2 px-5 py-2.5 text-sm font-semibold text-text transition hover:border-mint/60 disabled:opacity-45"
            disabled={busy}
            onClick={() => ingest(true)}
          >
            Load demo dataset
          </button>
          <button
            className="rounded-xl border border-rose/40 px-5 py-2.5 text-sm font-semibold text-rose transition hover:bg-rose/10 disabled:opacity-45"
            disabled={busy}
            title="Wipe all local demo state and start over"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await fetch("/api/reset", { method: "POST" });
                setCounts(null);
              } catch (err) {
                setError(String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Reset demo
          </button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Messy names, resolved",
            body: "Counterparties are matched against your roster with confidence-gated semantic judgment. Anything uncertain lands in review — never silently mapped.",
          },
          {
            title: "Duplicates caught",
            body: "Exact and near-duplicate invoices are quarantined with model-judged probabilities before they can corrupt the netting math.",
          },
          {
            title: "Integer money only",
            body: "Every amount parses to integer minor units. No floats anywhere in the pipeline, ever.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-display text-[15px] font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mist">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
