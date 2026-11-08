// src/app/api/nex-native/auth/webauthn/assert-start/route.ts
//
// Begin a WebAuthn sign-in ceremony. Accepts an optional email hint that
// scopes the allowed credentials to that account's registered ones. If no
// email is provided, we return an "empty allowList" options object so the
// browser lets the user pick from any resident credential on the device.

import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { resolveWebauthnConfig } from "@/lib/nex-native/webauthn-config";
import {
  buildRateLimitResponse,
  ipRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { recordAuditEvent } from "@/lib/nex-native/security-audit-service";
import { withBreaker, CircuitOpenError } from "@/lib/nex-native/recovery/circuit-breaker";

/** Plain-Request IP reader · the sealed readClientIp requires a
 *  NextRequest. Reads the same forwarded-for header set by Vercel. */
function readRequestClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body { email?: string }

export async function POST(req: Request) {
  // Owner directive 2026-11-08 · Item 4 · per-IP throttle on
  // WebAuthn assertion starts. Protects against email-hint enumeration
  // attacks (the handler leaks whether an email has credentials via
  // the allowCredentials array shape). Limit is per hashed IP, pre-
  // auth; a legitimate user retrying a failed assert won't hit 10 in
  // 15min. See security-rate-limit.ts for the policy rationale.
  try {
    await recordIfAllowed(
      ipRateLimitKey(readRequestClientIp(req)),
      "webauthn_assert",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      // Pre-auth path · the actor is an IP · no account identity yet.
      void recordAuditEvent({
        event: "security.webauthn.assert.denied",
        outcome: "denied",
        actorIdentity: ipRateLimitKey(readRequestClientIp(req)),
        metadata: { reason: "rate_limited" },
      }).catch(() => undefined);
      const r = buildRateLimitResponse(e);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    throw e;
  }

  const cfg = resolveWebauthnConfig(req);
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* body optional */ }

  let allowCredentials: { id: string; transports?: ("usb" | "nfc" | "ble" | "internal" | "hybrid")[] }[] | undefined;

  if (body.email && typeof body.email === "string" && body.email.includes("@")) {
    // Resolve email → auth user → nex_account → list credentials.
    //
    // Recovery wire · Owner-authorised 2026-11-08.
    // ------------------------------------------------------------------
    // WHY SAFE · auth.admin.listUsers is a bounded READ documented as
    // GET /auth/v1/admin/users against the gotrue admin API · idempotent
    // per HTTP semantics · no state is mutated. The page/perPage cap of
    // 200 keeps the call bounded; a repeat call returns the same page.
    //
    // BREAKER · "supabase_auth_admin" · same budget as the getUserById
    // call in assert-finish/route.ts · both hit the gotrue admin API so
    // a shared breaker protects against cascading failure.
    // failureThreshold=5 / windowMs=30_000 / cooldownMs=60_000 per owner
    // directive. If the breaker is OPEN we fall through with no
    // allowCredentials · the browser then relies on resident-key
    // discovery (same honest behaviour we already show for an unknown
    // email), which does not leak account existence either way.
    //
    // NO RETRY LAYER · the handler is user-facing and a stuck gotrue
    // call must not turn a sign-in flow into a 30-second hang · the
    // breaker's fast-fail behaviour is the right degradation here. If
    // the upstream is simply slow, we fall through to the empty
    // allowList case, which is already the documented behaviour of this
    // route when an email has no credentials.
    //
    // OWNER-SAFE BOUNDARY · the subsequent nex_account read and
    // listCredentialsForAccount are SELECT queries against our own
    // Postgres · read-safe, no wrap needed. The handler NEVER writes
    // state inside this branch.
    let list: Awaited<ReturnType<typeof nexSupabaseAdmin.auth.admin.listUsers>> | null = null;
    try {
      list = await withBreaker(
        "supabase_auth_admin",
        () => nexSupabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
        { failureThreshold: 5, windowMs: 30_000, cooldownMs: 60_000 },
      );
    } catch (e) {
      // Breaker OPEN · degrade silently to the empty-allowList path ·
      // the browser's resident-key discovery still works and the user
      // sees no account-existence leak. Non-breaker errors fall
      // through the same way (listUsers rarely throws · typically
      // returns {data,error}).
      if (!(e instanceof CircuitOpenError)) {
        // Upstream error that was not caught by the breaker · keep
        // behaviour honest by still allowing resident-key discovery.
      }
    }
    const found = list?.data?.users?.find((u) => u.email?.toLowerCase() === body.email!.toLowerCase());
    if (found) {
      const acc = await nexSupabaseAdmin
        .from("nex_account")
        .select("id")
        .eq("supabase_user_id", found.id)
        .maybeSingle();
      if (acc.data) {
        const creds = await listCredentialsForAccount((acc.data as { id: string }).id);
        if (creds.length > 0) {
          allowCredentials = creds.map((c) => ({
            id: c.credential_id,
            transports: (c.transports ?? undefined) as
              | ("usb" | "nfc" | "ble" | "internal" | "hybrid")[]
              | undefined,
          }));
        }
      }
    }
    // If no credentials were resolved we still return options with an
    // empty allowList · browsers with resident-key credentials will
    // discover them on their own; otherwise the user sees "no passkey
    // available" which is honest.
  }

  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    allowCredentials,
    userVerification: "required",
    timeout: 60_000,
  });

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set({
    name: "nex-webauthn-assert-challenge",
    value: options.challenge,
    httpOnly: true,
    sameSite: "strict",
    path: "/api/nex-native/auth/webauthn",
    maxAge: 300,
    secure: cfg.origin.startsWith("https://"),
  });
  return res;
}
