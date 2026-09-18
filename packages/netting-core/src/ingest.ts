import { assertCurrencyCode, parseAmountToMinor } from "./money.js";
import { displayParty, normalizePartyKey } from "./normalize.js";
import type { IngestIssue, IngestResult, Obligation } from "./types.js";

const CANONICAL_HEADERS: Record<string, string> = {
  debtor: "debtor",
  payer: "debtor",
  from: "debtor",
  creditor: "creditor",
  payee: "creditor",
  to: "creditor",
  amount: "amount",
  currency: "currency",
  ccy: "currency",
  due_date: "dueDate",
  duedate: "dueDate",
  "due date": "dueDate",
  reference: "reference",
  ref: "reference",
  memo: "memo",
  description: "memo",
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  if (inQuotes) throw new Error("Unterminated quoted CSV field");
  return cells.map((c) => c.trim());
}

function canonicalHeader(raw: string): string | undefined {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, (m) =>
    m.includes(" ") ? " " : "_",
  );
  return CANONICAL_HEADERS[key] ?? CANONICAL_HEADERS[raw.trim().toLowerCase()];
}

let obligationCounter = 0;

/** Reset human-readable ID counters (new ingest cycle, and test isolation). */
export function resetObligationCounter(): void {
  obligationCounter = 0;
}

/** @deprecated Use resetObligationCounter. */
export function resetObligationCounterForTests(): void {
  resetObligationCounter();
}

export interface RawRow {
  debtor: string;
  creditor: string;
  amount: string;
  currency: string;
  dueDate: string;
  reference?: string;
  memo?: string;
}

export function parseCsv(text: string): { rows: Record<string, string>[]; issues: IngestIssue[] } {
  const issues: IngestIssue[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], issues };
  let header: string[];
  try {
    header = splitCsvLine(lines[0]);
  } catch (err) {
    return { rows: [], issues: [{ row: 1, code: "bad_header", message: String(err) }] };
  }
  const mapped = header.map((h) => canonicalHeader(h));
  const missing = ["debtor", "creditor", "amount", "currency", "dueDate"].filter(
    (f) => !mapped.includes(f),
  );
  if (missing.length > 0) {
    return {
      rows: [],
      issues: [
        {
          row: 1,
          code: "missing_headers",
          message: `Missing required columns: ${missing.join(", ")}`,
        },
      ],
    };
  }
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = splitCsvLine(lines[i]);
      const row: Record<string, string> = {};
      mapped.forEach((field, idx) => {
        if (field) row[field] = cells[idx] ?? "";
      });
      rows.push(row);
    } catch (err) {
      issues.push({ row: i + 1, code: "bad_row", message: String(err) });
    }
  }
  return { rows, issues };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateRow(row: Record<string, string>, rowNumber: number): {
  obligation?: Obligation;
  issues: IngestIssue[];
} {
  const issues: IngestIssue[] = [];
  const debtor = (row.debtor ?? "").trim();
  const creditor = (row.creditor ?? "").trim();
  const amount = (row.amount ?? "").trim();
  const currencyRaw = (row.currency ?? "").trim();
  const dueDate = (row.dueDate ?? "").trim();
  if (!debtor) issues.push({ row: rowNumber, field: "debtor", code: "required", message: "Debtor is required" });
  if (!creditor) issues.push({ row: rowNumber, field: "creditor", code: "required", message: "Creditor is required" });
  if (debtor && creditor && normalizePartyKey(debtor) === normalizePartyKey(creditor)) {
    issues.push({ row: rowNumber, code: "self_debt", message: "Debtor and creditor are the same party" });
  }
  let currency = "";
  try {
    currency = assertCurrencyCode(currencyRaw);
  } catch {
    issues.push({ row: rowNumber, field: "currency", code: "bad_currency", message: `Currency must be a 3-letter code, got ${JSON.stringify(currencyRaw)}` });
  }
  let amountMinor = "";
  if (!amount) {
    issues.push({ row: rowNumber, field: "amount", code: "required", message: "Amount is required" });
  } else if (currency) {
    try {
      amountMinor = parseAmountToMinor(amount, currency).toString();
    } catch (err) {
      issues.push({ row: rowNumber, field: "amount", code: "bad_amount", message: String(err) });
    }
  }
  if (!dueDate) {
    issues.push({ row: rowNumber, field: "dueDate", code: "required", message: "Due date is required" });
  } else if (!isIsoDate(dueDate)) {
    issues.push({ row: rowNumber, field: "dueDate", code: "bad_date", message: "Due date must be YYYY-MM-DD" });
  }
  if (issues.length > 0) return { issues };
  obligationCounter += 1;
  return {
    issues,
    obligation: {
      id: `OBL-${String(obligationCounter).padStart(4, "0")}`,
      debtor: displayParty(debtor),
      debtorKey: normalizePartyKey(debtor),
      creditor: displayParty(creditor),
      creditorKey: normalizePartyKey(creditor),
      amountMinor,
      currency,
      dueDate,
      reference: (row.reference ?? "").trim() || undefined,
      memo: (row.memo ?? "").trim() || undefined,
      status: "pending",
      reviewRequired: false,
      reviewReasons: [],
    },
  };
}

export function ingestCsv(text: string): IngestResult {
  const { rows, issues } = parseCsv(text);
  const obligations: Obligation[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const { obligation, issues: rowIssues } = validateRow(row, rowNumber);
    issues.push(...rowIssues);
    if (!obligation) return;
    const fingerprint = [
      obligation.debtorKey,
      obligation.creditorKey,
      obligation.amountMinor,
      obligation.currency,
      obligation.dueDate,
      (obligation.reference ?? "").toUpperCase(),
    ].join("|");
    const firstSeen = seen.get(fingerprint);
    if (firstSeen !== undefined) {
      obligation.status = "quarantined";
      obligation.reviewRequired = true;
      obligation.reviewReasons.push(`Possible duplicate of row ${firstSeen}`);
    } else {
      seen.set(fingerprint, rowNumber);
    }
    const nearKey = [
      obligation.debtorKey,
      obligation.creditorKey,
      obligation.amountMinor,
      obligation.currency,
      obligation.dueDate,
    ].join("|");
    const nearTwins = [...seen.keys()].filter(
      (k) => k.startsWith(`${nearKey}|`) && k !== fingerprint,
    ).length;
    if (obligation.status === "pending" && nearTwins >= 1) {
      obligation.reviewRequired = true;
      obligation.reviewReasons.push("Same parties/amount/date with a different reference");
    }
    obligations.push(obligation);
  });
  return { obligations, issues };
}
