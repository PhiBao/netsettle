import type {
  NetPosition,
  NettingSummary,
  Obligation,
  ResidualTransfer,
} from "./types.js";

function displayName(obligations: Obligation[], key: string): string {
  const found = obligations.find(
    (o) => o.debtorKey === key || o.creditorKey === key,
  );
  return found
    ? found.debtorKey === key
      ? found.debtor
      : found.creditor
    : key;
}

export function computeNetPositions(obligations: Obligation[]): NetPosition[] {
  if (obligations.length === 0) return [];
  const currency = obligations[0].currency;
  if (!obligations.every((o) => o.currency === currency)) {
    throw new Error("Netting scope must be a single currency");
  }
  const nets = new Map<string, bigint>();
  for (const o of obligations) {
    const amount = BigInt(o.amountMinor);
    nets.set(o.creditorKey, (nets.get(o.creditorKey) ?? 0n) + amount);
    nets.set(o.debtorKey, (nets.get(o.debtorKey) ?? 0n) - amount);
  }
  const positions: NetPosition[] = [...nets.entries()].map(([partyKey, net]) => ({
    party: displayName(obligations, partyKey),
    partyKey,
    netMinor: net.toString(),
  }));
  positions.sort((a, b) => (BigInt(a.netMinor) < BigInt(b.netMinor) ? -1 : 1));
  const checksum = positions.reduce((sum, p) => sum + BigInt(p.netMinor), 0n);
  if (checksum !== 0n) throw new Error("Net positions do not conserve value");
  return positions;
}

/** Greedy debtor-to-creditor matching. Minimal transfer count is not guaranteed; correctness is. */
export function computeResiduals(
  obligations: Obligation[],
  currency: string,
): ResidualTransfer[] {
  const positions = computeNetPositions(obligations);
  const debtors = positions
    .filter((p) => BigInt(p.netMinor) < 0n)
    .map((p) => ({ ...p, remaining: -BigInt(p.netMinor) }));
  const creditors = positions
    .filter((p) => BigInt(p.netMinor) > 0n)
    .map((p) => ({ ...p, remaining: BigInt(p.netMinor) }));
  const residuals: ResidualTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = debtors[i].remaining < creditors[j].remaining
      ? debtors[i].remaining
      : creditors[j].remaining;
    residuals.push({
      from: debtors[i].party,
      fromKey: debtors[i].partyKey,
      to: creditors[j].party,
      toKey: creditors[j].partyKey,
      amountMinor: payment.toString(),
      currency,
    });
    debtors[i].remaining -= payment;
    creditors[j].remaining -= payment;
    if (debtors[i].remaining === 0n) i++;
    if (creditors[j].remaining === 0n) j++;
  }
  return residuals;
}

export function summarizeNetting(obligations: Obligation[]): NettingSummary {
  if (obligations.length === 0) throw new Error("Nothing to net");
  const currency = obligations[0].currency;
  const positions = computeNetPositions(obligations);
  const residuals = computeResiduals(obligations, currency);
  const gross = obligations.reduce((sum, o) => sum + BigInt(o.amountMinor), 0n);
  const moved = residuals.reduce((sum, r) => sum + BigInt(r.amountMinor), 0n);
  return {
    currency,
    obligationCount: obligations.length,
    grossMinor: gross.toString(),
    residualCount: residuals.length,
    netMovedMinor: moved.toString(),
    positions,
    residuals,
  };
}

/** Find one simple cycle for visualization/explanation. Returns party keys or null. */
export function findCycle(obligations: Obligation[]): string[] | null {
  const edges = new Map<string, string[]>();
  for (const o of obligations) {
    if (!edges.has(o.debtorKey)) edges.set(o.debtorKey, []);
    edges.get(o.debtorKey)!.push(o.creditorKey);
  }
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  let found: string[] | null = null;
  const visit = (node: string): void => {
    if (found) return;
    visited.add(node);
    stack.push(node);
    onStack.add(node);
    for (const next of edges.get(node) ?? []) {
      if (found) return;
      if (onStack.has(next)) {
        found = [...stack.slice(stack.indexOf(next)), next];
        return;
      }
      if (!visited.has(next)) visit(next);
    }
    stack.pop();
    onStack.delete(node);
  };
  for (const node of edges.keys()) {
    if (!visited.has(node)) visit(node);
    if (found) return found;
  }
  return null;
}
