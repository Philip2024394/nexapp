// GET /api/dev-test/latest-reset-token?account_id=<uuid>
//
// DEV / SANDBOX ONLY. Returns the most recent plaintext Vault reset
// token for the given account, keyed by the in-process cache the
// dev-mode email sender writes to. Owner-authorised 2026-11-15 as the
// Phase 5 Playwright harness wiring (TODO B from the spec files).
//
// Path note: originally `/api/_test/...` per the spec draft · renamed
// to `/api/dev-test/...` because Next.js app-router treats single-
// underscore-prefixed folders as "private folders" that are NEVER
// mounted as public routes. The specs were updated to match.
//
// Hard-refuse rules (any one triggers a 403):
//   · NODE_ENV === "production"
//   · NEX_SUPABASE_URL contains the sealed production project ref
//   · NEX_SUPABASE_URL is unset (fail closed)
//
// Even if someone deployed this route to production, it would refuse
// at request time. The cache it reads from also refuses to STORE
// entries under the same gates, so production would see an empty cache
// even if the route were somehow reachable.

import { NextResponse, type NextRequest } from "next/server";
import {
  devResetTokenCacheEnabled,
  readDevResetToken,
} from "@/lib/nex-native/vault/_dev-reset-token-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!devResetTokenCacheEnabled()) {
    return NextResponse.json(
      { ok: false, error: "harness_disabled_in_production" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("account_id");
  if (!accountId || !/^[0-9a-f-]{32,36}$/i.test(accountId)) {
    return NextResponse.json(
      { ok: false, error: "missing_or_malformed_account_id" },
      { status: 400 },
    );
  }

  const entry = readDevResetToken(accountId);
  if (!entry) {
    return NextResponse.json(
      { ok: false, error: "no_live_token" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    token: entry.token,
    url: entry.url,
    expires_at: entry.expires_at,
  });
}
