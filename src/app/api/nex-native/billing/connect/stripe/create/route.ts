// src/app/api/nex-native/billing/connect/stripe/create/route.ts
//
// NEX seller Stripe Connect · onboarding create endpoint ·
// owner-authorised 2026-11-09 Round 31a.
// -----------------------------------------------------------------------------
// POST · creates a Stripe Connect Express account for the viewer's
// primary business (if not yet created) and returns an AccountLink URL
// that the client redirects the seller to.
//
// Request body (optional) · {
//   returnUrl?: string, // override where Stripe sends the seller back
//   refreshUrl?: string // override where Stripe sends on link expiry
// }
// Defaults are computed from the request origin.
//
// Response:
//   200 {ok:true, url, accountId, reused}
//   401 {ok:false, code:'unauthenticated'}
//   404 {ok:false, code:'no_business'}
//   422 {ok:false, code:'columns_not_applied'} · migration 311 missing
//   500 {ok:false, code:'stripe_init_failed' | 'stripe_account_create_failed' | ...}

import { NextRequest, NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { createOrRefreshOnboardingLink } from "@/lib/nex-native/billing/stripe-connect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFromRequest(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (req.nextUrl.protocol || "http:").replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated" },
      { status: 401 },
    );
  }

  const businesses = await listBusinessesByOwner(session.account.id).catch(
    () => [],
  );
  const primary = businesses[0] ?? null;
  if (!primary) {
    return NextResponse.json(
      { ok: false, code: "no_business" },
      { status: 404 },
    );
  }

  let bodyOverrides: {
    returnUrl?: string;
    refreshUrl?: string;
    countryCode?: string;
  } = {};
  try {
    const body = (await req.json()) as {
      returnUrl?: string;
      refreshUrl?: string;
      countryCode?: string;
    };
    if (body && typeof body === "object") bodyOverrides = body;
  } catch {
    // body is optional
  }

  const origin = originFromRequest(req);
  const returnUrl =
    bodyOverrides.returnUrl ??
    `${origin}/nex-native/settings/payments?connected=1`;
  const refreshUrl =
    bodyOverrides.refreshUrl ??
    `${origin}/nex-native/settings/payments?refresh=1`;

  const result = await createOrRefreshOnboardingLink({
    businessId: primary.id,
    ownerAccountId: session.account.id,
    ownerEmail: null,
    returnUrl,
    refreshUrl,
    countryCode: bodyOverrides.countryCode ?? null,
  });

  if (!result.ok) {
    const status =
      result.code === "columns_not_applied"
        ? 422
        : result.code === "stripe_init_failed"
          ? 500
          : result.code.startsWith("stripe_")
            ? 500
            : 500;
    return NextResponse.json(
      { ok: false, code: result.code, reason: result.reason },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      url: result.url,
      accountId: result.accountId,
      reused: result.reused,
    },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405 },
  );
}
