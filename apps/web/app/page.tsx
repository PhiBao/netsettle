"use client";

import { useEffect, useState } from "react";
import { DEMO_CSV } from "@/lib/seed";

interface LedgerState {
  configured: boolean;
  packageId?: string;
  parties?: number;
}

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
        setCounts({ obligations: s.obligations.length, reviews: s.reviews.filter((r: { resolved: boolean }) => !r.resolved).length });
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
    <main>
      <div className="steps">
        <div className="step now">1 · Ingest obligations</div>
        <div className="step">2 · Review ambiguities</div>
        <div className="step">3 · Propose &amp; settle</div>
      </div>
      <h1>
        Stop settling <span className="savings">circular debt</span> gross.
      </h1>
      <p className="lede">
        Subsidiaries of one group owe each other millions across entities — much of it
        circular. Upload the month&rsquo;s intercompany payables; NetSettle compresses
        offsetting cycles and settles the residual in one atomic Canton transaction.
      </p>
      <div className="row" style={{ margin: "12px 0" }}>
        <span className={`pill ${ledger.configured ? "ok" : "bad"}`}>
          {ledger.configured
            ? `Ledger connected · ${ledger.parties} parties`
            : "Ledger not configured"}
        </span>
        {counts && counts.obligations > 0 && (
          <span className="pill">
            {counts.obligations} obligations · {counts.reviews} open reviews
          </span>
        )}
      </div>
      {!ledger.configured && (
        <div className="err">
          No Canton participant configured. Set <code>CANTON_JSON_API_URL</code>,{" "}
          <code>CANTON_PACKAGE_ID</code>, <code>CANTON_OPERATOR_PARTY</code> and{" "}
          <code>CANTON_PARTY_MAP_JSON</code>, then restart. Settlement stays disabled
          rather than simulated.
        </div>
      )}
      <div className="card">
        <label>Obligations CSV — debtor, creditor, amount, currency, due_date, reference, memo</label>
        <textarea rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} spellCheck={false} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy} onClick={() => ingest(false)}>
            {busy ? "Reading…" : "Ingest CSV"}
          </button>
          <button className="btn" disabled={busy} onClick={() => ingest(true)}>
            Load demo dataset
          </button>
        </div>
        {error && <div className="err">{error}</div>}
        <p className="muted small">
          Messy counterparty names are resolved against your subsidiary roster with
          confidence-gated semantic matching; anything uncertain lands in review instead
          of silently mapping. Amounts are parsed as integer minor units — no floats,
          ever.
        </p>
      </div>
    </main>
  );
}
