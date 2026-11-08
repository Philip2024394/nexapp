// POST /api/nex-native/security/sessions/revoke-all
//
// Phase 1.0 Security · "sign out all other sessions" · bumps
// `nex_account.sessions_invalidated_at` so the session resolver rejects
// every session issued before now, AND marks every nex_session row
// (except the current one) as revoked so the Devices page reflects the
// change immediately.
//
// Request body: {}
// Response: { ok: true, revoked_count: number, invalidated_at: ISO }
//
// Authorization: owner-scoped. The current session is identified by the
// sha256 of the current request's access token (same key the session
// resolver writes). We NEVER revoke the current session · the
// user-visible rule is "keep me signed in, log everyone else out."

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  revokeAllOtherSessionsForOwner,
  logSignInEvent,
} from "@/lib/nex-native/security-service";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";
import {
  accountRateLimitKey,
  buildRateLimitResponse,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import {
  isAuditWriteError,
  recordAuditEvent,
} from "@/lib/nex-native/security-audit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  // Owner directive 2026-11-08 · Item 4 · tighter cap (3/hour) since
  // mass invalidation is a high-impact rare operation.
  try {
    await recordIfAllowed(
      accountRateLimitKey(session.account.id),
      "session_revoke_all",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      void recordAuditEvent({
        event: "security.session_revoke_all.denied",
        outcome: "denied",
        actorAccountId: session.account.id,
        actorIdentity: `acct:${session.account.id}`,
        metadata: { reason: "rate_limited" },
      }).catch(() => undefined);
      const r = buildRateLimitResponse(e);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    throw e;
  }
  const keepSessionKey = currentSessionKey(req);

  // Owner directive 2026-11-08 Phase 2 · split attempted/completed
  // audit protocol · mass invalidation is a high-impact operation.
  // Fail-loud · we must have an audit record for the attempt BEFORE
  // mutating sessions. If the audit write fails, we return 503 and
  // the user retries · no half-state is possible.
  try {
    await recordAuditEvent({
      event: "security.session_revoke_all.attempted",
      outcome: "attempted",
      actorAccountId: session.account.id,
      actorIdentity: `acct:${session.account.id}`,
      targetType: "nex_account",
      targetId: session.account.id,
    });
  } catch (auditErr) {
    if (isAuditWriteError(auditErr)) {
      return NextResponse.json(
        { ok: false, error: "audit_unavailable" },
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    throw auditErr;
  }

  try {
    const result = await revokeAllOtherSessionsForOwner(
      session.account.id,
      keepSessionKey,
    );
    // Audit · log one "remote_sign_out" event for the aggregate action.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "remote_sign_out",
      success: true,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => {
      /* audit failure must not fail the user-visible action */
    });
    // Completion row · fail-loud. If the completion write fails after
    // the invalidation succeeded, we return an inconclusive response
    // · reconciliation picks up the orphaned attempted row.
    try {
      await recordAuditEvent({
        event: "security.session_revoke_all.completed",
        outcome: "completed",
        actorAccountId: session.account.id,
        actorIdentity: `acct:${session.account.id}`,
        targetType: "nex_account",
        targetId: session.account.id,
        metadata: { sessions_invalidated_at: result.invalidated_at },
      });
    } catch (auditErr) {
      if (isAuditWriteError(auditErr)) {
        return NextResponse.json(
          {
            ok: false,
            error: "audit_completion_failed",
            invalidated_at: result.invalidated_at,
            revoked_count: result.revoked_count,
          },
          { status: 503 },
        );
      }
      throw auditErr;
    }
    return NextResponse.json({
      ok: true,
      invalidated_at: result.invalidated_at,
      revoked_count: result.revoked_count,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    void recordAuditEvent({
      event: "security.session_revoke_all.failed",
      outcome: "failed",
      actorAccountId: session.account.id,
      actorIdentity: `acct:${session.account.id}`,
      targetType: "nex_account",
      targetId: session.account.id,
      metadata: { error_code: msg.slice(0, 200) },
    }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
