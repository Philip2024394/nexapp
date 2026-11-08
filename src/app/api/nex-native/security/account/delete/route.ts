// src/app/api/nex-native/security/account/delete/route.ts
//
// NEX Account Deletion · POST endpoint. Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Body: { current_password: string, reason?: string }
// Response:
//   · 200 { ok: true, deleted: true }
//   · 401 { error: "not_signed_in" | "wrong_password" }
//   · 400 { error: "missing_current_password" | "invalid_json" }
//   · 429 { error: "rate_limited", retry_after_seconds }
//   · 503 { error: "audit_unavailable" } (Retry-After: 30)
//   · 503 { error: "audit_completion_failed" }
//   · 500 { error: "soft_delete_failed" | "auth_delete_failed", detail }
//
// Step-up protocol
//   The account owner MUST re-verify the current password · this is
//   the same anti-accidental-deletion gate the password-change route
//   uses. We attempt a non-persistent signInWithPassword to validate ·
//   NEVER a client-supplied "I confirm" boolean.
//
// Rate limit
//   Uses the sealed "session_revoke_all" limit (3 per hour per account)
//   · deletion is at least as rare as mass session invalidation and
//     the same tight ceiling applies. We do not add a new action to
//     keep the audit catalog surface stable.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  accountRateLimitKey,
  buildRateLimitResponse,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { recordAuditEvent } from "@/lib/nex-native/security-audit-service";
import { deleteOwnAccount } from "@/lib/nex-native/account-deletion-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Rate limit using the session_revoke_all quota (3/hour) · deletion
  // is at least as rare as mass invalidation.
  try {
    await recordIfAllowed(
      accountRateLimitKey(session.account.id),
      "session_revoke_all",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      void recordAuditEvent({
        event: "security.account.delete.attempted",
        outcome: "denied",
        actorAccountId: session.account.id,
        actorIdentity: `acct:${session.account.id}`,
        metadata: { reason_code: "rate_limited" },
      }).catch(() => undefined);
      const r = buildRateLimitResponse(e);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    throw e;
  }

  let body: { current_password?: string; reason?: string };
  try {
    body = (await req.json()) as { current_password?: string; reason?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const current = typeof body.current_password === "string" ? body.current_password : "";
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 256)
      : null;
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "missing_current_password" },
      { status: 400 },
    );
  }
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  // Step-up · re-verify the current password via a non-persistent
  // sign-in (same pattern as /security/password/change).
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const v = await verifier.auth.signInWithPassword({
    email: session.email,
    password: current,
  });
  if (v.error || !v.data.user) {
    return NextResponse.json(
      { ok: false, error: "wrong_password" },
      { status: 401 },
    );
  }

  // All gates passed · run the deletion workflow.
  const outcome = await deleteOwnAccount({
    ownerAccountId: session.account.id,
    supabaseUserId: session.supabaseUserId,
    reason,
  });
  if (outcome.ok) {
    return NextResponse.json({ ok: true, deleted: true });
  }
  // Map internal errors to HTTP shapes.
  if (outcome.error === "audit_unavailable") {
    return NextResponse.json(
      { ok: false, error: "audit_unavailable" },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
  if (outcome.error === "audit_completion_failed") {
    return NextResponse.json(outcome, { status: 503 });
  }
  return NextResponse.json(outcome, { status: 500 });
}
