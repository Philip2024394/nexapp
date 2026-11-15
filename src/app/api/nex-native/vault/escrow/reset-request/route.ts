// POST /api/nex-native/vault/escrow/reset-request
//
// Phase 2B · owner-authorised 2026-11-15. Issues an email-based reset
// token that will clear the 3-strike lockout (migration 346). Requires:
//   · authenticated NEX session (the owner is signed in, just locked out
//     of their Vault PIN)
//   · account is in reset_required state (otherwise 409)
//
// Response · `ok: true` reveals ONLY expiry + whether an email was
// dispatched · the token itself never crosses this response (it goes
// via the email channel). In sandbox the dev-mode sender logs the URL
// to the Next.js server console AND inserts a "pin_reset_requested"
// security event so it shows in the drawer feed.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  readClientCountry,
  readClientIp,
  readUserAgent,
  userAgentFamily,
} from "@/lib/nex-native/app/security-request";
import {
  issuePinResetToken,
  PIN_RESET_TOKEN_TTL_MINUTES,
} from "@/lib/nex-native/vault/pin-reset-service";
import { sendPinResetEmail } from "@/lib/nex-native/vault/pin-reset-email-sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  const ip = readClientIp(req);
  const network = {
    ipAddress: ip,
    ipCountry: readClientCountry(req),
    userAgentFamily: userAgentFamily(readUserAgent(req)),
  };

  const issued = await issuePinResetToken({
    accountId: session.account.id,
    network,
  });
  if (!issued.ok) {
    if (issued.error === "not_locked") {
      return NextResponse.json(
        {
          ok: false,
          error: "not_locked",
          detail:
            "Vault is not in a locked state. Reset tokens are only issued after 3 consecutive failed PIN attempts.",
        },
        { status: 409 },
      );
    }
    if (issued.error === "already_issued_recently") {
      return NextResponse.json(
        {
          ok: false,
          error: "already_issued_recently",
          detail:
            "A reset email was issued less than a minute ago. Check your inbox or wait before requesting another.",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "unknown_issue_error" },
      { status: 500 },
    );
  }

  // Send the email. Resolver picks Resend (production) or dev-mode
  // (stdout + in-process cache) based on env. A failure of a REAL
  // provider is surfaced to the owner so they can retry · dev-mode
  // always succeeds.
  const origin = req.headers.get("origin") ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const sent = await sendPinResetEmail({
    accountId: session.account.id,
    email: session.email,
    tokenPlaintext: issued.tokenPlaintext,
    requestOrigin: origin,
    expiresAt: issued.expiresAt,
    ttlMinutes: PIN_RESET_TOKEN_TTL_MINUTES,
    displayName:
      (session.account as { display_name?: string | null }).display_name ?? null,
  });
  if (!sent.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[vault-pin-reset] send failed via ${sent.provider} for account=${session.account.id.slice(0, 8)}*** · ${sent.error}`,
    );
    return NextResponse.json(
      {
        ok: false,
        error: "email_dispatch_failed",
        provider: sent.provider,
        detail: sent.error,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    dispatched: true,
    provider: sent.provider,
    expires_at: issued.expiresAt,
    ttl_minutes: PIN_RESET_TOKEN_TTL_MINUTES,
  });
}
