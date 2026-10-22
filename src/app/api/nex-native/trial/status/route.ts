// src/app/api/nex-native/trial/status/route.ts
//
// GET /api/nex-native/trial/status
//
// G1 scope · read-only · owner-authorised 2026-10-22.
// Returns the current Business Trial state for the authenticated account.
// Works even when `NEX_BUSINESS_TRIAL_ENABLED=false` (status is observable
// regardless of flag).

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { getTrialStatus } from "@/lib/nex-native/business-trial/service";
import { effectiveTrialEntitlements } from "@/lib/nex-native/business-trial/entitlements";
import { hashAccountId, makeRequestId, logTrialEvent } from "@/lib/nex-native/business-trial/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = makeRequestId(req);
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const hashedAccount = hashAccountId(session.account.id);

  try {
    const view = await getTrialStatus(session.account.id);
    const entitlements = effectiveTrialEntitlements({ business_trial_status: view.status });
    // Status endpoint intentionally does NOT emit a transition log.
    // Only the dedicated event is used (Q6 minimal · reduce log volume).
    logTrialEvent({
      event: "trial.business.status",
      hashedAccount,
      requestId,
      statusCode: 200,
    });
    const res = NextResponse.json(
      {
        status: view.status,
        start_at: view.start_at,
        end_at: view.end_at,
        hours_remaining: view.hours_remaining,
        conversion_opt_out: view.conversion_opt_out,
        entitlements,
      },
      { status: 200 },
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const asErr = err as { message?: string };
    logTrialEvent({
      event: "trial.business.status",
      hashedAccount,
      requestId,
      statusCode: 500,
      reason: asErr?.message ?? "unknown",
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
