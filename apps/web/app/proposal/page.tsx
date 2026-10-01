"use client";

import { useEffect, useState } from "react";
import { formatMinor } from "@netting/core";
import { Alert, Card, EmptyState, Kicker, PageSkeleton, Pill, Steps } from "../components/ui";

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
  termsHash?: string;
  receipts: Array<{
    transfer: { from: string; to: string; amountMinor: string; currency: string };
    ledgerReference: string;
  }>;
}

interface Verification {
  verified: boolean;
  ownReceipts: { visible: number; total: number };
  othersReceipts: { hidden: number; total: number };
  ownObligations: { visible: number; total: number };
  othersObligations: { hidden: number; total: number };
  scope: string;
  reason?: string;
}

interface ViewData {
  party: string;
  obligations: Array<{ id: string; direction: string; counterparty: string; amountMinor: string; currency: string; status: string }>;
  receipts: Array<{ direction: string; counterparty: string; amountMinor: string; currency: string; ledgerReference: string }>;
  verification: Verification;
}

const btn =
  "rounded-xl border border-line bg-panel2 px-4 py-2 text-sm font-semibold text-text transition hover:border-mint/60 disabled:opacity-45";
const btnPrimary =
  "rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-mintdeep transition hover:brightness-110 disabled:opacity-45";

/**
 * The DevNet node is shared by every team, so a transient write failure is
 * normal and says nothing about the product. Keep the message short and
 * actionable, with the raw ledger detail appended for debugging.
 */
function friendlyLedgerError(data: { error?: string; message?: string }): string {
  const detail = data.message ?? data.error ?? "Request failed";
  if (
    data.error === "ledger_write_failed" ||
    data.error === "settlement_failed" ||
    data.error === "approval_failed"
  ) {
    return `The shared DevNet node did not accept that write — nothing was changed. Retry in a few seconds.\n\nLedger detail: ${detail}`;
  }
  return detail;
}

function HeroNumber({ minor, currency, struck }: { minor: string; currency: string; struck?: boolean }) {
  const formatted = formatMinor(minor, currency);
  const match = /^(.*) ([A-Z]{3})$/.exec(formatted);
  const value = match ? match[1] : formatted;
  const cur = match ? match[2] : currency;
  return (
    <div
      className={`tnum font-mono text-[34px] font-extrabold leading-none tracking-tight sm:text-[40px] ${
        struck ? "text-faint line-through decoration-2" : "text-mint"
      }`}
    >
      {value} <span className="text-base font-semibold text-faint">{cur}</span>
    </div>
  );
}

export default function ProposalPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [obligationCount, setObligationCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [viewParty, setViewParty] = useState("");
  const [view, setView] = useState<ViewData | null>(null);

  const refresh = () =>
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        setProposals(s.proposals);
        setRoster(s.roster);
        setObligationCount(s.obligations.length);
        if (!viewParty && s.roster.length) setViewParty(s.roster[0]);
        setLoaded(true);
      })
      .catch((e) => {
        setError(String(e));
        setLoaded(true);
      });

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const call = async (url: string, body: unknown, proposalId?: string, action = "generic") => {
    setBusy(true);
    // The busy label must name the action in flight: "Settling…" while an
    // approval is being cast reads as if the settlement already happened.
    setBusyAction(action);
    setError(null);
    if (proposalId) {
      setBlockers((b) => {
        const next = { ...b };
        delete next[proposalId];
        return next;
      });
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.blockers && proposalId) {
          setBlockers((b) => ({ ...b, [proposalId]: data.blockers }));
          return null;
        }
        throw new Error(friendlyLedgerError(data));
      }
      await refresh();
      return data;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  };

  const loadView = async (party: string) => {
    setViewParty(party);
    const res = await fetch(`/api/view?party=${encodeURIComponent(party)}`);
    setView(await res.json());
  };

  return (
    <main className="pt-10">
      <Steps current={3} />
      <Kicker>Atomic commit</Kicker>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-[44px]">
        The month, compressed.
      </h1>

      {!loaded && <PageSkeleton rows={2} />}

      {loaded && proposals.length === 0 && obligationCount === 0 && (
        <EmptyState
          title="Nothing to compress yet"
          body="Proposals are built from reviewed obligations. Ingest a CSV first, clear the review queue, then come back."
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

      {loaded && proposals.length === 0 && obligationCount > 0 && (
        <Card className="mt-8">
          <p className="max-w-xl text-[15px] leading-relaxed text-mist">
            No proposals yet. Eligible obligations are grouped by currency — one
            proposal per bucket, each settling atomically on the ledger.
          </p>
          <button className={`${btnPrimary} mt-4`} disabled={busy} onClick={() => call("/api/proposals", {})}>
            {busy ? "Committing…" : "Create netting proposals"}
          </button>
        </Card>
      )}

      {proposals.map((proposal) => {
        const proposalBlockers = blockers[proposal.id];
        const settled = proposal.status === "settled";
        return (
          <section key={proposal.id} className="mt-12 first:mt-8">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-xl font-semibold">
                {proposal.id} <span className="text-faint">· {proposal.currency} bucket</span>
              </h2>
              <Pill tone={settled ? "ok" : "neutral"}>{proposal.status}</Pill>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                  Gross · {proposal.summary.obligationCount} invoices
                </div>
                <HeroNumber minor={proposal.summary.grossMinor} currency={proposal.currency} struck />
              </Card>
              <Card className="!border-mint/25">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                  Net settlement ·{" "}
                  {proposal.summary.residualCount === 0
                    ? "fully netted, no transfers"
                    : `${proposal.summary.residualCount} transfer${proposal.summary.residualCount === 1 ? "" : "s"}`}
                </div>
                <HeroNumber minor={proposal.summary.netMovedMinor} currency={proposal.currency} />
                {proposal.summary.residualCount === 0 && (
                  <p className="mt-3 text-[13px] text-mist">
                    100% of gross offsets inside the group — settlement archives the
                    obligations without moving money.
                  </p>
                )}
              </Card>
            </div>

            {(proposal.ledgerCid || proposal.termsHash) && (
              <div className="mt-4 space-y-1 text-[13px] text-faint">
                {proposal.ledgerCid && (
                  <p>
                    Proposal contract{" "}
                    <code className="break-all font-mono text-[11px] text-mist">
                      {proposal.ledgerCid}
                    </code>
                  </p>
                )}
                {proposal.termsHash && (
                  <p>
                    Terms hash{" "}
                    <code
                      className="font-mono text-[11px] text-mist"
                      title={proposal.termsHash}
                    >
                      {proposal.termsHash.slice(0, 24)}…
                    </code>{" "}
                    — every approval is bound to this hash; a rewritten proposal
                    cannot settle with approvals for the original terms.
                  </p>
                )}
              </div>
            )}
            {proposal.summary.residuals.length > 0 && (
              <Card className="mt-4">
                <h3 className="mb-3 font-display text-[15px] font-semibold">Residual transfers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-faint">
                        <th className="px-3 py-2.5 font-semibold">From → To</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.summary.residuals.map((r, i) => (
                        <tr key={i} className="border-b border-line/50 last:border-0">
                          <td className="px-3 py-2.5">
                            {r.from} <span className="text-faint">→</span> {r.to}
                          </td>
                          <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono">
                            {formatMinor(r.amountMinor, r.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {proposal.summary.residuals.length === 0 && proposal.ledgerCid && (
              <p className="mt-4 text-[13px] text-faint">
                Fully netted: no residual transfers to list. Obligations are
                archived when the proposal executes.
              </p>
            )}

            <Card className="mt-4">
              <h3 className="mb-4 font-display text-[15px] font-semibold">Subsidiary approvals</h3>
              <div className="flex flex-wrap gap-2.5">
                {proposal.requiredApprovals.map((key) => {
                  const approved = proposal.approvals.some((a) => a.partyKey === key);
                  const inFlight = busy && busyAction === `approve:${key}`;
                  return (
                    <button
                      key={key}
                      className={approved ? btn : btnPrimary}
                      disabled={busy || approved || settled}
                      onClick={() =>
                        call(
                          "/api/approve",
                          { proposalId: proposal.id, partyKey: key },
                          proposal.id,
                          `approve:${key}`,
                        )
                      }
                    >
                      {inFlight ? `Approving ${key}…` : approved ? `✓ ${key}` : `Approve as ${key}`}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[13px] text-faint">
                Each approval is its own ledger contract, signed by that subsidiary alone.
              </p>
              <div className="mt-5">
                <button
                  className={btnPrimary}
                  disabled={busy || settled}
                  onClick={() =>
                    call("/api/settle", { proposalId: proposal.id }, proposal.id, `settle:${proposal.id}`)
                  }
                >
                  {busyAction === `settle:${proposal.id}` ? "Settling…" : "Execute atomic settlement"}
                </button>
              </div>
              {proposalBlockers && (
                <Alert tone="error">
                  <strong>Settlement refused — ledger untouched.</strong>
                  <ul className="mt-1.5 list-disc pl-5">
                    {proposalBlockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {settled && proposal.receipts.length === 0 && (
                <Alert tone="success">
                  <span className="font-semibold">
                    Settled atomically — fully netted. Every position cancelled, so no
                    transfers were required; obligations are archived.
                  </span>
                  <p className="mb-0 mt-3 text-[13px] opacity-90">
                    No payment file: nothing moves through the bank. The atomic commit
                    itself is the settlement.
                  </p>
                </Alert>
              )}
              {settled && proposal.receipts.length > 0 && (
                <Alert tone="success">
                  <span className="font-semibold">
                    Settled atomically. {proposal.receipts.length}{" "}
                    {proposal.receipts.length === 1 ? "receipt" : "receipts"} issued;
                    obligations archived.
                  </span>
                  <ul className="mt-2 space-y-1.5">
                    {proposal.receipts.map((r) => (
                      <li key={r.ledgerReference} className="tnum font-mono text-[13px]">
                        {r.transfer.from} → {r.transfer.to}:{" "}
                        {formatMinor(r.transfer.amountMinor, r.transfer.currency)}{" "}
                        <code className="text-faint">{r.ledgerReference.slice(0, 24)}…</code>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <a
                      className={`${btnPrimary} no-underline`}
                      href={`/api/payment-file?proposalId=${proposal.id}`}
                    >
                      Payment file (CSV)
                    </a>
                    <a
                      className={`${btnPrimary} no-underline`}
                      href={`/api/payment-file?proposalId=${proposal.id}&format=pain001`}
                    >
                      pain.001 (ISO 20022)
                    </a>
                  </div>
                  <p className="mb-0 mt-3 text-[13px] opacity-90">
                    Take these files to the bank: one row per residual transfer, each
                    referencing its ledger receipt contract — CSV for humans, pain.001
                    for the bank upload.
                  </p>
                </Alert>
              )}
            </Card>
          </section>
        );
      })}

      {proposals.length > 0 && (
        <Card className="mt-12">
          <h2 className="font-display text-xl font-semibold">Privacy check</h2>
          <p className="mb-4 mt-1 text-sm text-mist">
            See what each subsidiary sees — verified live against the ledger.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={viewParty}
              onChange={(e) => loadView(e.target.value)}
              className="w-auto rounded-xl border border-line bg-ink px-3 py-2 font-mono text-[13px] text-text focus:border-mint/60 focus:outline-none"
            >
              {roster.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button className={btn} onClick={() => viewParty && loadView(viewParty)}>
              Load view
            </button>
            {view && (
              <Pill tone={view.verification.verified ? "ok" : "bad"}>
                {view.verification.verified
                  ? view.verification.ownReceipts.total > 0
                    ? `proven live: own receipts ${view.verification.ownReceipts.visible}/${view.verification.ownReceipts.total} readable · others' ${view.verification.othersReceipts.hidden}/${view.verification.othersReceipts.total} hidden`
                    : "no settled batch in this session yet"
                  : "ledger verification unavailable"}
              </Pill>
            )}
          </div>
          {view && (
            <p className="mt-2 text-[13px] text-faint">
              Isolation check scoped to {view.verification.scope}. The shared demo node
              carries other runs&rsquo; contracts too; raw global counts would say
              nothing about isolation, so the proof compares this batch only.
            </p>
          )}
          {view && (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-3 text-sm">
                <strong>{view.party}</strong>{" "}
                <span className="text-mist">
                  sees {view.obligations.length} obligation legs and {view.receipts.length}{" "}
                  receipts — nothing else.
                </span>
              </p>
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-faint">
                    <th className="px-3 py-2.5 font-semibold">Leg</th>
                    <th className="px-3 py-2.5 font-semibold">Counterparty</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {view.obligations.map((o) => (
                    <tr key={o.id} className="border-b border-line/50">
                      <td className="px-3 py-2.5 text-[13px] text-faint">{o.direction}</td>
                      <td className="px-3 py-2.5">{o.counterparty}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono">
                        {formatMinor(o.amountMinor, o.currency)}
                      </td>
                    </tr>
                  ))}
                  {view.receipts.map((r, i) => (
                    <tr key={`r${i}`} className="border-b border-line/50 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="rounded-md bg-mint/10 px-2 py-0.5 text-[11px] text-mint">
                          {r.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{r.counterparty}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono">
                        {formatMinor(r.amountMinor, r.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </main>
  );
}
