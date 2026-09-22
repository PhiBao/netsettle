"use client";

import { useEffect, useState } from "react";
import { formatMinor } from "@netting/core";

interface Obligation {
  id: string;
  debtor: string;
  creditor: string;
  mappedDebtor?: string;
  mappedCreditor?: string;
  amountMinor: string;
  currency: string;
  dueDate: string;
  reference?: string;
  memo?: string;
  kind?: string;
  status: string;
  reviewRequired: boolean;
  reviewReasons: string[];
  disputeNote?: string;
}

interface Review {
  id: string;
  obligationId: string;
  field: string;
  raw: string;
  suggestion: string | null;
  confidence: number;
  source: string;
  resolved: boolean;
  resolution?: string;
}

interface State {
  roster: string[];
  obligations: Obligation[];
  reviews: Review[];
  batchPriority: { score: number; confidence: number; source: string } | null;
}

export default function ReviewPage() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");

  const refresh = () =>
    fetch("/api/state")
      .then((r) => r.json())
      .then(setState)
      .catch((e) => setError(String(e)));

  useEffect(() => {
    refresh();
  }, []);

  const resolve = async (id: string, action: string, value?: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Resolve failed");
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const dispute = async (obligationId: string, action: "raise" | "clear") => {
    setBusy(obligationId);
    setError(null);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obligationId, action, note: disputeNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Dispute failed");
      setDisputing(null);
      setDisputeNote("");
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!state) return <main className="muted">Loading…</main>;
  const open = state.reviews.filter((r) => !r.resolved);
  const eligible = state.obligations.filter(
    (o) => o.status === "pending" && !o.reviewRequired && !o.disputeNote,
  );
  const disputedCount = state.obligations.filter((o) => o.disputeNote).length;

  return (
    <main>
      <div className="steps">
        <div className="step done">1 · Ingest obligations</div>
        <div className="step now">2 · Review ambiguities</div>
        <div className="step">3 · Propose &amp; settle</div>
      </div>
      <h1>Review what the machine wasn&rsquo;t sure about.</h1>
      <p className="lede">
        {state.obligations.length} obligations ingested · {open.length} open reviews ·{" "}
        {eligible.length} eligible for netting
        {disputedCount > 0 && <> · {disputedCount} disputed</>}.
      </p>
      {state.batchPriority && (
        <div className="card">
          <span className="tag">batch triage · {state.batchPriority.source}</span>{" "}
          Review score <strong>{state.batchPriority.score.toFixed(2)}</strong> / 2
          (confidence {state.batchPriority.confidence.toFixed(2)}).{" "}
          {state.batchPriority.score >= 1
            ? "A human should look before netting."
            : "Clean enough to auto-process."}
        </div>
      )}

      <h2>Obligations</h2>
      <div className="card" style={{ padding: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Debtor → Creditor</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Ref</th>
              <th>Kind</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.obligations.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.mappedDebtor ?? o.debtor} → {o.mappedCreditor ?? o.creditor}
                  {o.reviewRequired && <span className="tag warn">needs review</span>}
                  {o.status === "quarantined" && <span className="tag bad">quarantined</span>}
                  {o.status === "rejected" && <span className="tag bad">dropped</span>}
                  {o.disputeNote && <span className="tag bad" title={o.disputeNote}>disputed</span>}
                </td>
                <td className="num">{formatMinor(o.amountMinor, o.currency)}</td>
                <td className="muted small">{o.reference}</td>
                <td className="muted small">{o.kind ?? "—"}</td>
                <td className="muted small">
                  {o.disputeNote ? (
                    <span className="row">
                      <button className="btn" disabled={busy === o.id} onClick={() => dispute(o.id, "clear")}>
                        Resolve
                      </button>
                    </span>
                  ) : o.status === "pending" ? (
                    disputing === o.id ? (
                      <span className="row">
                        <input
                          value={disputeNote}
                          onChange={(e) => setDisputeNote(e.target.value)}
                          placeholder="Dispute note…"
                          style={{ maxWidth: 180 }}
                        />
                        <button className="btn danger" disabled={busy === o.id || !disputeNote.trim()} onClick={() => dispute(o.id, "raise")}>
                          Flag
                        </button>
                        <button className="btn" onClick={() => { setDisputing(null); setDisputeNote(""); }}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button className="btn" onClick={() => setDisputing(o.id)}>
                        Dispute
                      </button>
                    )
                  ) : (
                    o.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Review queue</h2>
      {open.length === 0 && <div className="ok-box">Nothing ambiguous. Proceed to proposal.</div>}
      {open.map((r) => (
        <div className="card" key={r.id}>
          <div className="row">
            <span className="tag">{r.field}</span>
            <span className="tag">{r.source}</span>
            <span className="muted small">confidence {r.confidence.toFixed(2)}</span>
          </div>
          <p>
            <code>{r.raw}</code>
            {r.suggestion && (
              <>
                {" "}→ suggested: <strong>{r.suggestion}</strong>
              </>
            )}
          </p>
          <div className="row">
            {r.field !== "duplicate" && r.suggestion && (
              <button className="btn primary" disabled={busy === r.id} onClick={() => resolve(r.id, "accept")}>
                Accept “{r.suggestion}”
              </button>
            )}
            {(r.field === "debtor" || r.field === "creditor") && (
              <select
                value=""
                disabled={busy === r.id}
                onChange={(e) => e.target.value && resolve(r.id, "map", e.target.value)}
                style={{ maxWidth: 220 }}
              >
                <option value="">Map to roster…</option>
                {state.roster.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {r.field === "duplicate" && (
              <>
                <button className="btn danger" disabled={busy === r.id} onClick={() => resolve(r.id, "drop")}>
                  Drop as duplicate
                </button>
                <button className="btn" disabled={busy === r.id} onClick={() => resolve(r.id, "keep")}>
                  Keep as distinct
                </button>
              </>
            )}
            {r.field === "kind" && (
              <button className="btn" disabled={busy === r.id} onClick={() => resolve(r.id, "accept")}>
                Accept label
              </button>
            )}
          </div>
        </div>
      ))}
      {error && <div className="err">{error}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <a className="btn primary" href="/proposal" style={{ textDecoration: "none" }}>
          Continue to proposal →
        </a>
      </div>
    </main>
  );
}
