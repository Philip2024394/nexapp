// src/app/api/nex-native/trial/opt-out-conversion/route.ts
//
// POST /api/nex-native/trial/opt-out-conversion
//
// G1 scope · owner-authorised 2026-10-22 · D2 Action 1 (pilot).
//
// User opts out of paid conversion. Trial continues to full 168h.
// No charge will be attempted at expiry.
//
// This endpoint does NOT trigger shop read-only (S2).
// G3 payment code (future) MUST honour `business_trial_conversion_opt_out=true`
// BEFORE any charge (S3 contract).

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  optOutConversion,
  NexBusinessTrialError,
  NexBusinessTrialRateLimitError,
} from "@/lib/nex-native/business-trial/service";
import { effectiveTrialEntitlements } from "@/lib/nex-native/business-trial/entitlements";
import { hashAccountId, makeRequestId, logTrialEvent } from "@/lib/nex-native/business-trial/logging";
import {
  preflightTrialIdempotency,
  finalizeTrialIdempotency,
  failTrialIdempotency,
} from "@/lib/nex-native/business-trial/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = makeRequestId(req);
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const hashedAccount = hashAccountId(session.account.id);

  const rawBody = await req.text();
  const preflight = await preflightTrialIdempotency(
    rawBody,
    req,
    session.account.id,
    "/api/nex-native/trial/opt-out-conversion",
  );
  if (preflight.kind === "cached") {
    return NextResponse.json(preflight.body, { status: preflight.status_code });
  }
  if (preflight.kind === "in_flight_conflict") {
    return NextResponse.json(preflight.body, { status: 409 });
  }
  if (preflight.kind === "different_request_conflict") {
    return NextResponse.json(preflight.body, { status: 422 });
  }
  if (preflight.kind === "missing_header_refused") {
    return NextResponse.json(preflight.body, { status: 400 });
  }
  const idemKey = preflight.key;

  try {
    const view = await optOutConversion(session.account.id);
    const entitlements = effectiveTrialEntitlements({ business_trial_status: view.status });
    const body = {
      status: view.status,
      start_at: view.start_at,
      end_at: view.end_at,
      hours_remaining: view.hours_remaining,
      conversion_opt_out: view.conversion_opt_out,
      entitlements,
    };
    await finalizeTrialIdempotency(idemKey, 200, body);
    logTrialEvent({
      event: "trial.business.opt_out",
      hashedAccount,
      requestId,
      statusCode: 200,
    });
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    await failTrialIdempotency(
      idemKey,
      err instanceof Error ? err.message : "unknown",
    ).catch(() => void 0);
    if (err instanceof NexBusinessTrialRateLimitError) {
      logTrialEvent({
        event: "trial.business.opt_out.denied",
        hashedAccount,
        requestId,
        statusCode: 429,
        reason: "rate_limited",
      });
      return NextResponse.json(
        {
          error: "rate_limited",
          window_minutes: err.windowMinutes,
          max_per_window: err.maxPerWindow,
        },
        { status: 429 },
      );
    }
    if (err instanceof NexBusinessTrialError) {
      const code = err.code;
      const status =
        code === "trial_not_active" || code === "already_opted_out" ? 409 : 400;
      logTrialEvent({
        event: "trial.business.opt_out.denied",
        hashedAccount,
        requestId,
        statusCode: status,
        reason: code,
      });
      return NextResponse.json({ error: code }, { status });
    }
    const asPgError = err as { code?: string; message?: string };
    logTrialEvent({
      event: "trial.business.opt_out.denied",
      hashedAccount,
      requestId,
      statusCode: 500,
      reason: asPgError?.message ?? "unknown",
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
