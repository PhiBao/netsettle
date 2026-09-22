import { CantonGateway } from "@netting/canton-gateway";

export class LedgerNotConfiguredError extends Error {
  constructor() {
    super(
      "Ledger not configured. Set CANTON_JSON_API_URL, CANTON_PACKAGE_ID, CANTON_OPERATOR_PARTY and CANTON_PARTY_MAP_JSON.",
    );
    this.name = "LedgerNotConfiguredError";
  }
}

export interface LedgerConfig {
  gateway: CantonGateway;
  operatorParty: string;
  /** Roster display name -> ledger party id. */
  partyMap: Record<string, string>;
}

let cached: LedgerConfig | null = null;

export function getLedger(): LedgerConfig {
  if (cached) return cached;
  const baseUrl = process.env.CANTON_JSON_API_URL;
  const packageId = process.env.CANTON_PACKAGE_ID;
  const operatorParty = process.env.CANTON_OPERATOR_PARTY;
  const partyMapRaw = process.env.CANTON_PARTY_MAP_JSON;
  if (!baseUrl || !packageId || !operatorParty || !partyMapRaw) {
    throw new LedgerNotConfiguredError();
  }
  let partyMap: Record<string, string>;
  try {
    partyMap = JSON.parse(partyMapRaw) as Record<string, string>;
  } catch {
    throw new LedgerNotConfiguredError();
  }
  cached = {
    gateway: new CantonGateway({
      baseUrl,
      packageId,
      userId: process.env.CANTON_USER_ID ?? "netting-app",
      authToken: process.env.CANTON_API_TOKEN || undefined,
    }),
    operatorParty,
    partyMap,
  };
  return cached;
}

export function partyIdFor(rosterName: string): string {
  const { partyMap } = getLedger();
  const partyId = partyMap[rosterName];
  if (!partyId) throw new Error(`No ledger party mapped for roster name ${JSON.stringify(rosterName)}`);
  return partyId;
}

export function ledgerStatus(): { configured: boolean; packageId?: string; operatorParty?: string; parties?: number } {
  try {
    const ledger = getLedger();
    return {
      configured: true,
      packageId: ledger.gateway.packageId,
      operatorParty: ledger.operatorParty,
      parties: Object.keys(ledger.partyMap).length,
    };
  } catch {
    return { configured: false };
  }
}
