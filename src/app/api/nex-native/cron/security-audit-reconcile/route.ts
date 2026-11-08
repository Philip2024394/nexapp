// src/app/api/nex-native/cron/security-audit-reconcile/route.ts
//
// NEX Security Audit · scheduled reconciliation route.
// Owner-authorised 2026-11-08 implementation mode.
// -----------------------------------------------------------------------------
// Vercel-cron-invoked endpoint that calls reconcileUnmatchedAudits.
// Protected by a shared secret: Authorization: Bearer <NEX_CRON_SECRET>.
// Vercel's cron scheduler injects this header on each invocation (the
// secret is set in the project's env vars · never in the code).
//
// Scheduling · see vercel.json:
//   { "path": "/api/nex-native/cron/security-audit-reconcile",
//     "schedule": "*/15 * * * *" }
//
// Required environment variables
//   NEX_CRON_SECRET · shared secret the cron scheduler sends in the
//                     Authorization header. Owner provisions this in
//                     Vercel env vars · NEVER committed.
//
// Operational notes
//   · Idempotent · underlying RPC is guarded by UNIQUE(attempted_log_id)
//     on the reconciliation sidecar.
//   · Never logs sensitive user data · only the count of newly-
//     unresolved events, which is a scalar.
//   · If the RPC is not available (migration 293 not applied),
//     returns 200 with { ok: false, skipped: "function_not_available" }
//     · the cron keeps ticking · surfaces as soon as 293 lands.
//   · Operational failure (transient RPC error) returns 500 · Vercel
//     retries on its own schedule · no manual re-run needed.
//
// Recovery wiring audit · Owner-authorised 2026-11-08.
// --------------------------------------------------------------------------
// This cron route is INTENTIONALLY NOT wrapped in withIdempotencyKey or
// withRetry. The SECURITY DEFINER function
// nex_security_audit_reconcile_unmatched (migration 293) carries a
// UNIQUE(attempted_log_id) constraint on the reconciliation sidecar
// table · THAT constraint is the idempotency key. Re-invocations within
// the same window either (a) skip rows already inserted or (b) insert
// newly-unmatched rows that the previous invocation missed. Adding an
// in-memory withIdempotencyKey wrapper on top would be strictly
// redundant and could mask stale-ledger failures by caching a "0
// inserted" result past the window boundary. Vercel's cron retry
// schedule is the right outer loop here · the SQL UNIQUE is the right
// correctness primitive.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reconcileUnmatchedAudits } from "@/lib/nex-native/security-audit-reconciler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECONCILIATION_WINDOW_SECONDS = 300;

/** Owner-authorised 2026-11-08 · constant-time comparison avoids
 *  timing side-channels on the shared secret. */
function timingSafeMatches(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.NEX_CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!bearer || !timingSafeMatches(bearer, expected)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const result = await reconcileUnmatchedAudits(
    RECONCILIATION_WINDOW_SECONDS,
  );
  if (!result.ok) {
    if (result.skipped === "function_not_available") {
      return NextResponse.json(
        { ok: false, skipped: "function_not_available" },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { ok: false, skipped: result.skipped, error: result.error },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    unresolved_inserted: result.unresolvedInserted ?? 0,
    window_seconds: RECONCILIATION_WINDOW_SECONDS,
    ran_at: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
