// src/app/api/nex-native/hq/direct-message/route.ts
//
// NEX HQ Direct Message · POST endpoint. Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Body: { target_account_id: string, body: string }
// Response:
//   · 200 { ok: true, messageId }
//   · 401 { ok: false, error: "not_signed_in" }
//   · 403 { ok: false, error: "forbidden" }                  (not HQ admin)
//   · 400 { ok: false, error: "invalid_json" | "invalid_target" | "invalid_body" }
//   · 404 { ok: false, error: "target_not_found" }
//   · 429 { ok: false, error: "rate_limited", retry_after_seconds }
//   · 500 { ok: false, error: "send_failed", detail }
//
// Authorization
//   · Session + requireHqAdmin gate · independent from any page-level
//     gate per the sealed hq-authorization.ts doctrine.
//
// Rate limit
//   · Reuses the sealed `account_create` quota (3 per hour). Adding a
//     new enum variant would require extending the sealed migration 290
//     CHECK constraint · we choose the stable catalog instead. Keyed by
//     HQ account id, not target · bounds the HQ operator, not the
//     victim.
//
// Audit
//   · security.hq.direct_message.completed / .failed emitted by the
//     service layer. The route additionally fires .failed with
//     error_code="rate_limited" on 429 so the HQ auditor can see the
//     throttled attempts.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  isHqAuthorizationError,
  requireHqAdmin,
} from "@/lib/nex-native/hq-authorization";
import {
  accountRateLimitKey,
  buildRateLimitResponse,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { recordAuditEvent } from "@/lib/nex-native/security-audit-service";
import {
  HqDirectError,
  isHqDirectError,
  sendHqMessage,
} from "@/lib/nex-native/hq-direct-channel/hq-direct-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ─── 1. Session ────────────────────────────────────────────────────
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }

  // ─── 2. HQ admin gate ──────────────────────────────────────────────
  try {
    await requireHqAdmin(session.account.id);
  } catch (e) {
    if (isHqAuthorizationError(e)) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 },
      );
    }
    throw e;
  }

  // ─── 3. Rate limit (per HQ account · reuses account_create · 3/hr) ─
  try {
    await recordIfAllowed(
      accountRateLimitKey(session.account.id),
      "account_create",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      void recordAuditEvent({
        event: "security.hq.direct_message.failed",
        outcome: "failed",
        actorAccountId: session.account.id,
        actorIdentity: `acct:${session.account.id}`,
        metadata: { error_code: "rate_limited" },
      }).catch(() => undefined);
      const r = buildRateLimitResponse(e);
      return NextResponse.json(r.body, {
        status: r.status,
        headers: r.headers,
      });
    }
    throw e;
  }

  // ─── 4. Parse body ─────────────────────────────────────────────────
  let raw: { target_account_id?: unknown; body?: unknown };
  try {
    raw = (await req.json()) as {
      target_account_id?: unknown;
      body?: unknown;
    };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const target =
    typeof raw.target_account_id === "string" ? raw.target_account_id : "";
  const body = typeof raw.body === "string" ? raw.body : "";
  if (!UUID_SHAPE.test(target)) {
    return NextResponse.json(
      { ok: false, error: "invalid_target" },
      { status: 400 },
    );
  }
  if (body.trim().length < 1 || body.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  // ─── 5. Send ───────────────────────────────────────────────────────
  try {
    const r = await sendHqMessage({
      hqAccountId: session.account.id,
      targetAccountId: target,
      body,
    });
    return NextResponse.json({ ok: true, messageId: r.messageId });
  } catch (e) {
    if (isHqDirectError(e)) {
      if (e.code === "invalid_target" || e.code === "invalid_body") {
        return NextResponse.json(
          { ok: false, error: e.code, detail: e.detail ?? null },
          { status: 400 },
        );
      }
      if (e.code === "target_not_found") {
        return NextResponse.json(
          { ok: false, error: "target_not_found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { ok: false, error: e.code, detail: e.detail ?? null },
        { status: 500 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    // Emit a fail-open .failed with a generic error_code · body is
    // never included.
    void recordAuditEvent({
      event: "security.hq.direct_message.failed",
      outcome: "failed",
      actorAccountId: session.account.id,
      actorIdentity: `acct:${session.account.id}`,
      targetType: "nex_account",
      targetId: target,
      metadata: { error_code: "unexpected", target_account_id: target },
    }).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "send_failed", detail: msg.slice(0, 200) },
      { status: 500 },
    );
  }
}
