// src/app/api/nex-native/billing/connect/stripe/disconnect/route.ts
//
// NEX seller Stripe Connect · disconnect endpoint ·
// owner-authorised 2026-11-09 Round 31a2.
// -----------------------------------------------------------------------------
// POST · clears the NEX↔Stripe account mapping for the viewer's primary
// business. The Stripe account itself continues to exist on Stripe's
// side (seller keeps their record and can reconnect to NEX later).
//
// Fail-soft when migration 311 columns are absent · returns 422.

import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { disconnectConnectAccount } from "@/lib/nex-native/billing/stripe-connect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
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
  const result = await disconnectConnectAccount(primary.id);
  if (!result.ok) {
    const status = result.reason === "columns_not_applied" ? 422 : 500;
    return NextResponse.json(
      { ok: false, code: result.reason ?? "disconnect_failed" },
      { status },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405 },
  );
}
