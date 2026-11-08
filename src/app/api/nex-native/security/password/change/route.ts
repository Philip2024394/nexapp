// POST /api/nex-native/security/password/change
//
// Phase 1.0 Security · owner changes their Supabase Auth password.
// Thin bridge to Supabase: we verify the current password by attempting
// a sign-in with it (via the service-role admin-side verification),
// then call `admin.updateUserById(userId, { password })` to set the
// new one. Logs a `password_change` audit event on success + failure.
//
// Request body: { current: string, new: string }
// Response: { ok: true } on success · { ok: false, error } otherwise.
//
// Password policy (minimum): 8 chars. Supabase enforces its own
// server-side policy on top of this · we keep the client-visible rule
// identical to Supabase's default to avoid confusing error messages.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  bumpSessionsInvalidatedAtForOwner,
  logSignInEvent,
} from "@/lib/nex-native/security-service";
import {
  accountRateLimitKey,
  buildRateLimitResponse,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { readClientIp, readUserAgent } from "@/lib/nex-native/app/security-request";
import { clearAllStepUpForAccount } from "@/lib/nex-native/vault/step-up-service";
import {
  isAuditWriteError,
  recordAuditEvent,
} from "@/lib/nex-native/security-audit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  if (!session.email) {
    return NextResponse.json(
      { ok: false, error: "no_email_on_account" },
      { status: 400 },
    );
  }

  // Owner directive 2026-11-08 · Item 4 · rate-limit password change
  // per authenticated account. Called BEFORE any verify/update so
  // throttled attempts never reach Supabase. Fail-open on DB wobble
  // (see security-rate-limit.ts doctrine).
  try {
    await recordIfAllowed(
      accountRateLimitKey(session.account.id),
      "password_change",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      // Owner directive 2026-11-08 Phase 2 · audit the denial.
      // Fail-open · we do not block the 429 response on audit failure.
      void recordAuditEvent({
        event: "security.password_change.denied",
        outcome: "denied",
        actorAccountId: session.account.id,
        actorIdentity: `acct:${session.account.id}`,
        metadata: {
          reason: "rate_limited",
          // retry_after_seconds is a permitted key for ..denied events
        },
      }).catch(() => undefined);
      const r = buildRateLimitResponse(e);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    throw e;
  }
  let body: { current?: string; new?: string };
  try {
    body = (await req.json()) as { current?: string; new?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.new === "string" ? body.new : "";
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "missing_current_password" },
      { status: 400 },
    );
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "weak_password" },
      { status: 400 },
    );
  }
  if (current === next) {
    return NextResponse.json(
      { ok: false, error: "same_password" },
      { status: 400 },
    );
  }

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  // Verify the current password by attempting a sign-in. We use a fresh
  // non-persistent client so the user's live session is unaffected.
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verifyResult = await verifier.auth.signInWithPassword({
    email: session.email,
    password: current,
  });
  if (verifyResult.error || !verifyResult.data.user) {
    // Audit · failed verification.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "failure",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => undefined);
    // New audit · password change failed at the current-password check.
    void recordAuditEvent({
      event: "security.password_change.failed",
      outcome: "failed",
      actorAccountId: session.account.id,
      actorIdentity: `acct:${session.account.id}`,
      targetType: "nex_account",
      targetId: session.account.id,
      metadata: { error_code: "wrong_current_password" },
    }).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "wrong_current_password" },
      { status: 400 },
    );
  }

  // Owner directive 2026-11-08 Phase 2 · split attempted/completed
  // audit protocol for external Supabase Auth mutations. The attempted
  // row MUST be persisted BEFORE updateUserById · if the audit INSERT
  // fails (fail-loud) we abort the surrounding action and the caller
  // gets an inconclusive response. Reconciliation catches any
  // attempted-without-matching-completed case later.
  try {
    await recordAuditEvent({
      event: "security.password_change.attempted",
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

  // Set the new password via the admin API.
  const updateResult = await nexSupabaseAdmin.auth.admin.updateUserById(
    session.supabaseUserId,
    { password: next },
  );
  if (updateResult.error) {
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "failure",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => undefined);
    // Pair the attempted row with a failed row · fail-open.
    void recordAuditEvent({
      event: "security.password_change.failed",
      outcome: "failed",
      actorAccountId: session.account.id,
      actorIdentity: `acct:${session.account.id}`,
      targetType: "nex_account",
      targetId: session.account.id,
      metadata: { error_code: "admin_update_failed" },
    }).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: updateResult.error.message },
      { status: 400 },
    );
  }

  // Vault Phase A · design §G.1 password-reset lock sweep. Password
  // change is a high-risk security event; every active session for this
  // account must drop its Vault-unlock freshness (and the two step-up
  // factor timestamps) so sensitive Vault ops require re-authentication.
  // Keeps Vault envelopes / files / devices intact (per design) ·
  // password reset ≠ Vault destruction.
  await clearAllStepUpForAccount(session.account.id);

  // Owner directive 2026-11-07 · Item 2 · mass session invalidation on
  // successful password change. Writes nex_account.sessions_invalidated_at
  // = now() so every NEX session whose JWT iat is BEFORE this moment ·
  // including the current device that triggered the change · is rejected
  // by `resolveFromUser` on its next protected request. Standard
  // OWASP/NIST post-password-change hygiene · the user re-authenticates
  // with the new password on every device. Audit event below records the
  // timestamp returned for incident-response forensics.
  const invalidation = await bumpSessionsInvalidatedAtForOwner(
    session.account.id,
  );

  // Audit · successful password change. `created_at` is server-set so
  // callers that correlate this event with the invalidation timestamp
  // can do so via the account's `sessions_invalidated_at` column.
  await logSignInEvent({
    account_id: session.account.id,
    event_type: "password_change",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  // Owner directive 2026-11-08 Phase 2 · completion audit row.
  // Fail-loud · if THIS write fails after updateUserById succeeded we
  // have a half-state (password changed · completion row missing).
  // The caller sees inconclusive; reconciliation picks up the
  // orphaned attempted row and flags it unresolved.
  try {
    await recordAuditEvent({
      event: "security.password_change.completed",
      outcome: "completed",
      actorAccountId: session.account.id,
      actorIdentity: `acct:${session.account.id}`,
      targetType: "nex_account",
      targetId: session.account.id,
      metadata: {
        sessions_invalidated_at: invalidation.invalidated_at,
      },
    });
  } catch (auditErr) {
    if (isAuditWriteError(auditErr)) {
      // Password WAS changed · but completion audit failed. Honest
      // response · user re-authenticates on every device (sessions
      // already invalidated) and the audit trail shows attempted
      // without completed · reconciler surfaces this.
      return NextResponse.json(
        {
          ok: false,
          error: "audit_completion_failed",
          sessions_invalidated_at: invalidation.invalidated_at,
        },
        { status: 503 },
      );
    }
    throw auditErr;
  }

  return NextResponse.json({
    ok: true,
    sessions_invalidated_at: invalidation.invalidated_at,
  });
}
