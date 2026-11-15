// POST /api/nex-native/vault/escrow/reset-confirm
//
// Phase 2B · owner-authorised 2026-11-15. Consumes a reset token (from
// the email URL) and clears the 3-strike lockout. Requires an
// authenticated NEX session so an attacker who intercepts the URL
// cannot act unless they also have the account's cookie/JWT.
//
// On success the owner is NOT yet unlocked · they must still enter the
// correct PIN at the doorway. The reset clears the counter, giving them
// 3 fresh attempts. This is the honest non-destructive path.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  readClientCountry,
  readClientIp,
  readUserAgent,
  userAgentFamily,
} from "@/lib/nex-native/app/security-request";
import { consumePinResetToken } from "@/lib/nex-native/vault/pin-reset-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  token?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.token !== "string" || body.token.length === 0) {
    return NextResponse.json(
      { ok: false, error: "missing_token" },
      { status: 400 },
    );
  }

  const network = {
    ipAddress: readClientIp(req),
    ipCountry: readClientCountry(req),
    userAgentFamily: userAgentFamily(readUserAgent(req)),
  };

  const result = await consumePinResetToken({
    tokenPlaintext: body.token,
    network,
    expectedAccountId: session.account.id,
  });
  if (!result.ok) {
    const status =
      result.error === "token_malformed"
        ? 400
        : result.error === "token_not_found" || result.error === "token_consumed"
          ? 404
          : result.error === "token_expired"
            ? 410
            : result.error === "token_account_mismatch"
              ? 403
              : 409;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, cleared: true });
}
