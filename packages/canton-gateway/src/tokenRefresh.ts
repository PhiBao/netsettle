/**
 * Long-lived DevNet access via Keycloak offline refresh tokens.
 *
 * Access tokens live ~3 hours; the offline refresh token has no fixed expiry
 * (valid until revoked or unused too long). This manager holds tokens in
 * memory, refreshes pre-emptively, tracks rotation, and optionally persists
 * the latest refresh token to a file so restarts survive rotation.
 *
 * Refresh tokens are password-equivalent: server-side only, never committed,
 * never sent to browsers, never sent to the ledger (only the token endpoint).
 */

export interface RefreshConfig {
  tokenUrl: string;
  clientId: string;
  refreshToken: string;
  /** Optional path where the latest rotated refresh token is persisted. */
  persistPath?: string;
  fetchFn?: typeof fetch;
}

export class TokenRefreshExpired extends Error {
  constructor() {
    super("Refresh token is no longer active; re-authenticate with password grant");
    this.name = "TokenRefreshExpired";
  }
}

export class TokenManager {
  private accessToken = "";
  private expiresAt = 0;
  private refreshToken: string;
  private readonly fetchFn: typeof fetch;
  /** In-flight refresh shared by concurrent callers (singleflight). Without
   * this, N requests arriving past expiry each POST a refresh; on rotation the
   * losers present a stale token, get "not active", and the manager bricks. */
  private inflight: Promise<string> | null = null;

  constructor(private readonly config: RefreshConfig) {
    this.refreshToken = config.refreshToken;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  /** Current refresh token (post-rotation). Useful for persistence checks. */
  currentRefreshToken(): string {
    return this.refreshToken;
  }

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) return this.accessToken;
    if (!this.inflight) {
      this.inflight = this.refresh().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async refresh(): Promise<string> {
    // A hanging IdP must not stall every ledger route: 15s then fail loudly.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let res: Response;
    try {
      res = await this.fetchFn(this.config.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: this.config.clientId,
          refresh_token: this.refreshToken,
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("token refresh timed out after 15s");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const text = await res.text();
      if ((res.status === 400 || res.status === 401) && /not active|invalid_grant|expired/i.test(text)) {
        // Forget the dead access token so the next call retries instead of
        // serving a cached failure; the refresh token itself is dead and must
        // be re-onboarded via password grant.
        this.accessToken = "";
        throw new TokenRefreshExpired();
      }
      throw new Error(`token refresh failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    // Validate before caching: a missing/zero expires_in would turn every call
    // into a refresh storm, and a missing token would send unauthenticated
    // ledger requests that fail confusingly.
    if (!data.access_token || typeof data.access_token !== "string") {
      throw new Error("token refresh returned no access token");
    }
    if (!Number.isFinite(data.expires_in) || (data.expires_in as number) <= 0) {
      throw new Error("token refresh returned an invalid expires_in");
    }
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in as number) * 1000;
    if (data.refresh_token && data.refresh_token !== this.refreshToken) {
      this.refreshToken = data.refresh_token;
      await this.persist();
    }
    return this.accessToken;
  }

  private async persist(): Promise<void> {
    if (!this.config.persistPath) return;
    const { writeFile, chmod } = await import("node:fs/promises");
    await writeFile(this.config.persistPath, this.refreshToken, { mode: 0o600 });
    // writeFile applies `mode` only on creation: a pre-existing world-readable
    // file would keep its perms while holding a password-equivalent token.
    await chmod(this.config.persistPath, 0o600);
  }
}
