// src/app/api/nex-native/trial/start/route.ts
//
// POST /api/nex-native/trial/start
//
// G1 scope · owner-authorised 2026-10-22.
//
// This endpoint does NOT trigger shop read-only. See S2 safeguard.
// This endpoint does NOT elevate `effectiveTier()` to bisnis. See K14 Option β.
// This endpoint does NOT grant Vault / premium Themes / premium Intros / P1/P2/P3.
//
// Preconditions (K1 · D1 · Q3):
//   · `NEX_BUSINESS_TRIAL_ENABLED === 'true'` env flag · 403 if false
//   · `business_trial_status IS NULL` · 409 `already_used` if not
//   · themes-trial not active (within 168h) · 409 `themes_trial_still_active`

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  startBusinessTrial,
  NexBusinessTrialError,
  NexBusinessTrialRateLimitError,
  isBusinessTrialEnabled,
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

  // Q3 feature-flag enforcement is also inside the service, but check here
  // for an honest 403 before any DB round-trip.
  if (!isBusinessTrialEnabled()) {
    logTrialEvent({
      event: "trial.business.start.denied",
      hashedAccount,
      requestId,
      statusCode: 403,
      reason: "business_trial_not_available",
    });
    return NextResponse.json(
      { error: "business_trial_not_available" },
      { status: 403 },
    );
  }

  // Idempotency preflight · Q5 · account-scoped per src/lib/nex-native/business-trial/idempotency.ts.
  // DB preconditions remain authoritative (K1 one-shot) · this layer only
  // caches response bodies for honest retry behaviour and rejects same-key-different-body.
  const rawBody = await req.text();
  const preflight = await preflightTrialIdempotency(
    rawBody,
    req,
    session.account.id,
    "/api/nex-native/trial/start",
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
    // Not expected: `require_header: false` is set upstream
    return NextResponse.json(preflight.body, { status: 400 });
  }
  const idemKey = preflight.key;

  try {
    const view = await startBusinessTrial(session.account.id);
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
      event: "trial.business.start",
      hashedAccount,
      requestId,
      statusCode: 200,
      extra: {
        start_at: view.start_at,
        end_at: view.end_at,
      },
    });
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    // Mark idempotency record as failed so retries don't return a stale
    // in_flight state. The next same-key request is treated as not_found.
    await failTrialIdempotency(
      idemKey,
      err instanceof Error ? err.message : "unknown",
    ).catch(() => void 0);
    if (err instanceof NexBusinessTrialRateLimitError) {
      logTrialEvent({
        event: "trial.business.start.denied",
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
        code === "business_trial_not_available"
          ? 403
          : code === "already_used" || code === "themes_trial_still_active"
          ? 409
          : 400;
      logTrialEvent({
        event: "trial.business.start.denied",
        hashedAccount,
        requestId,
        statusCode: status,
        reason: code,
      });
      return NextResponse.json({ error: code }, { status });
    }
    // Postgres trigger `tr_nex_account_trial_coexistence` raises
    // SQLSTATE 23P01 (exclusion_violation). The node-pg driver surfaces
    // this with code '23P01' on the error.
    const asPgError = err as { code?: string; message?: string };
    if (asPgError?.code === "23P01") {
      logTrialEvent({
        event: "trial.business.start.denied",
        hashedAccount,
        requestId,
        statusCode: 409,
        reason: "themes_trial_still_active",
      });
      return NextResponse.json(
        { error: "themes_trial_still_active" },
        { status: 409 },
      );
    }
    logTrialEvent({
      event: "trial.business.start.denied",
      hashedAccount,
      requestId,
      statusCode: 500,
      reason: asPgError?.message ?? "unknown",
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
