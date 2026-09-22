import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TokenManager, TokenRefreshExpired } from "../tokenRefresh.js";

function stubFetch(
  handler: (body: URLSearchParams) => { status: number; json: unknown; text?: string },
): typeof fetch {
  return (async (_url: unknown, init?: { body?: unknown }) => {
    const params = new URLSearchParams(String(init?.body ?? ""));
    const { status, json, text } = handler(params);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
      text: async () => text ?? JSON.stringify(json),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("TokenManager", () => {
  it("caches the access token until near expiry", async () => {
    let calls = 0;
    const mgr = new TokenManager({
      tokenUrl: "https://x/token",
      clientId: "c",
      refreshToken: "r0",
      fetchFn: stubFetch(() => {
        calls++;
        return { status: 200, json: { access_token: "a1", expires_in: 3600 } };
      }),
    });
    assert.equal(await mgr.getToken(), "a1");
    assert.equal(await mgr.getToken(), "a1");
    assert.equal(calls, 1);
  });

  it("rotates and exposes the new refresh token", async () => {
    const mgr = new TokenManager({
      tokenUrl: "https://x/token",
      clientId: "c",
      refreshToken: "r0",
      fetchFn: stubFetch(() => ({
        status: 200,
        json: { access_token: "a2", expires_in: 3600, refresh_token: "r1" },
      })),
    });
    await mgr.getToken();
    assert.equal(mgr.currentRefreshToken(), "r1");
  });

  it("sends the refresh grant with client and token", async () => {
    let seen: URLSearchParams | undefined;
    const mgr = new TokenManager({
      tokenUrl: "https://x/token",
      clientId: "web-app-ui",
      refreshToken: "r0",
      fetchFn: stubFetch((params) => {
        seen = params;
        return { status: 200, json: { access_token: "a", expires_in: 60 } };
      }),
    });
    await mgr.getToken();
    assert.equal(seen?.get("grant_type"), "refresh_token");
    assert.equal(seen?.get("client_id"), "web-app-ui");
    assert.equal(seen?.get("refresh_token"), "r0");
  });

  it("raises TokenRefreshExpired when the grant is dead", async () => {
    const mgr = new TokenManager({
      tokenUrl: "https://x/token",
      clientId: "c",
      refreshToken: "dead",
      fetchFn: stubFetch(() => ({
        status: 400,
        json: { error: "invalid_grant" },
        text: '{"error":"invalid_grant","error_description":"Token is not active"}',
      })),
    });
    await assert.rejects(() => mgr.getToken(), TokenRefreshExpired);
  });
});
