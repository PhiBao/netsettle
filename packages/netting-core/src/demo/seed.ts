/** Print the canonical demo dataset summary. Used for pitch rehearsal, not tests. */
import { ingestCsv } from "../ingest.js";
import { formatMinor } from "../money.js";
import { findCycle, summarizeNetting } from "../netting.js";

const csv = `debtor,creditor,amount,currency,due_date,reference,memo
Acme DE,Acme FR,100000,USD,2026-10-31,INV-001,Goods
Acme FR,Acme SG,80000,USD,2026-10-31,INV-002,Services
Acme SG,Acme DE,60000,USD,2026-10-31,INV-003,Goods
`;

const { obligations, issues } = ingestCsv(csv);
if (issues.length > 0) {
  console.error(JSON.stringify(issues, null, 2));
  process.exit(1);
}
const summary = summarizeNetting(obligations);
console.log(`Gross obligations: ${formatMinor(summary.grossMinor, "USD")} across ${summary.obligationCount} invoices`);
console.log(`Net settlement:    ${formatMinor(summary.netMovedMinor, "USD")} across ${summary.residualCount} transfers`);
console.log(`Cycle: ${(findCycle(obligations) ?? []).join(" -> ")}`);
for (const r of summary.residuals) {
  console.log(`  ${r.from} -> ${r.to}: ${formatMinor(r.amountMinor, r.currency)}`);
}
