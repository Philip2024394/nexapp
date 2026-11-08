// src/lib/nex-native/security-audit-reconciler.ts
//
// NEX Security Programme · Item 5 · application-side wrapper for the
// SECURITY DEFINER reconciliation RPC in migration 293.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// This module provides a thin callable that invokes the SQL function
// nex_security_audit_reconcile_unmatched(window_seconds). It is
// designed to be called by:
//   · an HQ operator via a server action on the HQ security-audit
//     page (future UI work), OR
//   · a scheduled job (e.g. Supabase pg_cron or a Vercel cron route)
//     after that job is explicitly authorised and provisioned by the
//     owner.
//
// This file does NOT auto-schedule anything. It does NOT register a
// cron handler. It just exposes a server-only function that an
// authorised caller can invoke. Idempotency is provided by the SQL
// function via UNIQUE(attempted_log_id) on the reconciliation sidecar.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

export interface ReconcileResult {
  readonly ok: boolean;
  readonly unresolvedInserted?: number;
  readonly skipped?: "function_not_available" | "transient_error";
  readonly error?: string;
}

const DEFAULT_WINDOW_SECONDS = 300; // 5 minutes

/** Invoke the SECURITY DEFINER reconciliation function. Returns the
 *  number of newly-inserted unresolved rows (0 when nothing unmatched,
 *  positive when the reconciler found attempted-without-match events).
 *
 *  Compatibility · if migration 293 is not applied, the function
 *  does not exist (42883) and this wrapper returns ok=false with
 *  skipped="function_not_available". The caller treats this as a
 *  no-op · the reconciler simply isn't live yet. */
export async function reconcileUnmatchedAudits(
  windowSeconds: number = DEFAULT_WINDOW_SECONDS,
): Promise<ReconcileResult> {
  if (windowSeconds < 60 || windowSeconds > 3600) {
    throw new Error(
      `security-audit-reconciler: windowSeconds must be in [60, 3600] · got ${windowSeconds}`,
    );
  }
  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_security_audit_reconcile_unmatched",
    { _reconciliation_window_seconds: windowSeconds },
  );
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    if (
      code === "42883" ||
      /does not exist|undefined function/i.test(msg)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-audit-reconciler] nex_security_audit_reconcile_unmatched RPC " +
          "not available · migration 293 may be unapplied. No reconciliation ran.",
      );
      return { ok: false, skipped: "function_not_available" };
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[security-audit-reconciler] transient error · reconciliation skipped",
      { error: msg },
    );
    return { ok: false, skipped: "transient_error", error: msg };
  }
  const inserted = typeof data === "number" ? data : Array.isArray(data) ? Number(data[0] ?? 0) : 0;
  return { ok: true, unresolvedInserted: inserted };
}
