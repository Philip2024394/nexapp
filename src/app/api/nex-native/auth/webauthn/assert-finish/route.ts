// src/app/api/nex-native/auth/webauthn/assert-finish/route.ts
//
// Verify a WebAuthn assertion and, if valid, issue a Supabase session for
// the matching NEX account.
//
// Session bridging pattern:
//   1. Verify assertion via @simplewebauthn/server
//   2. Look up credential → nex_account → supabase auth user (with email)
//   3. Use admin.generateLink('magiclink') to obtain a hashed_token
//   4. Use the SSR-scoped Supabase client to verifyOtp({token_hash})
//      → this writes the sb- session cookie via the SSR cookie envelope
//   5. Return { ok: true, redirect: '/nex-native/conversations' }
//
// The client hits /api/nex-native/auth/webauthn/assert-finish, receives
// the ok, and navigates to the redirect target. The session cookie is
// already set on the response, so the destination renders authenticated.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
// 2026-10-28 · in @simplewebauthn v11 the TS types moved to a
// separate `@simplewebauthn/types` package. Same pattern as
// `sign-in/_face-button.tsx` + enroll-finish route (ea36901).
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import {
  nexAppSsrServerClient,
} from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveWebauthnConfig } from "@/lib/nex-native/webauthn-config";
import {
  buildRateLimitResponse,
  ipRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "@/lib/nex-native/security-rate-limit";
import { recordAuditEvent } from "@/lib/nex-native/security-audit-service";

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
import {
  getCredentialById,
  markCredentialUsed,
} from "@/lib/nex-native/webauthn-service";
import { withRetry } from "@/lib/nex-native/recovery/retry";
import { withBreaker, CircuitOpenError } from "@/lib/nex-native/recovery/circuit-breaker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Owner directive 2026-11-08 · Item 4 · per-IP throttle on assert
  // completion · same policy as assert-start so an attacker running
  // start → finish loops is capped either way.
  try {
    await recordIfAllowed(
      ipRateLimitKey(readRequestClientIp(req)),
      "webauthn_assert",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
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

  const jar = await cookies();
  const challenge = jar.get("nex-webauthn-assert-challenge")?.value;
  if (!challenge) {
    return NextResponse.json(
      { error: "missing_challenge", detail: "assert-start was not called or cookie expired" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const response = body.response as AuthenticationResponseJSON | undefined;
  if (!response) {
    return NextResponse.json({ error: "missing_response" }, { status: 400 });
  }

  // 1 · locate the credential (its id is base64url in response.id)
  const stored = await getCredentialById(response.id);
  if (!stored) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 404 });
  }

  // 2 · verify the assertion against the stored public key
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      credential: {
        id: stored.credential_id,
        publicKey: Buffer.from(stored.credential_public_key, "base64url"),
        counter: Number(stored.counter),
        transports:
          (stored.transports ?? undefined) as
            | ("usb" | "nfc" | "ble" | "internal" | "hybrid")[]
            | undefined,
      },
      requireUserVerification: true,
    });
  } catch (e) {
    void recordAuditEvent({
      event: "security.webauthn.assert.failed",
      outcome: "failed",
      actorIdentity: ipRateLimitKey(readRequestClientIp(req)),
      targetType: "nex_webauthn_credential",
      targetId: stored.credential_id,
      metadata: { error_code: "verification_threw" },
    }).catch(() => undefined);
    return NextResponse.json(
      { error: "verification_failed", detail: (e as Error).message },
      { status: 400 },
    );
  }

  if (!verification.verified) {
    void recordAuditEvent({
      event: "security.webauthn.assert.failed",
      outcome: "failed",
      actorIdentity: ipRateLimitKey(readRequestClientIp(req)),
      targetType: "nex_webauthn_credential",
      targetId: stored.credential_id,
      metadata: { error_code: "not_verified" },
    }).catch(() => undefined);
    return NextResponse.json({ error: "not_verified" }, { status: 400 });
  }

  // 3 · bump counter + last_used_at
  const newCounter = verification.authenticationInfo?.newCounter ?? Number(stored.counter);
  try { await markCredentialUsed(stored.credential_id, newCounter); } catch { /* non-fatal */ }

  // Audit · WebAuthn assert succeeded. Fail-open · authentication is a
  // frequent legitimate action and audit failure should not block it.
  void recordAuditEvent({
    event: "security.webauthn.assert.completed",
    outcome: "completed",
    actorAccountId: stored.account_id,
    actorIdentity: `acct:${stored.account_id}`,
    targetType: "nex_webauthn_credential",
    targetId: stored.credential_id,
    metadata: {
      credential_id: stored.credential_id,
      counter_delta: newCounter - Number(stored.counter),
    },
  }).catch(() => undefined);

  // 4 · look up account + supabase auth user for session issuance
  const acc = await nexSupabaseAdmin
    .from("nex_account")
    .select("supabase_user_id, display_name")
    .eq("id", stored.account_id)
    .maybeSingle();
  if (acc.error || !acc.data) {
    return NextResponse.json({ error: "account_missing" }, { status: 500 });
  }
  const supabaseUserId = (acc.data as { supabase_user_id: string | null }).supabase_user_id;
  if (!supabaseUserId) {
    return NextResponse.json({ error: "account_has_no_auth" }, { status: 500 });
  }

  // Recovery wires · Owner-authorised 2026-11-08.
  // --------------------------------------------------------------------------
  // WHY SAFE · auth.admin.getUserById is a pure READ by stable primary key.
  // The @supabase/supabase-js gotrue-admin API documents this as a GET
  // request against /auth/v1/admin/users/{id} · idempotent per HTTP
  // semantics (RFC 9110 §9.2.2) · repeated reads return the same row
  // and MUST NOT create duplicates (contrast with auth.admin.createUser
  // which is explicitly forbidden to retry per owner doctrine). No state
  // is mutated by this call.
  //
  // RETRY · maxAttempts=3 with the default predicate (network-shape +
  // 429/5xx gateway only · never 4xx auth/not-found). 3 attempts is
  // enough to ride through a single pod restart or transient DNS blip;
  // more would just stall the user's sign-in on sustained upstream
  // outages (the breaker handles that case).
  //
  // BREAKER · "supabase_auth_admin" shared with the listUsers call in
  // assert-start/route.ts · failures in either surface count against
  // the same budget because they hit the same upstream admin API.
  // failureThreshold=5 / windowMs=30_000 / cooldownMs=60_000 per owner
  // directive · opens after a sustained upstream incident, lets a probe
  // through after 60s cooldown. OPEN state surfaces as auth_user_missing
  // 500 (we deliberately do NOT distinguish "breaker open" in the
  // response · the client receives the same failure shape and retries
  // on its own schedule).
  //
  // OWNER-SAFE BOUNDARY · ONLY the getUserById READ is wrapped. The
  // subsequent auth.admin.generateLink (mutates · issues a magic-link
  // token) and ssr.auth.verifyOtp (mutates · consumes the token into a
  // session) are NEVER retried · they are non-idempotent writes that
  // would create duplicate tokens / duplicate session cookies if
  // retried. Per owner doctrine: "Payment / purchase flows" and
  // "Account deletion workflow steps" style mutations must not be
  // wrapped and generateLink/verifyOtp sit in the same forbidden
  // category (token issuance + session mutation).
  const authReader = async () =>
    withRetry(
      async () => {
        const result = await nexSupabaseAdmin.auth.admin.getUserById(
          supabaseUserId,
        );
        // supabase-js returns { data, error } rather than throwing ·
        // synthesise an Error so withRetry's shouldRetry predicate can
        // see the transient-ness of the status code.
        if (result.error) {
          const synthetic = new Error(result.error.message ?? "auth_admin_error") as Error & {
            status?: number;
            code?: string;
          };
          const status = (result.error as { status?: number }).status;
          if (typeof status === "number") synthetic.status = status;
          const code = (result.error as { code?: string }).code;
          if (typeof code === "string") synthetic.code = code;
          throw synthetic;
        }
        return result;
      },
      { idempotent: true, maxAttempts: 3 },
    );

  let auth;
  try {
    auth = await withBreaker("supabase_auth_admin", authReader, {
      failureThreshold: 5,
      windowMs: 30_000,
      cooldownMs: 60_000,
    });
  } catch (e) {
    // Breaker OPEN or exhausted retries · surface honest failure. We
    // collapse CircuitOpenError into the same auth_user_missing shape
    // the legacy path returned so the client flow is unchanged.
    if (e instanceof CircuitOpenError) {
      return NextResponse.json({ error: "auth_user_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: "auth_user_missing" }, { status: 500 });
  }
  if (auth.error || !auth.data.user?.email) {
    return NextResponse.json({ error: "auth_user_missing" }, { status: 500 });
  }
  const email = auth.data.user.email;

  // 5 · generate a magic link then convert its hashed token into an
  //     SSR-cookie session via verifyOtp on the server-side SSR client.
  const link = await nexSupabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error || !link.data.properties?.hashed_token) {
    return NextResponse.json(
      { error: "session_link_failed", detail: link.error?.message ?? "no hashed_token" },
      { status: 500 },
    );
  }
  const hashedToken = link.data.properties.hashed_token;

  const ssr = await nexAppSsrServerClient();
  const verify = await ssr.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (verify.error || !verify.data.session) {
    return NextResponse.json(
      { error: "session_verify_failed", detail: verify.error?.message ?? "no session" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    redirect: "/nex-native/home",
    account_id: stored.account_id,
  });
  res.cookies.set({
    name: "nex-webauthn-assert-challenge",
    value: "",
    httpOnly: true,
    sameSite: "strict",
    path: "/api/nex-native/auth/webauthn",
    maxAge: 0,
    secure: cfg.origin.startsWith("https://"),
  });
  return res;
}
