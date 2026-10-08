import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/store";

/**
 * Rate-limit anonymous session creation (A1).
 *
 * Sessions are minted for any cookieless request and the table holds 100
 * entries, so ~100 cookieless GETs evict every victim's in-memory state. This
 * middleware caps *new* sessions per IP in a sliding 60s window; requests that
 * already carry a session cookie pass through untouched. It does not
 * authenticate anyone — the demo stays public — it just makes mass eviction
 * noisy and slow instead of one burst.
 */
const WINDOW_MS = 60_000;
const MAX_NEW_SESSIONS_PER_WINDOW = 30;
const buckets = new Map<string, { start: number; count: number }>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next();
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const ip = clientIp(request);
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return NextResponse.next();
  }
  bucket.count += 1;
  if (bucket.count > MAX_NEW_SESSIONS_PER_WINDOW) {
    return NextResponse.json({ error: "Too many new sessions — retry shortly." }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

// The rate-limit table lives in module memory and this file imports the
// session-cookie name from lib/store, which pulls Node APIs — so this
// middleware must run on the Node runtime, not the Edge runtime.
export const runtime = "nodejs";
