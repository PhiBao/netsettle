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
    const res = await this.fetchFn(this.config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.config.clientId,
        refresh_token: this.refreshToken,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 400 && text.includes("not active")) throw new TokenRefreshExpired();
      throw new Error(`token refresh failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    if (data.refresh_token && data.refresh_token !== this.refreshToken) {
      this.refreshToken = data.refresh_token;
      await this.persist();
    }
    return this.accessToken;
  }

  private async persist(): Promise<void> {
    if (!this.config.persistPath) return;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(this.config.persistPath, this.refreshToken, { mode: 0o600 });
  }
}
