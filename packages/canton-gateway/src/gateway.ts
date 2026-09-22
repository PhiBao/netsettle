/**
 * Minimal typed client for the Canton JSON Ledger API (v2), scoped to exactly
 * what intercompany netting needs: create obligation / proposal / approval,
 * exercise Execute, and template-filtered active-contract reads per party.
 *
 * No floats, no invented values: amounts cross the wire as integer strings,
 * Daml tuples as {_1,_2,_3} objects. Every ledger write returns the resulting
 * contract IDs parsed from the returned transaction.
 */

export type TokenProvider = () => Promise<string>;

export interface GatewayConfig {
  baseUrl: string;
  packageId: string;
  userId: string;
  /**
   * Bearer token for authenticated participants (e.g. shared DevNet), or a
   * provider for auto-refreshing tokens. Static strings suit short sessions;
   * providers suit long-lived deployments backed by a refresh token.
   */
  authToken?: string | TokenProvider;
}

export interface ObligationArgs {
  operator: string;
  debtor: string;
  creditor: string;
  amountMinor: string;
  currency: string;
  dueDate: string;
  reference: string;
}

export interface ProposalArgs {
  operator: string;
  proposalId: string;
  currency: string;
  obligationCids: string[];
  residuals: Array<{ from: string; to: string; amountMinor: string }>;
  requiredApprovers: string[];
  expiresAt: string;
}

export interface ApprovalArgs {
  operator: string;
  approver: string;
  proposalId: string;
}

export interface ReceiptRecord {
  contractId: string;
  from: string;
  to: string;
  amountMinor: string;
  currency: string;
}

type Json = Record<string, unknown>;

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

let commandCounter = 0;

export function templateId(packageId: string, module: string, name: string): string {
  return `${packageId}:${module}:${name}`;
}

/** Extract created contract IDs for one template from a submitted transaction. */
export function createdContractIds(transaction: unknown, templateSuffix: string): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const record = node as Json;
    const created = (record.createdEvent ?? record.CreatedEvent) as Json | undefined;
    if (created && typeof created.templateId === "string" && created.templateId.endsWith(templateSuffix)) {
      if (typeof created.contractId === "string") out.push(created.contractId);
    }
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
    }
  };
  walk(transaction);
  return [...new Set(out)];
}

export class CantonGateway {
  constructor(private readonly config: GatewayConfig) {}

  get packageId(): string {
    return this.config.packageId;
  }

  private template(module: string, name: string): string {
    return templateId(this.config.packageId, module, name);
  }

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token =
      typeof this.config.authToken === "function"
        ? await this.config.authToken()
        : this.config.authToken;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}${path}`, { headers: await this.headers() });
    } catch (err) {
      throw new GatewayError(`unreachable: ${String(err)}`, path, 0);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new GatewayError(`${path} failed: ${text.slice(0, 500)}`, path, res.status);
    }
    return (await res.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: await this.headers(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new GatewayError(`unreachable: ${String(err)}`, path, 0);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new GatewayError(`${path} failed: ${text.slice(0, 500)}`, path, res.status);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  private async submit(actAs: string[], commands: unknown[]): Promise<Json> {
    commandCounter += 1;
    const response = await this.post<{ transaction: Json }>(
      "/v2/commands/submit-and-wait-for-transaction",
      {
        commands: {
          actAs,
          userId: this.config.userId,
          commandId: `netting-${Date.now()}-${commandCounter}`,
          commands,
        },
      },
    );
    return response.transaction;
  }

  async createObligation(args: ObligationArgs): Promise<string> {
    const tx = await this.submit([args.operator, args.debtor], [
      {
        CreateCommand: {
          templateId: this.template("Netting", "Obligation"),
          createArguments: { ...args },
        },
      },
    ]);
    const [cid] = createdContractIds(tx, ":Obligation");
    if (!cid) throw new GatewayError("Obligation creation returned no contract", "submit", 200);
    return cid;
  }

  async createProposal(args: ProposalArgs): Promise<string> {
    const tx = await this.submit([args.operator], [
      {
        CreateCommand: {
          templateId: this.template("Netting", "NettingProposal"),
          createArguments: {
            ...args,
            residuals: args.residuals.map((r) => ({ _1: r.from, _2: r.to, _3: r.amountMinor })),
          },
        },
      },
    ]);
    const [cid] = createdContractIds(tx, ":NettingProposal");
    if (!cid) throw new GatewayError("Proposal creation returned no contract", "submit", 200);
    return cid;
  }

  async createApproval(args: ApprovalArgs): Promise<string> {
    const tx = await this.submit([args.approver], [
      {
        CreateCommand: {
          templateId: this.template("Netting", "Approval"),
          createArguments: { ...args },
        },
      },
    ]);
    const [cid] = createdContractIds(tx, ":Approval");
    if (!cid) throw new GatewayError("Approval creation returned no contract", "submit", 200);
    return cid;
  }

  async executeProposal(
    operator: string,
    proposalCid: string,
    approvalCids: string[],
  ): Promise<string[]> {
    const tx = await this.submit([operator], [
      {
        ExerciseCommand: {
          templateId: this.template("Netting", "NettingProposal"),
          contractId: proposalCid,
          choice: "Execute",
          choiceArgument: { approvalCids },
        },
      },
    ]);
    return createdContractIds(tx, ":SettlementReceipt");
  }

  async activeContracts(
    party: string,
    templateName: "Obligation" | "Approval" | "NettingProposal" | "SettlementReceipt",
  ): Promise<Array<{ contractId: string; payload: Json }>> {
    const end = await this.get<{ offset: number }>("/v2/state/ledger-end");
    // Wildcard read filtered client-side by template suffix: package ids change
    // on every DAR rebuild, while `:Netting:<Template>` suffixes are stable.
    // (Server-side TemplateFilter requires package-name references, which the
    // sandbox rejects for freshly uploaded DARs.)
    const suffix = `:Netting:${templateName}`;
    const response = await this.post<unknown>("/v2/state/active-contracts", {
      activeAtOffset: end.offset,
      eventFormat: {
        filtersByParty: {
          [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: {} } } }] },
        },
      },
    });
    if (!Array.isArray(response)) return [];
    const out: Array<{ contractId: string; payload: Json }> = [];
    const createdOf = (entry: Json): Json | undefined => {
      const nested = (entry.JsActiveContract ?? entry.jsActiveContract) as Json | undefined;
      const created = ((nested ?? entry).createdEvent ?? (nested ?? entry).CreatedEvent) as
        | Json
        | undefined;
      return created;
    };
    for (const page of response) {
      const record = page as Json;
      const entries = (record.contractEntries as Json[] | undefined) ?? [];
      if (record.contractEntry && typeof record.contractEntry === "object") {
        entries.push(record.contractEntry as Json);
      }
      for (const entry of entries) {
        const created = createdOf(entry);
        if (
          created &&
          typeof created.contractId === "string" &&
          typeof created.templateId === "string" &&
          created.templateId.endsWith(suffix)
        ) {
          out.push({ contractId: created.contractId, payload: (created.createArgument ?? {}) as Json });
        }
      }
    }
    return out;
  }

  async readReceipts(operator: string): Promise<ReceiptRecord[]> {
    const contracts = await this.activeContracts(operator, "SettlementReceipt");
    return contracts.map((c) => ({
      contractId: c.contractId,
      from: String(c.payload.from ?? ""),
      to: String(c.payload.to ?? ""),
      amountMinor: String(c.payload.amountMinor ?? "0"),
      currency: String(c.payload.currency ?? ""),
    }));
  }
}
