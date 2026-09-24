"use client";

import { useEffect, useState } from "react";
import { formatMinor } from "@netting/core";
import { Alert, Card, EmptyState, Kicker, PageSkeleton, Pill, Steps } from "../components/ui";

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

const btn =
  "rounded-xl border border-line bg-panel2 px-4 py-2 text-sm font-semibold text-text transition hover:border-mint/60 disabled:opacity-45";
const btnPrimary =
  "rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mintdeep transition hover:brightness-110 disabled:opacity-45";
const btnDanger =
  "rounded-xl border border-rose/40 px-4 py-2 text-sm font-semibold text-rose transition hover:bg-rose/10 disabled:opacity-45";
const inputCls =
  "rounded-xl border border-line bg-ink px-3 py-2 font-mono text-[13px] text-text focus:border-mint/60 focus:outline-none";

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

  if (!state) return <PageSkeleton rows={4} />;
  const open = state.reviews.filter((r) => !r.resolved);
  const eligible = state.obligations.filter(
    (o) => o.status === "pending" && !o.reviewRequired && !o.disputeNote,
  );
  const disputedCount = state.obligations.filter((o) => o.disputeNote).length;

  return (
    <main className="pt-10">
      <Steps current={2} />
      <Kicker>Human in the loop</Kicker>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-[44px]">
        Review what the machine wasn&rsquo;t sure about.
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Pill>
          {state.obligations.length} obligations
        </Pill>
        <Pill tone={open.length > 0 ? "bad" : "ok"}>
          {open.length} open reviews
        </Pill>
        <Pill tone="ok">{eligible.length} eligible</Pill>
        {disputedCount > 0 && <Pill tone="bad">{disputedCount} disputed</Pill>}
      </div>

      {state.batchPriority && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              Batch triage · {state.batchPriority.source}
            </span>
            <span className="tnum font-mono text-lg text-text">
              {state.batchPriority.score.toFixed(2)}
              <span className="text-faint"> / 2</span>
            </span>
            <span className="text-sm text-mist">
              confidence {state.batchPriority.confidence.toFixed(2)} —{" "}
              {state.batchPriority.score >= 1
                ? "a human should look before netting."
                : "clean enough to auto-process."}
            </span>
          </div>
        </Card>
      )}

      {state.obligations.length === 0 && (
        <EmptyState
          title="No obligations yet"
          body="Ingest a CSV or load the demo dataset first — review starts where ingest leaves off."
          action={
            <a
              href="/"
              className="rounded-xl bg-mint px-6 py-3 text-sm font-semibold text-mintdeep no-underline transition hover:brightness-110"
            >
              Go to ingest →
            </a>
          }
        />
      )}

      {state.obligations.length > 0 && (
        <>
          <h2 className="mb-4 mt-12 font-display text-xl font-semibold">Obligations</h2>
      <Card className="!p-2 sm:!p-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-faint">
                <th className="px-4 py-3 font-semibold">Debtor → Creditor</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Ref</th>
                <th className="px-4 py-3 font-semibold">Kind</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {state.obligations.map((o) => (
                <tr key={o.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      {o.mappedDebtor ?? o.debtor} → {o.mappedCreditor ?? o.creditor}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {o.reviewRequired && (
                        <span className="rounded-md bg-gold/15 px-2 py-0.5 text-[11px] text-gold">
                          needs review
                        </span>
                      )}
                      {o.status === "quarantined" && (
                        <span className="rounded-md bg-rose/15 px-2 py-0.5 text-[11px] text-rose">
                          quarantined
                        </span>
                      )}
                      {o.status === "rejected" && (
                        <span className="rounded-md bg-rose/15 px-2 py-0.5 text-[11px] text-rose">
                          dropped
                        </span>
                      )}
                      {o.disputeNote && (
                        <span
                          className="rounded-md bg-rose/15 px-2 py-0.5 text-[11px] text-rose"
                          title={o.disputeNote}
                        >
                          disputed
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="tnum whitespace-nowrap px-4 py-3 text-right font-mono">
                    {formatMinor(o.amountMinor, o.currency)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mist">{o.reference}</td>
                  <td className="px-4 py-3 text-[13px] text-mist">{o.kind ?? "—"}</td>
                  <td className="px-4 py-3">
                    {o.disputeNote ? (
                      <button className={btn} disabled={busy === o.id} onClick={() => dispute(o.id, "clear")}>
                        Resolve
                      </button>
                    ) : o.status === "pending" ? (
                      disputing === o.id ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <input
                            value={disputeNote}
                            onChange={(e) => setDisputeNote(e.target.value)}
                            placeholder="Dispute note…"
                            className={`${inputCls} w-44`}
                          />
                          <button
                            className={btnDanger}
                            disabled={busy === o.id || !disputeNote.trim()}
                            onClick={() => dispute(o.id, "raise")}
                          >
                            Flag
                          </button>
                          <button
                            className={btn}
                            onClick={() => {
                              setDisputing(null);
                              setDisputeNote("");
                            }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button className={btn} onClick={() => setDisputing(o.id)}>
                          Dispute
                        </button>
                      )
                    ) : (
                      <span className="text-[13px] text-faint">{o.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mb-4 mt-12 font-display text-xl font-semibold">Review queue</h2>
      {open.length === 0 && (
        <Alert tone="success">Nothing ambiguous. Proceed to proposal.</Alert>
      )}
      <div className="grid gap-4">
        {open.map((r) => {
          const o = state.obligations.find((x) => x.id === r.obligationId);
          return (
          <Card key={r.id} className="!p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-panel px-2 py-0.5 font-mono text-[11px] text-mist">
                {r.field}
              </span>
              <span className="rounded-md bg-panel px-2 py-0.5 font-mono text-[11px] text-mist">
                {r.source}
              </span>
              <span className="tnum text-xs text-faint">
                confidence {r.confidence.toFixed(2)}
              </span>
            </div>
            {o && (
              <p className="mt-2 text-[13px] text-faint">
                On invoice{" "}
                <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-mist">
                  {o.reference ?? o.id}
                </code>{" "}
                · {o.mappedDebtor ?? o.debtor} → {o.mappedCreditor ?? o.creditor} ·{" "}
                <span className="tnum font-mono">{formatMinor(o.amountMinor, o.currency)}</span>
              </p>
            )}
            <p className="mt-2.5 text-[15px]">
              <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-[13px]">
                {r.raw}
              </code>
              {r.suggestion && (
                <>
                  {" "}→ suggested: <strong>{r.suggestion}</strong>
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {r.field !== "duplicate" && r.suggestion && (
                <button className={btnPrimary} disabled={busy === r.id} onClick={() => resolve(r.id, "accept")}>
                  Accept “{r.suggestion}”
                </button>
              )}
              {(r.field === "debtor" || r.field === "creditor") && (
                <select
                  value=""
                  disabled={busy === r.id}
                  onChange={(e) => e.target.value && resolve(r.id, "map", e.target.value)}
                  className={`${inputCls} w-auto`}
                >
                  <option value="">Map to roster…</option>
                  {state.roster.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              {r.field === "duplicate" && (
                <>
                  <button className={btnDanger} disabled={busy === r.id} onClick={() => resolve(r.id, "drop")}>
                    Drop as duplicate
                  </button>
                  <button className={btn} disabled={busy === r.id} onClick={() => resolve(r.id, "keep")}>
                    Keep as distinct
                  </button>
                </>
              )}
              {r.field === "kind" && (
                <button className={btn} disabled={busy === r.id} onClick={() => resolve(r.id, "accept")}>
                  Accept label
                </button>
              )}
            </div>
          </Card>
          );
        })}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

          <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-mint/30 bg-mint/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-[15px] font-semibold">
                {eligible.length} obligations ready
              </div>
              <div className="text-sm text-mist">
                Disputed, quarantined and unresolved rows stay out automatically.
              </div>
            </div>
            <a
              href="/proposal"
              className="rounded-xl bg-mint px-6 py-3 text-center text-sm font-semibold text-mintdeep no-underline transition hover:brightness-110"
            >
              Continue to proposal →
            </a>
          </div>
        </>
      )}
    </main>
  );
}
