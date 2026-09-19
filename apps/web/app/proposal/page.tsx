"use client";

import { useEffect, useState } from "react";
import { formatMinor } from "@netting/core";

interface Summary {
  currency: string;
  obligationCount: number;
  grossMinor: string;
  residualCount: number;
  netMovedMinor: string;
  residuals: Array<{ from: string; to: string; amountMinor: string; currency: string }>;
}

interface Proposal {
  id: string;
  currency: string;
  obligationIds: string[];
  summary: Summary;
  requiredApprovals: string[];
  approvals: Array<{ partyKey: string; party: string; approvedAt: string }>;
  status: string;
  ledgerCid?: string;
  receipts: Array<{
    transfer: { from: string; to: string; amountMinor: string; currency: string };
    ledgerReference: string;
  }>;
}

interface ViewData {
  party: string;
  obligations: Array<{ id: string; direction: string; counterparty: string; amountMinor: string; currency: string; status: string }>;
  receipts: Array<{ direction: string; counterparty: string; amountMinor: string; currency: string; ledgerReference: string }>;
  verification: { verified: boolean; obligations?: number; receipts?: number; reason?: string };
}

export default function ProposalPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewParty, setViewParty] = useState("");
  const [view, setView] = useState<ViewData | null>(null);

  const refresh = () =>
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        setProposals(s.proposals);
        setRoster(s.roster);
        if (!viewParty && s.roster.length) setViewParty(s.roster[0]);
      })
      .catch((e) => setError(String(e)));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const call = async (url: string, body: unknown) => {
    setBusy(true);
    setError(null);
    setBlockers(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.blockers) {
          setBlockers(data.blockers);
          return null;
        }
        throw new Error(data.message ?? data.error ?? "Request failed");
      }
      await refresh();
      return data;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const loadView = async (party: string) => {
    setViewParty(party);
    const res = await fetch(`/api/view?party=${encodeURIComponent(party)}`);
    setView(await res.json());
  };

  const proposal = proposals[proposals.length - 1];

  return (
    <main>
      <div className="steps">
        <div className="step done">1 · Ingest obligations</div>
        <div className="step done">2 · Review ambiguities</div>
        <div className="step now">3 · Propose &amp; settle</div>
      </div>
      <h1>The month, compressed.</h1>

      {!proposal && (
        <div className="card">
          <p className="lede">No proposal yet. Commit the eligible obligations to the ledger as a netting proposal.</p>
          <button className="btn primary" disabled={busy} onClick={() => call("/api/proposals", {})}>
            {busy ? "Committing…" : "Create netting proposal"}
          </button>
        </div>
      )}

      {proposal && (
        <>
          <div className="grid2">
            <div className="card">
              <div className="muted small">GROSS OBLIGATIONS · {proposal.summary.obligationCount} invoices</div>
              <div className="hero-num small">
                {formatMinor(proposal.summary.grossMinor, proposal.currency).replace(/ [A-Z]{3}$/, "")}{" "}
                <span className="cur">{proposal.currency}</span>
              </div>
            </div>
            <div className="card">
              <div className="muted small">NET SETTLEMENT · {proposal.summary.residualCount} transfers</div>
              <div className="hero-num savings">
                {formatMinor(proposal.summary.netMovedMinor, proposal.currency).replace(/ [A-Z]{3}$/, "")}{" "}
                <span className="cur">{proposal.currency}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <span className="tag">{proposal.id}</span>
            <span className={`tag ${proposal.status === "settled" ? "good" : ""}`}>{proposal.status}</span>
            {proposal.ledgerCid && (
              <div style={{ marginTop: 8 }}>
                <span className="muted small">Proposal contract </span>
                <code className="cid">{proposal.ledgerCid}</code>
              </div>
            )}
            <h2 style={{ marginTop: 16 }}>Residual transfers</h2>
            <table>
              <thead>
                <tr><th>From → To</th><th style={{ textAlign: "right" }}>Amount</th></tr>
              </thead>
              <tbody>
                {proposal.summary.residuals.map((r, i) => (
                  <tr key={i}>
                    <td>{r.from} → {r.to}</td>
                    <td className="num">{formatMinor(r.amountMinor, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Subsidiary approvals</h2>
            <div className="row">
              {proposal.requiredApprovals.map((key) => {
                const approved = proposal.approvals.some((a) => a.partyKey === key);
                return (
                  <button
                    key={key}
                    className={`btn ${approved ? "" : "primary"}`}
                    disabled={busy || approved || proposal.status === "settled"}
                    onClick={() => call("/api/approve", { proposalId: proposal.id, partyKey: key })}
                  >
                    {approved ? `✓ ${key}` : `Approve as ${key}`}
                  </button>
                );
              })}
            </div>
            <p className="muted small">
              Each approval is its own ledger contract, signed by that subsidiary alone.
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn primary"
                disabled={busy || proposal.status === "settled"}
                onClick={() => call("/api/settle", { proposalId: proposal.id })}
              >
                {busy ? "Settling…" : "Execute atomic settlement"}
              </button>
            </div>
            {blockers && (
              <div className="err">
                <strong>Settlement refused — ledger untouched.</strong>
                <ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            )}
            {proposal.status === "settled" && (
              <div className="ok-box">
                Settled atomically. {proposal.receipts.length} receipts issued; obligations archived.
                <ul>
                  {proposal.receipts.map((r) => (
                    <li key={r.ledgerReference}>
                      {r.transfer.from} → {r.transfer.to}:{" "}
                      {formatMinor(r.transfer.amountMinor, r.transfer.currency)}{" "}
                      <code className="cid">{r.ledgerReference.slice(0, 24)}…</code>
                    </li>
                  ))}
                </ul>
                <div className="row" style={{ marginTop: 12 }}>
                  <a className="btn primary" href={`/api/payment-file?proposalId=${proposal.id}`} style={{ textDecoration: "none" }}>
                    Download payment file (CSV)
                  </a>
                </div>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  Take this file to the bank: one row per residual transfer, each
                  referencing its ledger receipt contract. The atomic Canton
                  transaction decided the netting outcome — this file carries that
                  decision into the existing banking rail.
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Privacy check — see what each subsidiary sees</h2>
            <div className="row">
              <select value={viewParty} onChange={(e) => loadView(e.target.value)} style={{ maxWidth: 240 }}>
                {roster.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button className="btn" onClick={() => viewParty && loadView(viewParty)}>Load view</button>
            </div>
            {view && (
              <div style={{ marginTop: 12 }}>
                <p>
                  <strong>{view.party}</strong> sees {view.obligations.length} obligation legs and{" "}
                  {view.receipts.length} receipts.{" "}
                  {view.verification.verified ? (
                    <span className="tag good">
                      ledger-verified: {view.verification.obligations} obligations · {view.verification.receipts} receipts visible
                    </span>
                  ) : (
                    <span className="tag bad">ledger verification unavailable</span>
                  )}
                </p>
                <table>
                  <thead><tr><th>Leg</th><th>Counterparty</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
                  <tbody>
                    {view.obligations.map((o) => (
                      <tr key={o.id}>
                        <td className="muted small">{o.direction}</td>
                        <td>{o.counterparty}</td>
                        <td className="num">{formatMinor(o.amountMinor, o.currency)}</td>
                      </tr>
                    ))}
                    {view.receipts.map((r, i) => (
                      <tr key={`r${i}`}>
                        <td><span className="tag good">{r.direction}</span></td>
                        <td>{r.counterparty}</td>
                        <td className="num">{formatMinor(r.amountMinor, r.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {error && <div className="err">{error}</div>}
    </main>
  );
}
