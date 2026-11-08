// src/app/api/nex-native/billing/connect/stripe/status/route.ts
//
// NEX seller Stripe Connect · status endpoint ·
// owner-authorised 2026-11-09 Round 31a.
// -----------------------------------------------------------------------------
// GET · reads the viewer's business Connect status (local + optionally
//        refreshed from Stripe)
// POST · same but always refreshes from Stripe before returning
//
// Response:
//   200 {ok:true, status:{accountId, chargesEnabled, payoutsEnabled,
//                         country, requirementsCurrentlyDue[],
//                         onboardedAt, lastWebhookAt}}
//   401 {ok:false, code:'unauthenticated'}
//   404 {ok:false, code:'no_business'}

import { NextRequest, NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import {
  readLocalConnectStatus,
  refreshAccountStatusFromStripe,
} from "@/lib/nex-native/billing/stripe-connect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(
  _req: NextRequest,
  refresh: boolean,
): Promise<NextResponse> {
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

  if (refresh) {
    const r = await refreshAccountStatusFromStripe(primary.id);
    return NextResponse.json(
      { ok: r.ok, status: r.status, ...(r.reason ? { reason: r.reason } : {}) },
      { status: 200 },
    );
  }

  const status = await readLocalConnectStatus(primary.id);
  return NextResponse.json({ ok: true, status }, { status: 200 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req, false);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req, true);
}
