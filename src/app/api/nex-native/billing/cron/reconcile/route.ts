// src/app/api/nex-native/billing/cron/reconcile/route.ts
//
// NEX Billing · scheduled reconciliation route.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Triggered by Vercel Cron (configured in vercel.json when the launch
// authorisation lands). Walks nex_billing_event_log for rows stuck at
// outcome='pending_checkout_mapping' and re-attempts resolution. Rows
// older than 7 days are flipped to 'orphaned_pending_mapping'.
//
// SECURITY · must only be callable by Vercel's cron infrastructure.
// Enforcement:
//   · Must present header `authorization: Bearer <CRON_SECRET>` matching
//     the env var `NEX_BILLING_CRON_SECRET`. If not set OR mismatched,
//     responds 401 without detail.
//   · No session is read · this endpoint runs headless.
//   · Returns a short JSON summary · no PII, no event payloads.

import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingMappings } from "@/lib/nex-native/billing/reconciliation";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.NEX_BILLING_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+/i.test(auth) || auth.replace(/^Bearer\s+/i, "").trim() !== secret) {
    return NextResponse.json(
      { ok: false, code: "unauthorised" },
      { status: 401 },
    );
  }

  let store;
  try {
    store = createProductionBillingStore();
  } catch (err) {
    console.error(
      "[nex-billing/cron] store init failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, code: "config_error" },
      { status: 500 },
    );
  }

  try {
    const result = await reconcilePendingMappings(store, new Date());
    return NextResponse.json(
      {
        ok: true,
        scanned: result.scanned,
        recovered: result.recovered,
        stillPending: result.stillPending,
        orphaned: result.orphaned,
        errorCount: result.errors.length,
      },
      { status: 200 },
    );
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

// Vercel Cron sends GET by default on some configs · allow it too but
// still require the bearer token.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
